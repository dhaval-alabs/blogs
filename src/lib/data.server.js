/**
 * Server-only data helpers — use these in Server Components and Server Actions.
 * Do NOT import this file in 'use client' components.
 *
 * Performance notes:
 * - `cache()` from React dedupes identical calls within a single request,
 *   so Next.js's generateMetadata + page render share one DB round-trip.
 * - Posts embed their author via the author_id FK in a single PostgREST
 *   query, eliminating the previous per-page SELECT on authors.
 */

import { cache } from 'react';
import { supabase } from './supabase';
import { courses, salaryData, authors as staticAuthors } from './data';

// Projection used wherever the full post row + joined author is needed.
// Embedded author uses the posts.author_id → authors.slug FK; the column
// list is explicit so we never pull PII (e.g. email) into public responses.
const POST_WITH_AUTHOR_SELECT = `
  id, title, slug, excerpt, content, category, domain_tags, skill_level,
  read_time, author_id, image, status, published_at, updated_at,
  seo, course_mappings, course_cta, newsletter, quiz, ai_hints,
  trust, discussion, advanced,
  author:authors!posts_author_id_fkey (
    slug, name, initials, color, image, bio, linkedin, expertise, experience, position
  )
`;

// Lighter projection for list contexts where we don't render full content.
// Used by getRecommendations. Drops heavy JSONB / content blobs.
const POST_LIST_SELECT = `
  id, title, slug, excerpt, category, domain_tags, skill_level,
  read_time, author_id, image, published_at,
  author:authors!posts_author_id_fkey (
    slug, name, initials, color, image, position
  )
`;

// ── Column mapping: DB snake_case → app camelCase ─────────────────
function mapPostRow(row) {
  if (!row) return null;
  const author = row.author ?? staticAuthors[row.author_id] ?? null;
  return {
    id:             row.id,
    title:          row.title,
    slug:           row.slug,
    excerpt:        row.excerpt,
    content:        row.content,
    category:       row.category,
    domain_tags:    row.domain_tags ?? [],
    skill_level:    row.skill_level,
    readTime:       row.read_time,
    authorId:       row.author_id,
    image:          row.image,
    status:         row.status,
    publishedAt:    row.published_at,
    updatedAt:      row.updated_at,
    seo:            row.seo ?? {},
    courseMappings: row.course_mappings ?? [],
    courseCTA:      row.course_cta ?? '',
    newsletter:     row.newsletter ?? {},
    quiz:           row.quiz ?? {},
    aiHints:        row.ai_hints ?? {},
    trust:          row.trust ?? {},
    discussion:     row.discussion ?? {},
    advanced:       row.advanced ?? {},
    author,
  };
}

// Lightweight mapper for listing contexts — omits content + heavy JSONB blobs.
function mapPostRowLite(row) {
  if (!row) return null;
  const author = row.author ?? staticAuthors[row.author_id] ?? null;
  return {
    id:          row.id,
    title:       row.title,
    slug:        row.slug,
    excerpt:     row.excerpt,
    category:    row.category,
    domain_tags: row.domain_tags ?? [],
    skill_level: row.skill_level,
    readTime:    row.read_time,
    authorId:    row.author_id,
    image:       row.image,
    publishedAt: row.published_at,
    author,
  };
}

/** Fetch all published posts with embedded author, newest first.
 *  Uses the lightweight projection — listing pages don't need content
 *  or heavy JSONB columns (seo, quiz, newsletter, etc.). */
export const getPosts = cache(async function getPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_LIST_SELECT)
    .eq('status', 'Published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('[data.server] getPosts error:', error.message);
    return [];
  }
  return (data || []).map(mapPostRowLite);
});

/** Fetch a single post by slug, with embedded author. */
export const getPostBySlug = cache(async function getPostBySlug(slug) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_WITH_AUTHOR_SELECT)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[data.server] getPostBySlug error:', error.message);
    }
    return null;
  }
  return mapPostRow(data);
});

/** Check whether a URL slug resolves to a known post category.
 *  `categorySlug` is the URL-safe form (e.g. "data-analytics"). */
export const isCategorySlug = cache(async function isCategorySlug(categorySlug) {
  if (!categorySlug) return false;
  const target = categorySlug.toLowerCase();

  // Fetch distinct categories only once per request; reuse in memory.
  const { data, error } = await supabase
    .from('posts')
    .select('category')
    .not('category', 'is', null)
    .neq('category', '')
    .limit(500);
  if (error) return false;

  const seen = new Set();
  for (const r of data || []) {
    const s = (r.category || '').toLowerCase().trim().replace(/\s+/g, '-');
    if (s && !seen.has(s)) seen.add(s);
  }
  return seen.has(target);
});

/** Count published posts by a given author */
export const getAuthorPostCount = cache(async function getAuthorPostCount(authorId) {
  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .eq('status', 'Published');
  if (error) return 0;
  return count ?? 0;
});

/** Return slugs of all published posts — used for generateStaticParams */
export const getAllSlugs = cache(async function getAllSlugs() {
  const { data, error } = await supabase
    .from('posts')
    .select('slug')
    .eq('status', 'Published');

  if (error) return [];
  return data.map(r => r.slug);
});

/** Recommendations based on domain_tags + skill_level overlap.
 *  Uses a slimmer projection (no full content/JSONB) and caps the candidate
 *  pool — we don't need to rank against every post to pick 3. */
export const getRecommendations = cache(async function getRecommendations(currentSlug, limit = 3) {
  // First fetch the current post's tags + skill level (one small query).
  const { data: currentRow } = await supabase
    .from('posts')
    .select('slug, domain_tags, skill_level')
    .eq('slug', currentSlug)
    .maybeSingle();

  // Narrow the candidate pool: prefer posts that share a domain tag with the
  // current post. Fallback to newest 30 if the current post has no tags.
  let qb = supabase
    .from('posts')
    .select(POST_LIST_SELECT)
    .eq('status', 'Published')
    .neq('slug', currentSlug);

  if (currentRow?.domain_tags?.length) {
    qb = qb.overlaps('domain_tags', currentRow.domain_tags);
  }

  const { data, error } = await qb
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[data.server] getRecommendations error:', error.message);
    return [];
  }

  const pool = (data || []).map(mapPostRow);
  if (!currentRow) return pool.slice(0, limit);

  const overlap = (a, b) => (a && b ? a.filter(t => b.includes(t)).length : 0);

  return pool
    .map(p => ({
      ...p,
      _score: overlap(p.domain_tags, currentRow.domain_tags) * 2 +
              (p.skill_level === currentRow.skill_level ? 1 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
});

/** Search posts by query, topic filter, skill filter */
export const searchPosts = cache(async function searchPosts(query = '', activeTopic = null, activeSkill = null) {
  let qb = supabase
    .from('posts')
    .select(POST_WITH_AUTHOR_SELECT)
    .eq('status', 'Published');

  if (activeTopic) {
    qb = qb.contains('domain_tags', [activeTopic]);
  }
  if (activeSkill) {
    qb = qb.eq('skill_level', activeSkill);
  }

  const { data, error } = await qb
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });
  if (error) {
    console.error('[data.server] searchPosts error:', error.message);
    return [];
  }

  let results = (data || []).map(mapPostRow);

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.domain_tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return results;
});

/** Lightweight variant of searchPosts — uses POST_LIST_SELECT.
 *  Drops `content` and heavy JSONB columns from the wire payload.
 *  Used by the public /api/posts listing. */
export const searchPostsLite = cache(async function searchPostsLite(query = '', activeTopic = null, activeSkill = null) {
  let qb = supabase
    .from('posts')
    .select(POST_LIST_SELECT)
    .eq('status', 'Published');

  if (activeTopic) {
    qb = qb.contains('domain_tags', [activeTopic]);
  }
  if (activeSkill) {
    qb = qb.eq('skill_level', activeSkill);
  }

  const { data, error } = await qb
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });
  if (error) {
    console.error('[data.server] searchPostsLite error:', error.message);
    return [];
  }

  let results = (data || []).map(mapPostRowLite);

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.excerpt || '').toLowerCase().includes(q) ||
      p.domain_tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return results;
});

/** Pure computation — no DB needed */
export function getCourseMatch(tags) {
  if (!tags || tags.length === 0) return courses[0];
  const getOverlap = (a, b) => a.filter(t => b.includes(t)).length;
  let best = courses[0], high = -1;
  for (const c of courses) {
    const score = getOverlap(c.domain_tags, tags);
    if (score > high) { high = score; best = c; }
  }
  return best;
}

/** Get all authors from Supabase (falls back to static).
 *  Cached per-request so callers like the author page + nav don't double-fetch. */
export const getAuthors = cache(async function getAuthors() {
  try {
    const { data, error } = await supabase.from('authors').select('*');
    if (error || !data?.length) return staticAuthors;
    return Object.fromEntries(data.map(a => [a.slug, a]));
  } catch {
    return staticAuthors;
  }
});

// Re-export static helpers so server components only need one import
export { courses, salaryData };
export const authors = staticAuthors;
