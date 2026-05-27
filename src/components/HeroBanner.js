"use client";

import Link from "next/link";
import Image from "next/image";
import { parseReadTime } from "@/lib/readTime";

export default function HeroBanner({ post }) {
  if (!post) return null;

  const readMins = parseReadTime(post.readTime);

  return (
    <section className="mt-16 relative overflow-hidden bg-white dark:bg-[#0b1326]">

      <div className="max-w-7xl mx-auto px-6">
        <div className="hero-split-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center", minHeight: 420, padding: "48px 0" }}>

          {/* ── Left: post details ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-[#e8f0fe] text-[#1a56db] border border-[#c3d9ff] dark:bg-[#1e3a5f] dark:text-[#adc6ff] dark:border-[#2d5080]">
                {post.category || "Featured Analysis"}
              </span>
              {post.domain_tags?.[0] && post.domain_tags[0] !== post.category && (
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] dark:bg-[#1e293b] dark:text-[#8c909f] dark:border-[#2d3748]">
                  {post.domain_tags[0]}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-[#0f172a] dark:text-[#dae2fd] font-black leading-tight tracking-tight m-0"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}>
              <Link
                href={`/blog/${post.slug}`}
                className="hover:opacity-80 transition-opacity"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {post.title}
              </Link>
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-[#475569] dark:text-[#c2c6d6] leading-relaxed m-0"
                style={{
                  fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                {post.excerpt}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-5 text-[#64748b] dark:text-[#8c909f] text-[13px]">
              {readMins > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span className="font-bold">{readMins} min read</span>
                </span>
              )}
              {post.author?.name && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">person</span>
                  <span>{post.author.name}</span>
                </span>
              )}
              {(post.publishedAt || post.updatedAt) && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  <span>{post.publishedAt || post.updatedAt}</span>
                </span>
              )}
            </div>

            {/* CTA */}
            <div style={{ marginTop: 4 }}>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-black text-sm no-underline transition-opacity hover:opacity-90 bg-[#003369] text-white dark:bg-[#adc6ff] dark:text-[#0b1326]"
              >
                Read Article
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* ── Right: featured image card ── */}
          <div style={{ position: "relative" }}>
            <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
              <div className="rounded-3xl overflow-hidden bg-[#f1f5f9] dark:bg-[#131b2e]"
                style={{
                  aspectRatio: "16 / 10",
                  position: "relative",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
                }}>
                {post.image ? (
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    quality={85}
                    style={{ objectFit: "contain", transition: "transform 0.5s ease" }}
                    className="hero-img-hover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#cbd5e1] dark:text-[#334155]" style={{ fontSize: 56 }}>article</span>
                  </div>
                )}
              </div>
            </Link>

            {/* Decorative shadow behind the card */}
            <div aria-hidden="true" className="absolute rounded-3xl bg-[#003369]/[0.07] dark:bg-[#adc6ff]/[0.05]"
              style={{ top: "8%", left: "4%", right: "4%", bottom: "-4%", filter: "blur(28px)", zIndex: -1 }} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
            padding: 36px 0 28px !important;
          }
        }
        .hero-img-hover:hover { transform: scale(1.03); }
      `}</style>
    </section>
  );
}
