/**
 * Lightweight knowledge base for the Ask-AI endpoint.
 *
 * Loads a compact summary of every published blog post (title, slug, excerpt,
 * tags, category) and ranks them at query time so the LLM can ground answers
 * in real AnalytixLabs content and link back to it.
 *
 * No embeddings — tag + keyword overlap scoring keeps latency / cost low.
 */

import { supabase } from "./supabase";

const SITE_URL = "https://www.analytixlabs.co.in";
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { t: 0, rows: null };

export async function getKnowledgeBase() {
  const now = Date.now();
  if (cache.rows && now - cache.t < CACHE_TTL_MS) return cache.rows;

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("title,slug,excerpt,domain_tags,category")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500);

    if (error || !Array.isArray(data)) return cache.rows || [];
    cache = { t: now, rows: data };
    return data;
  } catch {
    return cache.rows || [];
  }
}

const STOP = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in","on",
  "for","and","or","but","with","as","at","by","from","that","this","these","those",
  "it","its","i","you","we","he","she","they","them","their","our","your","my",
  "what","which","who","whom","how","when","where","why","do","does","did","can",
  "could","should","would","will","shall","may","might","about","into","than","then",
  "so","if","because","just","like","get","got","have","has","had","not","no",
  "me","us","best","top","vs","vs.","between"
]);

function tokenize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function rankRelevantArticles({ question, articleTags = [], currentSlug = null, limit = 6 }) {
  const rows = cache.rows || [];
  if (!rows.length) return [];

  const qTokens = new Set(tokenize(question));
  const tagTokens = new Set((articleTags || []).map((t) => String(t).toLowerCase()));

  const scored = rows
    .filter((r) => r.slug && r.slug !== currentSlug)
    .map((r) => {
      const rTags = (r.domain_tags || []).map((t) => String(t).toLowerCase());
      const titleTokens = tokenize(r.title);
      const excerptTokens = tokenize(r.excerpt);

      let score = 0;
      for (const t of rTags) if (tagTokens.has(t)) score += 3;
      for (const t of titleTokens) if (qTokens.has(t)) score += 2;
      for (const t of rTags) if (qTokens.has(t)) score += 2;
      for (const t of excerptTokens) if (qTokens.has(t)) score += 1;

      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r }) => r);

  return scored;
}

export function formatKnowledgeForPrompt(rows) {
  if (!rows || rows.length === 0) return "";
  const lines = rows.map((r) => {
    const url = `${SITE_URL}/blog/${r.slug}`;
    const tags = (r.domain_tags || []).slice(0, 4).join(", ");
    const excerpt = String(r.excerpt || "").replace(/\s+/g, " ").slice(0, 160);
    return `- [${r.title}](${url}) — ${excerpt}${tags ? ` [${tags}]` : ""}`;
  });
  return lines.join("\n");
}
