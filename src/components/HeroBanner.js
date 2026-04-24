"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Hero banner for the homepage and blog listing page.
 *
 * @param {{ post: object|null, bookmarked?: boolean, onToggleBookmark?: (slug:string)=>void }} props
 */
export default function HeroBanner({ post, bookmarked = false, onToggleBookmark }) {
  if (!post) return null;

  return (
    <section
      className="mt-16 pt-12 pb-16 relative overflow-hidden min-h-[360px] sm:min-h-[420px]"
      style={{ background: "linear-gradient(135deg,#003369 57%,#001f4d 100%)" }}
    >
      {/* Featured image as background — served via next/image for automatic AVIF/WebP,
          responsive sizing, and long cache headers. This is the LCP element on the
          blog listing, so we mark it priority + fetchPriority="high". */}
      {post.image && (
        <Image
          src={post.image}
          alt=""
          aria-hidden="true"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={55}
          style={{
            objectFit: "cover",
            objectPosition: "center center",
            opacity: 0.3,
            zIndex: 0,
            filter: "blur(5px)",
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-6 relative" style={{ zIndex: 1 }}>
        <div className="max-w-3xl">
          <span className="glass-badge inline-block mb-5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest">
            Featured Analysis
          </span>
          <h1 className="font-[family-name:var(--font-headline)] font-extrabold text-4xl md:text-5xl text-white leading-tight mb-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-blue-100 text-base leading-relaxed mb-6 max-w-xl line-clamp-2">
              {post.excerpt}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-8 text-blue-200 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {post.readTime}
            </span>
            {post.domain_tags?.[0] && (
              <span className="glass-badge px-2.5 py-1 rounded-full text-xs font-medium">
                {post.domain_tags[0]}
              </span>
            )}
            {post.updatedAt && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                Updated {post.updatedAt}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/blog/${post.slug}`}
              className="glass-btn px-6 py-3 rounded-full font-bold text-sm"
              aria-label={`Read the full article: ${post.title}`}
            >
              Read More
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
