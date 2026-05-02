import { supabase } from '@/lib/supabase';
import { getAllMdxPosts } from '@/lib/mdx-posts';

export const revalidate = 3600;

const SITE_ORIGIN = 'https://www.analytixlabs.co.in';

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
    seen.add(post.slug);
    entries.push({
      url: `${SITE_ORIGIN}/blog/${post.slug}/`,
      lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const mdx of getAllMdxPosts()) {
    if (!mdx.slug || seen.has(mdx.slug)) continue;
    seen.add(mdx.slug);
    const last = mdx.modified || mdx.date;
    entries.push({
      url: `${SITE_ORIGIN}/blog/${mdx.slug}/`,
      lastModified: last ? new Date(last) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  return entries;
}
