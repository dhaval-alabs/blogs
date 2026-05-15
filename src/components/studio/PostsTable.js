"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { I } from "./StudioIcons";
import {
  countWords,
  countInternalLinks,
  countExternalLinks,
  computeKeywordDensity,
  computeSeoScore,
} from "@/lib/domain/posts/seo-utils";

const POSTS_PER_PAGE = 25;

// ── CSV helpers ──────────────────────────────────────────────────
function escapeCsv(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(html) {
  const text = stripHtml(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function formatBlogDate(dateStr, style = "short") {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (style === "long") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch { return dateStr; }
}

function countInternalLinks(html) {
  if (!html) return 0;
  const linkMatches = html.matchAll(/<a [^>]*href=["']([^"']+)["'][^>]*>/gi);
  let count = 0;
  const internalDomains = ["analytixlabs.co.in", "localhost"];
  for (const match of linkMatches) {
    const href = match[1];
    if (href.startsWith("/") || href.startsWith("#") || internalDomains.some((d) => href.includes(d))) count++;
  }
  const widgetMatches = html.matchAll(/data-widget=["']coursematch["']/gi);
  for (const _ of widgetMatches) count++;
  return count;
}

function countExternalLinks(html) {
  if (!html) return 0;
  const internalDomains = ["analytixlabs.co.in", "localhost"];
  const hrefMatches = [...html.matchAll(/\bhref=["']([^"']+)["']/gi)];
  let count = 0;
  for (const match of hrefMatches) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (href.startsWith("/") || internalDomains.some((d) => href.includes(d))) continue;
    if (/^https?:\/\//i.test(href)) count++;
  }
  return count;
}

function computeKeywordDensity(html, focusKeyword) {
  if (!focusKeyword || !html) return "";
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return "";
  const escaped = focusKeyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return parseFloat((((matches ? matches.length : 0) / words) * 100).toFixed(1));
}

function computeSeoScore(p) {
  const seo = p.seo || {};
  const kw = (seo.focusKeyword || "").toLowerCase().trim();
  const metaTitle = (seo.metaTitle || p.title || "").toLowerCase();
  const metaDesc = seo.metaDesc || p.excerpt || "";
  const wordCount = countWords(p.content);
  const internalLinks = countInternalLinks(p.content);
  const density = kw && wordCount > 0 ? parseFloat(computeKeywordDensity(p.content, kw)) : 0;
  const checks = [
    kw && metaTitle.includes(kw),
    metaDesc.length >= 50,
    density >= 0.5 && density <= 3,
    (p.altText || p.alt_text || "").trim().length >= 5,
    internalLinks >= 2,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function isoToDateOnly(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  } catch { return dateStr; }
}

function buildSeoCsv(posts) {
  const headers = [
    "id", "title", "slug", "status", "topic", "tags", "author",
    "publishedAt", "updatedAt", "wordCount", "focusKeyword",
    "metaTitle", "metaDescription", "urlSlug",
    "internalLinksCount", "externalLinksCount", "keywordDensity", "seoScore",
  ];

  const rows = posts.map((p) => {
    const seo = p.seo || {};
    const wordCount = countWords(p.content);
    const internalLinks = countInternalLinks(p.content);
    const externalLinks = countExternalLinks(p.content);
    const density = computeKeywordDensity(p.content, seo.focusKeyword || "");
    const score = computeSeoScore(p);

    return [
      p.id,
      p.title || "",
      p.slug || "",
      p.status || "Draft",
      p.category || "",
      (p.domain_tags || []).join("|"),
      p.authorId || p.author_id || "",
      isoToDateOnly(p.publishedAt || p.published_at || ""),
      isoToDateOnly(p.updatedAt || p.updated_at || ""),
      wordCount,
      seo.focusKeyword || "",
      seo.metaTitle || p.title || "",
      seo.metaDesc || p.excerpt || "",
      p.slug ? `/article/${p.slug}` : "",
      internalLinks,
      externalLinks,
      density,
      score,
    ];
  });

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  return csvContent;
}

function downloadCsv(csvContent, filename) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PostsTable({ allPosts, clearEditor, loadPostForEdit, handleDeletePost, setPostsViewMode, onToggleStatus, onShowVersions }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter posts by search + status
  const filtered = useMemo(() => {
    let posts = allPosts;
    if (statusFilter !== "All") {
      posts = posts.filter((p) => (p.status || "Draft") === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      posts = posts.filter((p) => {
        const tagMatch = (p.domain_tags || []).some((t) => (t || "").toLowerCase().includes(q));
        return (
          (p.title || "").toLowerCase().includes(q) ||
          (p.slug || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.excerpt || "").toLowerCase().includes(q) ||
          (p.authorId || "").toLowerCase().includes(q) ||
          tagMatch
        );
      });
    }
    return posts;
  }, [allPosts, search, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * POSTS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + POSTS_PER_PAGE);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const statusCounts = useMemo(() => {
    const counts = { All: allPosts.length, Published: 0, Draft: 0, Scheduled: 0 };
    for (const p of allPosts) {
      const s = p.status || "Draft";
      if (counts[s] !== undefined) counts[s]++;
    }
    return counts;
  }, [allPosts]);

  const handleExportCsv = useCallback(() => {
    const data = filtered.length > 0 ? filtered : allPosts;
    const csv = buildSeoCsv(data);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `analytixlabs-blog-export-${dateSuffix}.csv`);
  }, [filtered, allPosts, statusFilter]);

  return (
    <div className="editor-pane">
      <div className="posts-view">
        <div className="posts-header">
          <span className="posts-title">
            All Posts ({allPosts.length})
            {search && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "var(--text3, #999)" }}>
                — {filtered.length} match{filtered.length !== 1 ? "es" : ""} for "{search}"
              </span>
            )}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="posts-export-btn"
              onClick={handleExportCsv}
              title={`Export ${filtered.length} post${filtered.length !== 1 ? "s" : ""} as CSV for SEO`}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px",
                background: "var(--bg)",
                color: "var(--text2)", border: "1px solid var(--border2)",
                borderRadius: "var(--radius)",
                fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "var(--font-body)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg3)"; e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text2)"; }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <path d="M8 2v9M4.5 7.5 8 11l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              CSV Export
            </button>
            <button className="posts-new-btn" onClick={() => { clearEditor(); setPostsViewMode("editor"); }}>
              + NEW POST
            </button>
          </div>
        </div>

        {/* Search + Status filters */}
        <div className="posts-filters" style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 320px", minWidth: 240 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text3, #999)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts by title, slug, category, excerpt, tags, or author…"
              style={{
                width: "100%",
                padding: "9px 36px 9px 36px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                title="Clear search"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer", padding: 4,
                  color: "var(--text3, #999)", display: "flex", alignItems: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", "Published", "Draft", "Scheduled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: statusFilter === s ? "var(--accent, #003b93)" : "var(--surface)",
                  color: statusFilter === s ? "#fff" : "var(--text2, #666)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s} ({statusCounts[s] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: "var(--text3)", fontSize: 13, padding: "24px 0" }}>
            {allPosts.length === 0 ? "No posts found. Create your first post!" : "No posts match your filters."}
          </p>
        ) : (
          <>
            <div className="posts-table-wrap">
              <table className="posts-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>Post</th>
                    <th>Title</th>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ width: 52, textAlign: "center" }}>Toggle</th>
                    <th style={{ width: 52, textAlign: "center" }}>History</th>
                    <th style={{ width: 36, textAlign: "center" }}>Edit</th>
                    <th style={{ width: 36, textAlign: "center" }}>View</th>
                    <th style={{ width: 36, textAlign: "center" }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => {
                    const statusCls = p.status === "Published" ? "s-published" : p.status === "Scheduled" ? "s-scheduled" : "s-draft";
                    return (
                      <tr key={p.id}>
                        <td>{p.image ? <img src={p.image} alt={p.altText || p.alt_text || ""} className="post-thumb" /> : <div className="post-thumb-ph" />}</td>
                        <td>
                          <div className="post-row-title">{p.title || "Untitled"}</div>
                          <div className="post-row-topic">{p.category}</div>
                        </td>
                        <td><span style={{ fontSize: 12, color: "var(--text3)" }}>{p.category}</span></td>
                        <td><span className={`status-badge ${statusCls}`}>{p.status || "Draft"}</span></td>
                        <td><span className="post-date">{formatBlogDate(p.publishedAt || p.published_at) || "—"}</span></td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className={`post-status-toggle ${p.status === "Published" ? "is-pub" : "is-draft"}`}
                            onClick={() => onToggleStatus(p)}
                            title={p.status === "Published" ? "Move to Draft" : "Publish"}
                          >
                            {p.status === "Published" ? "↓ Draft" : "↑ Pub"}
                          </button>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="post-act history" onClick={() => onShowVersions(p)} title="Version History">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                              <circle cx="8" cy="8" r="6" />
                              <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="post-act" onClick={() => loadPostForEdit(p)} title="Edit">{I.edit}</button>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">
                            <button className="post-act" title="View">{I.view}</button>
                          </a>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="post-act del" onClick={() => handleDeletePost(p)} title="Delete">{I.trash}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination + range info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                Showing {startIdx + 1}–{Math.min(startIdx + POSTS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setCurrentPage(safePage - 1)}
                    disabled={safePage <= 1}
                    style={pagerBtn(false, safePage <= 1)}
                  >
                    ← Prev
                  </button>
                  {getPageNumbers().map((p, i) =>
                    p === "..." ? (
                      <span key={`d-${i}`} style={{ padding: "6px 4px", fontSize: 12, color: "var(--text3)" }}>...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        style={pagerBtn(p === safePage, false)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage(safePage + 1)}
                    disabled={safePage >= totalPages}
                    style={pagerBtn(false, safePage >= totalPages)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function pagerBtn(active, disabled) {
  return {
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: active ? "var(--accent, #003b93)" : "var(--surface)",
    color: active ? "#fff" : disabled ? "var(--text4, #bbb)" : "var(--text2, #666)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    minWidth: 32,
    transition: "all 0.15s",
  };
}
