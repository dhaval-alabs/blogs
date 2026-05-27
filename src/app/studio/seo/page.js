"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowLeft, Loader2, ShieldCheck, ShieldAlert, AlertTriangle,
  CheckCircle2, XCircle, Info, Search, ChevronDown, ChevronUp,
} from "lucide-react";

// ── SEO checks definition ──────────────────────────────────────────────────
// severity: "critical" | "warning" | "info"
const CHECKS = [
  {
    id: "indexable",
    label: "Indexable (noIndex = off)",
    severity: "critical",
    why: "Pages with noIndex set won't appear in Google at all. All published posts should be indexable.",
    test: (p) => !p.seo?.noIndex,
  },
  {
    id: "meta_title",
    label: "Meta title present",
    severity: "critical",
    why: "The meta title is the single most important on-page SEO signal and is shown in search results.",
    test: (p) => Boolean(p.seo?.metaTitle?.trim()),
  },
  {
    id: "meta_title_length",
    label: "Meta title 50–70 chars",
    severity: "warning",
    why: "Titles shorter than 50 chars waste space; longer than 70 chars get truncated in search results.",
    test: (p) => {
      const l = (p.seo?.metaTitle || "").trim().length;
      return l >= 50 && l <= 70;
    },
    skip: (p) => !p.seo?.metaTitle?.trim(),
  },
  {
    id: "meta_desc",
    label: "Meta description present",
    severity: "critical",
    why: "Google often uses the meta description as the search snippet. Missing it means Google picks arbitrary text.",
    test: (p) => Boolean(p.seo?.metaDesc?.trim()),
  },
  {
    id: "meta_desc_length",
    label: "Meta description 120–160 chars",
    severity: "warning",
    why: "Descriptions under 120 chars are too thin; over 160 chars get cut off in SERPs.",
    test: (p) => {
      const l = (p.seo?.metaDesc || "").trim().length;
      return l >= 120 && l <= 160;
    },
    skip: (p) => !p.seo?.metaDesc?.trim(),
  },
  {
    id: "canonical",
    label: "Canonical URL set",
    severity: "critical",
    why: "Without a canonical, Google may choose any version of the URL (www, non-www, trailing slash) as the canonical — splitting link equity.",
    test: (p) => Boolean(p.seo?.canonicalUrl?.trim()),
  },
  {
    id: "og_image",
    label: "OG image set",
    severity: "warning",
    why: "Open Graph images are shown when the post is shared on social media. Missing it results in a blank or generic preview.",
    test: (p) => Boolean(p.seo?.ogImage?.trim() || p.image?.trim()),
  },
  {
    id: "featured_image",
    label: "Featured image set",
    severity: "warning",
    why: "Featured images appear in article cards, related posts, and social previews. They improve click-through rates.",
    test: (p) => Boolean(p.image?.trim()),
  },
  {
    id: "focus_keyword",
    label: "Focus keyword set",
    severity: "warning",
    why: "A focus keyword helps writers and reviewers verify that the title, description, and body are aligned with the target query.",
    test: (p) => Boolean(p.seo?.focusKeyword?.trim()),
  },
  {
    id: "schema_type",
    label: "Schema type set",
    severity: "info",
    why: "Specifying a schema type (Article, HowTo, FAQ…) enables rich results in Google Search and improves CTR.",
    test: (p) => Boolean(p.seo?.schemaType?.trim()),
  },
  {
    id: "author",
    label: "Author assigned",
    severity: "warning",
    why: "Author signals (E-E-A-T) increasingly influence Google's quality assessment, especially for YMYL content.",
    test: (p) => Boolean(p.author_id?.trim()),
  },
  {
    id: "excerpt",
    label: "Excerpt / description present",
    severity: "info",
    why: "Used as the default meta description fallback and shown in article cards.",
    test: (p) => Boolean(p.excerpt?.trim()),
  },
];

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function severityColor(s) {
  if (s === "critical") return "var(--red)";
  if (s === "warning") return "var(--orange)";
  return "var(--blue)";
}
function severityBg(s) {
  if (s === "critical") return "var(--red-dim)";
  if (s === "warning") return "var(--orange-dim)";
  return "var(--blue-dim)";
}

function runChecks(post) {
  return CHECKS.map((c) => {
    if (c.skip?.(post)) return { ...c, status: "skip" };
    return { ...c, status: c.test(post) ? "pass" : "fail" };
  });
}

function postScore(results) {
  const active = results.filter((r) => r.status !== "skip");
  const passed = active.filter((r) => r.status === "pass").length;
  return Math.round((passed / active.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SeoHealth() {
  const router = useRouter();
  const { authorProfile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [posts, setPosts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all"); // all | critical | warning | issues
  const [expandedCheck, setExpandedCheck] = useState(null);
  const [expandedPost, setExpandedPost] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!authorProfile) { router.replace("/studio"); return; }

    supabase
      .from("posts")
      .select("id, title, slug, status, image, excerpt, author_id, seo, published_at")
      .eq("status", "Published")
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPosts(data);
        setFetching(false);
      });
  }, [authLoading, authorProfile, router]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const postResults = useMemo(
    () => posts.map((p) => ({ post: p, checks: runChecks(p), score: postScore(runChecks(p)) })),
    [posts]
  );

  const checkSummary = useMemo(() => {
    return CHECKS.map((c) => {
      const applicable = postResults.filter((pr) => pr.checks.find((r) => r.id === c.id)?.status !== "skip");
      const failing = applicable.filter((pr) => pr.checks.find((r) => r.id === c.id)?.status === "fail");
      return { ...c, total: applicable.length, failing: failing.length, passing: applicable.length - failing.length };
    });
  }, [postResults]);

  const totalPosts = posts.length;
  const criticalIssues = checkSummary.filter((c) => c.severity === "critical" && c.failing > 0).reduce((a, c) => a + c.failing, 0);
  const warningIssues = checkSummary.filter((c) => c.severity === "warning" && c.failing > 0).reduce((a, c) => a + c.failing, 0);
  const perfectPosts = postResults.filter((pr) => pr.score === 100).length;
  const avgScore = postResults.length ? Math.round(postResults.reduce((a, pr) => a + pr.score, 0) / postResults.length) : 0;

  const filteredPosts = useMemo(() => {
    let res = postResults;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((pr) => pr.post.title?.toLowerCase().includes(q) || pr.post.slug?.toLowerCase().includes(q));
    }
    if (filterSeverity === "critical") {
      res = res.filter((pr) => pr.checks.some((r) => r.status === "fail" && r.severity === "critical"));
    } else if (filterSeverity === "warning") {
      res = res.filter((pr) => pr.checks.some((r) => r.status === "fail" && r.severity === "warning"));
    } else if (filterSeverity === "issues") {
      res = res.filter((pr) => pr.checks.some((r) => r.status === "fail"));
    }
    return res;
  }, [postResults, search, filterSeverity]);

  // ── Loading / auth ─────────────────────────────────────────────────────────
  if (authLoading || fetching) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} color="var(--primary)" />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const scoreColor = avgScore >= 80 ? "var(--green)" : avgScore >= 60 ? "var(--orange)" : "var(--red)";

  return (
    <div style={{ flex: 1, background: "var(--bg)", overflowY: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <button onClick={() => router.push("/studio")} style={{ background: "none", border: "none", color: "var(--text3)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14, fontWeight: 500, padding: "8px 0" }}>
            <ArrowLeft size={16} /> Back to Studio
          </button>
          <img src="/blog/logo.svg" alt="AnalytixLabs" style={{ height: 30, width: "auto" }} />
        </div>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "var(--text)", letterSpacing: "-0.5px" }}>SEO Health Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "var(--text3)", fontSize: 15 }}>
            Checklist audit across {totalPosts} published posts. Fix critical issues first — they directly block or reduce Google visibility.
          </p>
        </div>

        {/* ── Scorecard row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36 }}>
          {[
            { label: "Avg SEO Score", value: `${avgScore}%`, color: scoreColor, sub: "across all posts" },
            { label: "Perfect Posts", value: perfectPosts, color: "var(--green)", sub: `${totalPosts - perfectPosts} need fixes` },
            { label: "Critical Issues", value: criticalIssues, color: "var(--red)", sub: "fix immediately" },
            { label: "Warnings", value: warningIssues, color: "var(--orange)", sub: "improve ranking" },
          ].map((c) => (
            <div key={c.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: c.color, lineHeight: 1, marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "var(--text4)" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── What should be in place (Reference Checklist) ── */}
        <section style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, background: "rgba(12,100,239,0.08)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>What every post should have</h2>
              <p style={{ margin: "2px 0 0", color: "var(--text3)", fontSize: 12 }}>Click any check to see why it matters and how many posts currently fail it.</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...checkSummary].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]).map((c) => {
              const pct = c.total ? Math.round((c.passing / c.total) * 100) : 100;
              const isOpen = expandedCheck === c.id;
              return (
                <div key={c.id} style={{ border: `1px solid ${c.failing > 0 ? severityColor(c.severity) + "33" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: c.failing > 0 ? severityBg(c.severity) : "var(--bg)" }}>
                  <button
                    onClick={() => setExpandedCheck(isOpen ? null : c.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    {c.failing === 0
                      ? <CheckCircle2 size={17} color="var(--green)" style={{ flexShrink: 0 }} />
                      : c.severity === "critical"
                        ? <XCircle size={17} color="var(--red)" style={{ flexShrink: 0 }} />
                        : c.severity === "warning"
                          ? <AlertTriangle size={17} color="var(--orange)" style={{ flexShrink: 0 }} />
                          : <Info size={17} color="var(--blue)" style={{ flexShrink: 0 }} />
                    }
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: c.failing > 0 ? severityColor(c.severity) : "var(--green)", fontWeight: 700, marginRight: 4 }}>
                      {c.failing > 0 ? `${c.failing} failing` : "All passing"}
                    </span>
                    {/* Progress bar */}
                    <div style={{ width: 80, height: 6, background: "var(--bg3)", borderRadius: 6, overflow: "hidden", flexShrink: 0, marginRight: 8 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c.failing === 0 ? "var(--green)" : severityColor(c.severity), borderRadius: 6, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text4)", width: 30, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                    {isOpen ? <ChevronUp size={15} color="var(--text4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={15} color="var(--text4)" style={{ flexShrink: 0 }} />}
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px 14px 45px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{c.why}</p>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: severityBg(c.severity), fontSize: 12, fontWeight: 700, color: severityColor(c.severity) }}>
                        {c.severity.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Post-level issues table ── */}
        <section style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, background: "rgba(239,68,68,0.08)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)" }}>
              <ShieldAlert size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>Post-level audit</h2>
              <p style={{ margin: "2px 0 0", color: "var(--text3)", fontSize: 12 }}>Click a post to see its full checklist. Click a slug to open the editor.</p>
            </div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "issues", "critical", "warning"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterSeverity(f)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: filterSeverity === f ? "var(--primary)" : "var(--bg3)",
                    color: filterSeverity === f ? "#fff" : "var(--text3)",
                    border: filterSeverity === f ? "none" : "1px solid var(--border)",
                  }}
                >
                  {f === "all" ? "All" : f === "issues" ? "Has Issues" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text4)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or slug…"
              style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, color: "var(--text)", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredPosts.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text4)", fontSize: 14 }}>
                No posts match the current filter.
              </div>
            )}
            {filteredPosts.map(({ post, checks, score }) => {
              const failures = checks.filter((r) => r.status === "fail");
              const hasCritical = failures.some((r) => r.severity === "critical");
              const isOpen = expandedPost === post.id;

              return (
                <div
                  key={post.id}
                  style={{
                    border: `1px solid ${hasCritical ? "rgba(239,68,68,0.25)" : failures.length > 0 ? "rgba(245,158,11,0.25)" : "var(--border)"}`,
                    borderRadius: 12, overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedPost(isOpen ? null : post.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: hasCritical ? "rgba(239,68,68,0.03)" : failures.length > 0 ? "rgba(245,158,11,0.03)" : "var(--bg)", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    {/* Score badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 800,
                      background: score === 100 ? "var(--green-dim)" : score >= 70 ? "var(--orange-dim)" : "var(--red-dim)",
                      color: score === 100 ? "var(--green)" : score >= 70 ? "var(--orange)" : "var(--red)",
                    }}>
                      {score}%
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title || "Untitled"}</div>
                      <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>/{post.slug}/</div>
                    </div>
                    {/* Failure badges */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {failures.filter((r) => r.severity === "critical").length > 0 && (
                        <span style={{ padding: "3px 9px", borderRadius: 20, background: "var(--red-dim)", color: "var(--red)", fontSize: 11, fontWeight: 700 }}>
                          {failures.filter((r) => r.severity === "critical").length} critical
                        </span>
                      )}
                      {failures.filter((r) => r.severity === "warning").length > 0 && (
                        <span style={{ padding: "3px 9px", borderRadius: 20, background: "var(--orange-dim)", color: "var(--orange)", fontSize: 11, fontWeight: 700 }}>
                          {failures.filter((r) => r.severity === "warning").length} warnings
                        </span>
                      )}
                      {failures.length === 0 && (
                        <span style={{ padding: "3px 9px", borderRadius: 20, background: "var(--green-dim)", color: "var(--green)", fontSize: 11, fontWeight: 700 }}>
                          All clear
                        </span>
                      )}
                    </div>
                    <a
                      href={`/studio?edit=${post.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ padding: "5px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "var(--text2)", textDecoration: "none", flexShrink: 0 }}
                    >
                      Edit
                    </a>
                    {isOpen ? <ChevronUp size={15} color="var(--text4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={15} color="var(--text4)" style={{ flexShrink: 0 }} />}
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {checks.filter((r) => r.status !== "skip").map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: r.status === "pass" ? "var(--green-dim)" : severityBg(r.severity) }}>
                          {r.status === "pass"
                            ? <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0 }} />
                            : r.severity === "critical"
                              ? <XCircle size={14} color="var(--red)" style={{ flexShrink: 0 }} />
                              : r.severity === "warning"
                                ? <AlertTriangle size={14} color="var(--orange)" style={{ flexShrink: 0 }} />
                                : <Info size={14} color="var(--blue)" style={{ flexShrink: 0 }} />
                          }
                          <span style={{ fontSize: 12, fontWeight: r.status === "fail" ? 700 : 500, color: r.status === "pass" ? "var(--green)" : severityColor(r.severity) }}>
                            {r.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredPosts.length > 0 && (
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--text4)", textAlign: "center" }}>
              Showing {filteredPosts.length} of {totalPosts} published posts
            </p>
          )}
        </section>
      </div>

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
