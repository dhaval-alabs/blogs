import { supabase } from '@/lib/supabase';
import { getAllMdxPosts } from '@/lib/mdx-posts';

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

export default async function sitemap() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('slug, updated_at')
    .eq('status', 'Published')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[sitemap] Supabase error:', error.message);
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
    seen.add(post.slug);
    entries.push(toEntry(post.slug, post.updated_at));
  }

  for (const mdx of getAllMdxPosts()) {
    if (!mdx.slug || seen.has(mdx.slug)) continue;
    if (DUP_SUFFIX_RE.test(mdx.slug)) continue;
    seen.add(mdx.slug);
    entries.push(toEntry(mdx.slug, mdx.modified || mdx.date));
  }

  return entries;
}
