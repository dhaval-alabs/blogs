import { getPostBySlug, getRecommendations, getCourseMatch, getAuthorPostCount, isCategorySlug, getCategoryPosts } from "@/lib/data.server";
import { getSiteConfig } from "@/lib/site-config.server";
import { notFound } from "next/navigation";
import ArticleContent from "./ArticleContent";
import CategoryView from "@/components/CategoryView";
import { SITE_NAME } from "@/lib/config";
import { getMdxPostBySlug, mdxToHtml, mapMdxToPost } from "@/lib/mdx-posts";
import { getRedirectMap } from "@/lib/infrastructure/redirects";
import { buildRedirectLookup, normalizeArticleHtml } from "@/lib/domain/posts/link-normalizer";

export const revalidate = 600; // 10 min ISR — articles rarely change; bots were thrashing at 60s

// Below this many posts, a tag/category archive is thin enough that Google
// tends to override its canonical in favor of one of the underlying posts
// (seen on /blog/tableau/, /blog/r/, /blog/python/, etc). noindex it until
// it accumulates enough posts to stand on its own.
const THIN_CATEGORY_POST_THRESHOLD = 5;

/** Generate dynamic SEO metadata for each article */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  let post = await getPostBySlug(slug);

  // MDX fallback
  if (!post) {
    const mdxPost = getMdxPostBySlug(slug);
    if (mdxPost) {
      return {
        title: `${mdxPost.title} | ${SITE_NAME}`,
        description: mdxPost.description || mdxPost.title,
        openGraph: {
          title: mdxPost.title,
          description: mdxPost.description || mdxPost.title,
          type: "article",
          publishedTime: mdxPost.date,
          images: mdxPost.featuredImage ? [{ url: mdxPost.featuredImage }] : [],
        },
        alternates: { canonical: mdxPost.canonical || undefined },
      };
    }
    if (await isCategorySlug(slug)) {
      const label = slug.replace(/-/g, " ");
      const categoryPosts = await getCategoryPosts(slug);
      const isThin = categoryPosts.length < THIN_CATEGORY_POST_THRESHOLD;
      return {
        title: `${label.replace(/\b\w/g, (c) => c.toUpperCase())} | ${SITE_NAME}`,
        description: `Articles in ${label}`,
        alternates: { canonical: `https://www.analytixlabs.co.in/blog/${slug}/` },
        robots: isThin ? { index: false, follow: true } : undefined,
      };
    }
    return { title: "Article Not Found" };
  }

  const seo = post.seo || {};
  const canonical = seo.canonicalUrl || `https://www.analytixlabs.co.in/blog/${post.slug}/`;
  const title = seo.metaTitle || `${post.title} | ${SITE_NAME}`;
  const description = seo.metaDesc || post.excerpt || post.title;
  const image = seo.ogImage || post.image;

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: !seo.noIndex,
      follow: !seo.noIndex,
    },
    openGraph: {
      title: seo.metaTitle || post.title,
      description: seo.metaDesc || post.excerpt || post.title,
      type: "article",
      publishedTime: toISO(post.publishedAtISO) || post.publishedAt,
      modifiedTime: lastModifiedISO(post) || post.publishedAt,
      images: image ? [{ url: image }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle || post.title,
      description: seo.metaDesc || post.excerpt || post.title,
      images: image ? [image] : [],
    },
  };
}

/**
 * Extracts FAQ pairs from HTML content.
 *
 * Logic: scan every element in the post body. When a heading (h2/h3/h4)
 * or bold paragraph ends with "?", treat it as a Question. The very next
 * sibling paragraph's text becomes the Answer. These pairs are assembled
 * into a schema.org FAQPage JSON-LD block that Google uses to display
 * "People Also Ask" rich results in search.
 */
function extractFaqJsonLd(htmlContent, slug = "") {
  // Parse on the server using a simple regex-based approach (no DOM available)
  const pairs = [];
  // Match heading or <p><strong>...</strong></p> patterns ending with "?"
  const questionRe = /<(?:h[2-4]|p)[^>]*>((?:<[^>]+>)*)(.*?\?)((?:<\/[^>]+>)*)<\/(?:h[2-4]|p)>/gi;
  // Split content into segments to find the paragraph after each question
  const segments = htmlContent.split(/(?=<(?:h[2-4]|p)[^>]*>)/i);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const stripped = seg.replace(/<[^>]+>/g, '').trim();
    if (!stripped.endsWith('?')) continue;
    if (stripped.length < 5) continue;

    // Find next paragraph segment for the answer
    let answer = '';
    for (let j = i + 1; j < segments.length; j++) {
      const nextStripped = segments[j].replace(/<[^>]+>/g, '').trim();
      if (nextStripped) { answer = nextStripped; break; }
    }

    if (answer) {
      pairs.push({ question: stripped, answer });
    }
  }

  if (pairs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `https://www.analytixlabs.co.in/blog/${slug}/#faq`,
    mainEntity: pairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

// ── schema.org JSON-LD ──────────────────────────────────────────────
// Canonical host for every schema URL — always the public www host, never
// the blog. origin (matches generateMetadata + the site canonical).
const SITE_ORIGIN = "https://www.analytixlabs.co.in";

/** Normalize any date-ish value to an ISO 8601 string, or null. */
function toISO(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Last significant edit (updated_at), falling back to the publish date. */
function lastModifiedISO(post) {
  return toISO(post.updatedAtISO) || toISO(post.publishedAtISO);
}

/** BlogPosting schema — rich-result eligibility + author/publisher/date signals. */
function buildArticleJsonLd(post) {
  const url = post.seo?.canonicalUrl || `${SITE_ORIGIN}/blog/${post.slug}/`;
  const image = post.seo?.ogImage || post.image || null;
  const datePublished = toISO(post.publishedAtISO);
  // updated_at only moves on a "Significant update" save, so it's safe to
  // advertise as dateModified (Google wants it to track real content edits).
  const dateModified = lastModifiedISO(post);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.seo?.metaTitle || post.title,
    description: post.seo?.metaDesc || post.excerpt || post.title,
    ...(image ? { image: [image] } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: { "@type": "Person", name: post.author?.name || SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: "AnalytixLabs",
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/blog/logo.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

/** BreadcrumbList schema: Home › Blog › <post>. */
function buildBreadcrumbJsonLd(post) {
  const url = post.seo?.canonicalUrl || `${SITE_ORIGIN}/blog/${post.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog/` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };
}

const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

/**
 * Redirects used to normalise internal links in post bodies: the static map
 * (main-site pages + Cloudflare /blog/ redirects) plus active /blog/ rows from
 * the redirects table. The table's other rows are left out on purpose: only
 * /blog/ paths reach this app, and the live main site doesn't follow those
 * rows (many 404 or go elsewhere), so rewriting links to them would be wrong.
 */
async function getContentRedirectLookup() {
  const map = (await getRedirectMap({ next: { revalidate } })) || {};
  const blogRows = {};
  for (const [source, row] of Object.entries(map)) {
    let path = source;
    if (/^https?:\/\//i.test(path)) {
      try { path = new URL(path).pathname; } catch { continue; }
    }
    if (!path.startsWith("/blog/")) continue;
    if (!REDIRECT_STATUSES.has(Number(row?.type) || 301)) continue;
    blogRows[path] = row.destination;
  }
  return buildRedirectLookup(blogRows);
}

/** Serialize JSON-LD for safe inlining in a <script> tag (escape `<`). */
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  let post = await getPostBySlug(slug);

  // MDX fallback — try WordPress-migrated posts if not in Supabase
  if (!post) {
    const mdxPost = getMdxPostBySlug(slug);
    if (mdxPost) {
      const htmlContent = await mdxToHtml(mdxPost.content);
      post = mapMdxToPost(mdxPost, htmlContent);
    }
  }

  if (!post) {
    if (await isCategorySlug(slug)) {
      const initialPosts = await getCategoryPosts(slug);
      return <CategoryView categorySlug={slug} initialPosts={initialPosts} />;
    }
    notFound();
  }

  const [recommendedArticles, courseMatch, authorPostCount, siteConfig, redirectLookup] = await Promise.all([
    getRecommendations(slug, 3, post.domain_tags ?? null, post.skill_level ?? null),
    Promise.resolve(getCourseMatch(post.domain_tags)),
    getAuthorPostCount(post.authorId),
    getSiteConfig(),
    getContentRedirectLookup(),
  ]);

  // Render-time only: stored content is untouched. Internal links stop
  // hitting redirects, and in-body <h1>s become <h2> (the title is the h1).
  post = { ...post, content: normalizeArticleHtml(post.content, redirectLookup) };

  const faqJsonLd = post.discussion?.faqSchema && post.content
    ? extractFaqJsonLd(post.content, post.slug)
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(buildArticleJsonLd(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(buildBreadcrumbJsonLd(post)) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }}
        />
      )}
      <ArticleContent post={post} recommendedArticles={recommendedArticles} courseMatch={courseMatch} authorPostCount={authorPostCount} sidebarWidgets={siteConfig.zones.article_sidebar} />
    </>
  );
}
