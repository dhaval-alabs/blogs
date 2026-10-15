import { supabase, getServiceClient } from '@/lib/supabase';
import { getAllMdxPosts } from '@/lib/mdx-posts';
import { BRIEF_EXACT_REDIRECTS, GSC_RESIDUAL_REDIRECTS } from '@/lib/infrastructure/hardcoded-redirects';

export const revalidate = 3600;

const SITE_ORIGIN = 'https://www.analytixlabs.co.in';

// Top-traffic evergreen slugs — populate from GA4 audit. Listed slugs get priority 0.9.
const PILLAR_SLUGS = new Set([]);

// Drop slugs that look like timestamp-suffixed duplicates (e.g. "data-science-and-ai-1777560853996").
const DUP_SUFFIX_RE = /-\d{10,}$/;

function tierFor(year, slug) {
  if (PILLAR_SLUGS.has(slug)) {
    return { priority: 0.9, changeFrequency: 'weekly' };
  }
  if (year >= 2024) return { priority: 0.8, changeFrequency: 'weekly' };
  if (year >= 2022) return { priority: 0.7, changeFrequency: 'monthly' };
  if (year >= 2020) return { priority: 0.5, changeFrequency: 'monthly' };
  return { priority: 0.3, changeFrequency: 'yearly' };
}

function toEntry(slug, lastModSource) {
  const lastModified = lastModSource ? new Date(lastModSource) : new Date();
  const year = isNaN(lastModified) ? new Date().getFullYear() : lastModified.getFullYear();
  return {
    url: `${SITE_ORIGIN}/blog/${slug}/`,
    lastModified: isNaN(lastModified) ? new Date() : lastModified,
    ...tierFor(year, slug),
  };
}

// Reduce a redirect `source` (as stored in the Supabase `redirects` table) to
// a normalized "/blog/<slug>" path with no trailing slash, so it can be
// compared against a post's own path regardless of how it was entered —
// some legacy rows store a full URL instead of a path (a data-entry bug
// pre-dating saveRedirect()'s own normalizeSource()), and at least one row
// has a stray trailing slash. Returns null for anything that isn't a
// /blog/<slug>-shaped path (dated WP permalinks, root-level redirects, etc. —
// those can never collide with a post's own sitemap entry anyway).
function normalizeRedirectSource(source) {
  if (!source) return null;
  let s = source.trim();
  if (s.startsWith('http')) {
    try { s = new URL(s).pathname; } catch { return null; }
  }
  if (!s.startsWith('/')) s = `/${s}`;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  if (!s.startsWith('/blog/')) return null;
  return s;
}

// A post whose own canonical points somewhere else has effectively been
// superseded (consolidated into another post) even when its row is still
// Published and nothing redirects it yet — only the canonical destination
// belongs in the sitemap.
function hasForeignCanonical(slug, canonicalUrl) {
  if (!canonicalUrl) return false;
  const selfUrl = `${SITE_ORIGIN}/blog/${slug}/`;
  return canonicalUrl.replace(/\/+$/, '') !== selfUrl.replace(/\/+$/, '');
}

export default async function sitemap() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('slug, updated_at, seo')
    .eq('status', 'Published')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[sitemap] Supabase error:', error.message);
  }

  // Active redirect sources (CMS-managed) — same table src/proxy.js reads via
  // lookupRedirect(). Combined with the hardcoded code-level redirect maps so
  // a redirect added in proxy.js without a matching Supabase row doesn't
  // silently reintroduce the same "sitemap lists a 301" bug.
  // Needs the service-role client: this table has RLS blocking anon reads
  // (same reason src/lib/infrastructure/redirects.js's own read path uses
  // getServiceClient() instead of the plain anon `supabase` export) — with
  // the anon client this silently returns zero rows, no error, rather than
  // failing loudly.
  const { data: redirectRows, error: redirectsError } = await getServiceClient()
    .from('redirects')
    .select('source')
    .eq('active', true);

  if (redirectsError) {
    console.error('[sitemap] redirects lookup error:', redirectsError.message);
  }

  const redirectedPaths = new Set([
    ...Object.keys(BRIEF_EXACT_REDIRECTS),
    ...Object.keys(GSC_RESIDUAL_REDIRECTS),
  ]);
  for (const row of redirectRows || []) {
    const normalized = normalizeRedirectSource(row.source);
    if (normalized) redirectedPaths.add(normalized);
  }

  const seen = new Set();
  const entries = [
    {
      url: `${SITE_ORIGIN}/blog/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  for (const post of posts || []) {
    if (!post.slug || seen.has(post.slug)) continue;
    if (DUP_SUFFIX_RE.test(post.slug)) continue;
    if (redirectedPaths.has(`/blog/${post.slug}`)) continue;
    if (hasForeignCanonical(post.slug, post.seo?.canonicalUrl)) continue;
    seen.add(post.slug);
    entries.push(toEntry(post.slug, post.updated_at));
  }

  for (const mdx of getAllMdxPosts()) {
    if (!mdx.slug || seen.has(mdx.slug)) continue;
    if (DUP_SUFFIX_RE.test(mdx.slug)) continue;
    if (redirectedPaths.has(`/blog/${mdx.slug}`)) continue;
    if (hasForeignCanonical(mdx.slug, mdx.canonical)) continue;
    seen.add(mdx.slug);
    entries.push(toEntry(mdx.slug, mdx.modified || mdx.date));
  }

  return entries;
}
