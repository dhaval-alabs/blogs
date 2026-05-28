import { getPostBySlug, getRecommendations, getCourseMatch, getAuthorPostCount, isCategorySlug, getCategoryPosts } from "@/lib/data.server";
import { getSiteConfig } from "@/lib/site-config.server";
import { notFound } from "next/navigation";
import ArticleContent from "./ArticleContent";
import CategoryView from "@/components/CategoryView";
import { SITE_NAME } from "@/lib/config";
import { getMdxPostBySlug, mdxToHtml, mapMdxToPost } from "@/lib/mdx-posts";

export const revalidate = 600; // 10 min ISR — articles rarely change; bots were thrashing at 60s

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
      return {
        title: `${label.replace(/\b\w/g, (c) => c.toUpperCase())} | ${SITE_NAME}`,
        description: `Articles in ${label}`,
        alternates: { canonical: `https://www.analytixlabs.co.in/blog/${slug}/` },
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
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
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

  const [recommendedArticles, courseMatch, authorPostCount, siteConfig] = await Promise.all([
    getRecommendations(slug, 3, post.domain_tags ?? null, post.skill_level ?? null),
    Promise.resolve(getCourseMatch(post.domain_tags)),
    getAuthorPostCount(post.authorId),
    getSiteConfig(),
  ]);

  const faqJsonLd = post.discussion?.faqSchema && post.content
    ? extractFaqJsonLd(post.content, post.slug)
    : null;

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <ArticleContent post={post} recommendedArticles={recommendedArticles} courseMatch={courseMatch} authorPostCount={authorPostCount} sidebarWidgets={siteConfig.zones.article_sidebar} />
    </>
  );
}
