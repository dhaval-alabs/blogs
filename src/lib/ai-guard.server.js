// Rate limiting + usage logging for the PUBLIC AI endpoints (/api/ask-ai and
// /api/ask-ai/followups). Server-only — never import from a client component.
//
// What was wrong before:
//
//   1. The limiter was `new Map()` in module scope. On serverless that Map is
//      empty on every cold start and is not shared between the concurrent
//      instances the platform runs, so "15 per minute per IP" was closer to
//      "15 per minute per instance per cold start" — effectively unlimited.
//
//   2. The bucket key was the RAW `x-forwarded-for` header. A client can send
//      that header itself; the platform APPENDS the real address rather than
//      replacing it. So the raw string is partly attacker-controlled, and
//      varying the first entry produced a brand-new bucket on every request —
//      the limit could be bypassed with one header. Only the LAST entry is
//      written by the platform, so that is the only part worth trusting.
//
//   3. Nothing was logged. When the Gemini project was flagged for suspicious
//      activity there was no way to tell how much traffic came through here.
//
//   4. Only a per-IP limit existed. That does nothing against a distributed
//      caller, which is exactly the shape of the traffic that got the project
//      flagged. A GLOBAL cap is what actually bounds the bill.

import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase";

// Per-caller burst control. Generous, because a genuine reader asking follow-up
// questions can legitimately fire several in a minute.
const IP_LIMIT = num(process.env.AI_RATE_IP_LIMIT, 15);
const IP_WINDOW_SECONDS = 60;

// The control that actually protects the bill. Sized well above real usage —
// this endpoint served single-digit calls per day through Aug 2026 — so it is
// invisible in normal operation and only bites during abuse.
const GLOBAL_LIMIT = num(process.env.AI_RATE_GLOBAL_DAILY, 2000);
const GLOBAL_WINDOW_SECONDS = 24 * 60 * 60;

// Fallback ceiling used only when Postgres is unreachable (see below). Tighter
// than IP_LIMIT on purpose: with no shared state we cannot know the real total,
// so the per-instance allowance has to be smaller.
const FALLBACK_IP_LIMIT = 5;

function num(v, dflt) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/**
 * The caller's address, as far as it can be trusted.
 *
 * `x-forwarded-for` is a comma-separated chain and the platform appends the
 * real peer to whatever the client sent, so the LAST entry is the trustworthy
 * one. Taking the whole string (or the first entry) lets a caller mint a fresh
 * rate-limit bucket per request just by varying a header.
 */
export function clientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Hashed so the usage log groups a caller without storing their address.
 * AI_RATE_SALT keeps the hash from being reversible via a rainbow table of the
 * IPv4 space; it is optional so a missing env var never breaks the endpoint.
 */
export function hashIp(ip) {
  return createHash("sha256")
    .update(`${process.env.AI_RATE_SALT ?? "alabs-blog"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

// Last-resort per-instance limiter. Only consulted when the shared counters are
// unavailable — on its own it is the broken thing this module replaces.
const localBuckets = new Map();

function localLimited(key, max) {
  const now = Date.now();
  const e = localBuckets.get(key);
  if (!e || now - e.start > IP_WINDOW_SECONDS * 1000) {
    localBuckets.set(key, { start: now, count: 1 });
    // Unbounded growth would be a slow leak in a long-lived instance.
    if (localBuckets.size > 5000) localBuckets.clear();
    return false;
  }
  e.count += 1;
  return e.count > max;
}

/**
 * Decide whether this request may spend a Gemini call.
 *
 * Returns { allowed, reason, ipHash, ipUsed, globalUsed, degraded }.
 *
 * On a database failure this DEGRADES to the in-memory limiter rather than
 * failing closed. Failing closed would take a working public feature offline
 * for every reader on a transient Postgres blip; the global cap exists to bound
 * cost, and a short window of per-instance-only limiting is the lesser harm.
 * `degraded` is returned (and logged) so the gap is visible rather than silent.
 */
export async function aiGuard(req, route) {
  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  try {
    const db = getServiceClient();
    const { data, error } = await db.rpc("ai_guard", {
      p_ip_hash: ipHash,
      p_ip_limit: IP_LIMIT,
      p_ip_window_seconds: IP_WINDOW_SECONDS,
      p_global_limit: GLOBAL_LIMIT,
      p_global_window_seconds: GLOBAL_WINDOW_SECONDS,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("ai_guard returned no row");

    // Opportunistic housekeeping — roughly once per 200 requests, so expired
    // counter rows never accumulate but no request pays for it twice.
    if (Math.random() < 0.005) {
      db.rpc("ai_guard_prune", { p_keep_hours: 48 }).then(
        () => {},
        () => {},
      );
    }

    return {
      allowed: row.allowed === true,
      reason: row.reason ?? null,
      ipHash,
      ipUsed: row.ip_used ?? null,
      globalUsed: row.global_used ?? null,
      degraded: false,
    };
  } catch (err) {
    console.error(`[ai-guard] shared counters unavailable (${route}):`, err.message);
    const blocked = localLimited(ipHash, FALLBACK_IP_LIMIT);
    return {
      allowed: !blocked,
      reason: blocked ? "blocked_ip" : null,
      ipHash,
      ipUsed: null,
      globalUsed: null,
      degraded: true,
    };
  }
}

/**
 * Record what happened. Best-effort and never awaited by the caller's critical
 * path: a logging failure must not cost the reader their answer.
 */
export function logAiUsage({ route, ipHash, model, outcome, questionChars, detail }) {
  try {
    getServiceClient()
      .from("ai_usage")
      .insert({
        route,
        ip_hash: ipHash ?? null,
        model: model ?? null,
        outcome,
        question_chars: typeof questionChars === "number" ? questionChars : null,
        detail: detail ? String(detail).slice(0, 300) : null,
      })
      .then(() => {}, () => {});
  } catch {
    /* logging is never allowed to break the endpoint */
  }
}

/** The 429 body, shared so both routes answer identically. */
export function rateLimitedResponse(reason, shape = "error") {
  const retryAfter = reason === "blocked_global" ? GLOBAL_WINDOW_SECONDS : IP_WINDOW_SECONDS;
  const body =
    shape === "questions"
      ? { questions: [] }
      : {
          error:
            reason === "blocked_global"
              ? "The assistant has reached today's usage limit. Please try again tomorrow."
              : "Too many requests. Please try again in a minute.",
        };
  return Response.json(body, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

export const AI_GUARD_LIMITS = { IP_LIMIT, IP_WINDOW_SECONDS, GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS };
