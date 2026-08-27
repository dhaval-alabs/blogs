// Gemini-backed salary estimator. Server-only — uses the service Supabase
// client and the Gemini API key. Do NOT import from client components.
//
// Flow:
//   1. Look up (role, location, experience) in `salary_estimates`.
//   2. If a row exists and refreshed_at is within CACHE_TTL_MS, return it.
//   3. Otherwise call Gemini 3.6 Flash with Google Search grounding,
//      parse the structured JSON response, upsert the row, return it.
//   4. On Gemini failure, return the stale row if we have one, else null
//      (callers fall back to the hardcoded table in src/lib/data.js).

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServiceClient } from './supabase';
import { ROLES, LOCATIONS, EXPERIENCES, getSalaryRange } from './data';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function isValidParams(role, location, experience) {
  return ROLES.includes(role) && LOCATIONS.includes(location) && EXPERIENCES.includes(experience);
}

function isFresh(refreshedAt) {
  if (!refreshedAt) return false;
  const t = new Date(refreshedAt).getTime();
  return Number.isFinite(t) && Date.now() - t < CACHE_TTL_MS;
}

async function readCached(db, role, location, experience) {
  const { data, error } = await db
    .from('salary_estimates')
    .select('*')
    .eq('role', role)
    .eq('location', location)
    .eq('experience', experience)
    .maybeSingle();
  if (error) {
    console.error('[salary] cache read error:', error.message);
    return null;
  }
  return data;
}

async function writeCached(db, row) {
  const { error } = await db
    .from('salary_estimates')
    .upsert(row, { onConflict: 'role,location,experience' });
  if (error) console.error('[salary] cache write error:', error.message);
}

function toRow(role, location, experience, parsed, sources) {
  return {
    role,
    location,
    experience,
    min_lpa: Number(parsed.min_lpa),
    median_lpa: Number(parsed.median_lpa),
    max_lpa: Number(parsed.max_lpa),
    commentary: String(parsed.commentary || '').slice(0, 800),
    yoy_delta_pct: parsed.yoy_delta_pct == null ? null : Number(parsed.yoy_delta_pct),
    sources: Array.isArray(sources) ? sources.slice(0, 6) : [],
    refreshed_at: new Date().toISOString(),
  };
}

function sanitizeParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const min = Number(parsed.min_lpa);
  const med = Number(parsed.median_lpa);
  const max = Number(parsed.max_lpa);
  if (!Number.isFinite(min) || !Number.isFinite(med) || !Number.isFinite(max)) return null;
  if (min <= 0 || med <= 0 || max <= 0) return null;
  if (min > med || med > max) return null;
  if (max > 200) return null; // sanity: no role in India breaks ₹200 LPA median band
  return { min_lpa: min, median_lpa: med, max_lpa: max,
           commentary: parsed.commentary, yoy_delta_pct: parsed.yoy_delta_pct };
}

function extractSources(response) {
  // Gemini grounding metadata lives on candidates[0].groundingMetadata.groundingChunks
  try {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
      .map((c) => c?.web)
      .filter((w) => w && w.uri)
      .map((w) => ({ title: w.title || '', uri: w.uri }));
  } catch {
    return [];
  }
}

function extractJsonText(response) {
  // The SDK exposes candidate parts; we want the text part. response.text()
  // works for plain-text responses but can throw when tools are present, so
  // we walk the parts array defensively.
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (typeof p.text === 'string' && p.text.trim()) return p.text;
  }
  return '';
}

function parseJsonLoose(text) {
  if (!text) return null;
  // Strip markdown fences if Gemini wrapped the JSON despite our instructions.
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Last-ditch: find the first { ... } block.
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callGemini(role, location, experience) {
  if (!genAI) return null;

  const prompt = `You are a labor-market analyst. Find the current (2025-2026) base salary range for the role below in the Indian tech market, using recent Glassdoor, AmbitionBox, levels.fyi, payscale.com, and reputable industry compensation reports found via search.

Role: ${role}
Location: ${location}, India
Experience: ${experience} years

Return ONLY a single JSON object — no prose, no markdown fences — with these exact keys:
{
  "min_lpa": <number, 10th percentile annual base in lakhs ₹>,
  "median_lpa": <number, 50th percentile annual base in lakhs ₹>,
  "max_lpa": <number, 90th percentile annual base in lakhs ₹>,
  "yoy_delta_pct": <number, percent change vs last year, can be negative>,
  "commentary": "<1-2 sentence note on market demand, hiring trend, or notable factors. Reference current year.>"
}

Constraints:
- min_lpa <= median_lpa <= max_lpa
- All values are base compensation in ₹ lakhs per annum (LPA), excluding stock and bonus.
- Use only figures supported by sources you can cite. If sources disagree, use the median across sources.
- If the role doesn't exist in this market, return min_lpa=0 median_lpa=0 max_lpa=0 and explain in commentary.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.2,
      // gemini-3.6-flash can't disable thinking (thinkingBudget: 0 is
      // rejected) — "low" is the minimum, and the Google Search grounding
      // here pushes thinking overhead higher than the plain-text call sites,
      // so this needed the biggest headroom bump of the four.
      maxOutputTokens: 900,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = extractJsonText(response);
  const parsed = parseJsonLoose(text);
  const clean = sanitizeParsed(parsed);
  if (!clean) {
    console.warn('[salary] Gemini response did not parse:', text?.slice(0, 200));
    return null;
  }
  const sources = extractSources(response);
  return { parsed: clean, sources };
}

// Public API ─────────────────────────────────────────────────────────
export async function getSalaryEstimate(role, location, experience) {
  if (!isValidParams(role, location, experience)) {
    return { ok: false, error: 'invalid_params', fallback: getSalaryRange(role, location, experience) };
  }

  const db = getServiceClient();
  const cached = await readCached(db, role, location, experience);

  if (cached && isFresh(cached.refreshed_at)) {
    return { ok: true, source: 'cache', estimate: cached };
  }

  if (!genAI) {
    if (cached) return { ok: true, source: 'cache_stale', estimate: cached };
    return { ok: false, error: 'no_api_key', fallback: getSalaryRange(role, location, experience) };
  }

  try {
    const result = await callGemini(role, location, experience);
    if (!result) {
      if (cached) return { ok: true, source: 'cache_stale', estimate: cached };
      return { ok: false, error: 'gemini_parse_failed', fallback: getSalaryRange(role, location, experience) };
    }
    const row = toRow(role, location, experience, result.parsed, result.sources);
    await writeCached(db, row);
    return { ok: true, source: 'fresh', estimate: row };
  } catch (err) {
    console.error('[salary] Gemini call failed:', err.message);
    if (cached) return { ok: true, source: 'cache_stale', estimate: cached };
    return { ok: false, error: 'gemini_error', fallback: getSalaryRange(role, location, experience) };
  }
}
