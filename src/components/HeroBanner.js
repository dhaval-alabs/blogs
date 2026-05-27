"use client";

import Link from "next/link";
import Image from "next/image";
import { parseReadTime } from "@/lib/readTime";

export default function HeroBanner({ post }) {
  if (!post) return null;

  const readMins = parseReadTime(post.readTime);

  return (
    <section
      className="mt-16 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#003369 60%,#001f4d 100%)" }}
    >
      {/* Subtle grid texture overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)," +
            "radial-gradient(circle at 80% 20%, rgba(100,160,255,0.06) 0%, transparent 50%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative" style={{ zIndex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "48px",
            alignItems: "center",
            minHeight: 420,
            padding: "48px 0",
          }}
          className="hero-split-grid"
        >
          {/* ── Left: post details ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Category / badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="glass-badge" style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                {post.category || "Featured Analysis"}
              </span>
              {post.domain_tags?.[0] && post.domain_tags[0] !== post.category && (
                <span className="glass-badge" style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  opacity: 0.85,
                }}>
                  {post.domain_tags[0]}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              style={{
                fontWeight: 900,
                fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
                lineHeight: 1.15,
                color: "#fff",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              <Link
                href={`/blog/${post.slug}`}
                style={{ color: "inherit", textDecoration: "none" }}
                className="hover:opacity-90 transition-opacity"
              >
                {post.title}
              </Link>
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p style={{
                color: "rgba(186,210,255,0.9)",
                fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                lineHeight: 1.7,
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {post.excerpt}
              </p>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, color: "rgba(186,210,255,0.75)", fontSize: 13 }}>
              {readMins > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                  <span style={{ fontWeight: 700 }}>{readMins} min read</span>
                </span>
              )}
              {post.author?.name && (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                  <span>{post.author.name}</span>
                </span>
              )}
              {(post.publishedAt || post.updatedAt) && (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
                  <span>{post.publishedAt || post.updatedAt}</span>
                </span>
              )}
            </div>

            {/* CTA */}
            <div style={{ marginTop: 4 }}>
              <Link
                href={`/blog/${post.slug}`}
                className="glass-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 28px",
                  borderRadius: 99,
                  fontWeight: 800,
                  fontSize: 14,
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                }}
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
              <div
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  aspectRatio: "16 / 10",
                  position: "relative",
                  boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
                  background: "linear-gradient(135deg,#0d2f5e,#001533)",
                }}
              >
                {post.image ? (
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    quality={80}
                    style={{ objectFit: "cover", transition: "transform 0.5s ease" }}
                    className="hero-img-hover"
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    background: "linear-gradient(135deg,rgba(100,160,255,0.12),rgba(0,80,200,0.08))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 56, color: "rgba(255,255,255,0.15)" }}>article</span>
                  </div>
                )}

                {/* Subtle gradient overlay at bottom for legibility */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: "35%",
                  background: "linear-gradient(to top, rgba(0,20,60,0.55), transparent)",
                  pointerEvents: "none",
                }} />
              </div>
            </Link>

            {/* Decorative glow behind the card */}
            <div aria-hidden="true" style={{
              position: "absolute", top: "10%", left: "5%", right: "5%", bottom: "10%",
              background: "rgba(100,160,255,0.12)",
              borderRadius: 24,
              filter: "blur(40px)",
              zIndex: -1,
            }} />
          </div>
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
            padding: 40px 0 32px !important;
          }
        }
        .hero-img-hover:hover {
          transform: scale(1.03);
        }
      `}</style>
    </section>
  );
}
