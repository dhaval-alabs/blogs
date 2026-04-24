import { searchPostsLite } from "@/lib/data.server";
import { getSiteConfig } from "@/lib/site-config.server";
import { FEATURED_AUTHOR_SLUG } from "@/lib/config";
import BlogPageClient from "./BlogPageClient";

// Revalidate the SSR payload every 5 minutes (same cadence as /api/site-config/blog-page).
// Static generation keeps TTFB low; stale-while-revalidate handles freshness.
export const revalidate = 300;

export default async function BlogPage() {
  // Fetch initial payload on the server in parallel — eliminates the old
  // "render spinner → fetch /api/posts → paint hero" waterfall that was
  // pushing LCP to 15.8s on mobile.
  const [posts, siteConfig] = await Promise.all([
    searchPostsLite().catch(() => []),
    getSiteConfig().catch(() => ({ zones: { blog_page: { featured_slugs: [], carousels: [] } } })),
  ]);

  const blogConfig = {
    featured_slugs: siteConfig?.zones?.blog_page?.featured_slugs ?? [],
    carousels: siteConfig?.zones?.blog_page?.carousels ?? [],
    categories_widget: siteConfig?.zones?.blog_page?.categories_widget ?? null,
  };

  // Featured-author derivation (previously done client-side after the fetch).
  const featuredPostsByAuthor = posts.filter((p) => p.authorId === FEATURED_AUTHOR_SLUG);
  const authorPostCount = featuredPostsByAuthor.length;
  const spotlight =
    featuredPostsByAuthor[0]?.author ||
    posts.find((p) => p.author)?.author ||
    null;

  return (
    <BlogPageClient
      initialPosts={posts}
      initialBlogConfig={blogConfig}
      initialAuthorPostCount={authorPostCount}
      initialSpotlight={spotlight}
    />
  );
}
