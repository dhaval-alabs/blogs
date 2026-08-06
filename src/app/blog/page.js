import { searchPostsLite } from "@/lib/data.server";
import { getSiteConfig } from "@/lib/site-config.server";
import { FEATURED_AUTHOR_SLUG } from "@/lib/config";
import BlogPageClient from "./BlogPageClient";

// Revalidate the SSR payload every 5 minutes (same cadence as /api/site-config/blog-page).
// Static generation keeps TTFB low; stale-while-revalidate handles freshness.
export const revalidate = 300;

const SITE_ORIGIN = "https://www.analytixlabs.co.in";

// Distinct from the root layout's brand-only default title/description, and
// topically matched to the H1 every visitor actually sees here (the latest
// featured post's headline is always a data-science/AI article title).
const BLOG_TITLE = "Data Science & AI Blog | Tutorials, Career Guides & Industry Insights";
const BLOG_DESCRIPTION =
  "Tutorials, career guides, and industry analysis on data science, machine learning, and AI — written for students, working professionals, and career switchers by AnalytixLabs instructors and practitioners.";

export const metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/blog/` },
  openGraph: {
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/blog/`,
  },
  twitter: {
    card: "summary_large_image",
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
  },
};

// Single source of truth for the visible FAQ block rendered in BlogPageClient
// AND the FAQPage schema below — schema must mirror on-page content exactly.
export const BLOG_FAQS = [
  {
    question: "What topics does the AnalytixLabs blog cover?",
    answer:
      "Data science, machine learning, artificial intelligence, and analytics — spanning beginner tutorials, career and certification guides, and analysis of industry trends and tools.",
  },
  {
    question: "Who is this blog for?",
    answer:
      "Students exploring a data science career, working professionals upskilling in ML/AI, and career switchers evaluating whether analytics is the right path for them.",
  },
  {
    question: "Is the content free to read?",
    answer:
      "Yes. Every article on this blog is free to read, with optional links to AnalytixLabs' paid courses for readers who want structured, instructor-led training.",
  },
  {
    question: "How do I find articles on a specific topic?",
    answer:
      "Use the topic and skill-level filters above the article grid, or the category links in the sidebar, to narrow the list down to what you're looking for.",
  },
];

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

const BREADCRUMB_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog/` },
  ],
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_ORIGIN}/blog/#faq`,
  mainEntity: BLOG_FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

/** Blog schema + up to 12 most recent posts as an ItemList — the correct
 * schema.org type for a listing/index page (individual posts already carry
 * their own BlogPosting schema on /blog/[slug]/). */
function buildBlogJsonLd(posts) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_ORIGIN}/blog/#blog`,
    name: "AnalytixLabs Editorial",
    url: `${SITE_ORIGIN}/blog/`,
    description: BLOG_DESCRIPTION,
    publisher: { "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization` },
    blogPost: posts.slice(0, 12).map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_ORIGIN}/blog/${p.slug}/`,
    })),
  };
}

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(buildBlogJsonLd(posts)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(BREADCRUMB_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(FAQ_JSON_LD) }}
      />
      <BlogPageClient
        initialPosts={posts}
        initialBlogConfig={blogConfig}
        initialAuthorPostCount={authorPostCount}
        initialSpotlight={spotlight}
        faqs={BLOG_FAQS}
      />
    </>
  );
}
