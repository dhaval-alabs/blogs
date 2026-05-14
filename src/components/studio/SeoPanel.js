"use client";
import { apiFetch } from "@/utils/basePath";

import { useRef, useState, useMemo } from "react";
import { STUDIO_SCHEMA_TYPES } from "@/lib/config";
import { I } from "./StudioIcons";
import {
  computeSeoChecks,
  computeSeoScore,
  gradeSeoScore,
} from "@/lib/domain/posts/seo-utils";

export default function SeoPanel({ state, set, showToast }) {
  const metaTitle = state.metaTitle || "";
  const metaDesc = state.metaDesc || "";
  const postTitle = state.postTitle || "";
  const postBody = state.postBody || "";
  const excerpt = state.excerpt || "";

  const ogFileInputRef = useRef(null);
  const [isOverriding, setIsOverriding] = useState(false);

  // Delegates to the unified SEO engine in @/lib/domain/posts/seo-utils.
  // PostsTable's CSV export uses the same checks/score, so the live editor
  // and the spreadsheet can no longer drift apart on thresholds.
  const { seoChecks, seoScore, seoGrade, seoColor } = useMemo(() => {
    const input = {
      title: postTitle,
      body: postBody,
      excerpt,
      focusKeyword: state.focusKeyword || "",
      metaTitle,
      metaDesc,
      altText: state.altText || state.alt_text || "",
    };
    const checks = computeSeoChecks(input);
    const score = computeSeoScore(input);
    const { grade, color } = gradeSeoScore(score);
    return { seoChecks: checks, seoScore: score, seoGrade: grade, seoColor: color };
  }, [postTitle, postBody, excerpt, state.focusKeyword, metaTitle, metaDesc, state.altText, state.alt_text]);

  const circumference = 2 * Math.PI * 20;
  const seoArc = (seoScore / 100) * circumference;

  const handleOgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) { set("ogImage", data.url); setIsOverriding(false); }
      else showToast("Upload failed: " + (data.error || "unknown"), "err");
    } catch { showToast("Upload failed. Please try again.", "err"); }
    finally { e.target.value = ""; }
  };

  const socialPreview = state.ogImage || state.featuredImage;

  return (
    <>
      <div className="pp-field">
        <div className="seo-score-card">
          <div className="seo-ring">
            <svg width="54" height="54" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r="20" fill="none" stroke="var(--bg4)" strokeWidth="5" />
              <circle cx="27" cy="27" r="20" fill="none" stroke={seoColor} strokeWidth="5"
                strokeDasharray={`${seoArc} ${circumference}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.4s ease" }}
              />
            </svg>
            <div className="seo-pct" style={{ color: seoColor }}>{seoScore}%</div>
          </div>
          <div>
            <div className="seo-grade" style={{ color: seoColor }}>{seoGrade}</div>
            <div className="seo-sub">{seoChecks.filter((c) => !c.pass && !c.neutral).length} issues to resolve</div>
          </div>
        </div>
        <div className="seo-checks" style={{ marginTop: 12 }}>
          {seoChecks.map((c, i) => {
            const cls = c.pass ? "ic-ok" : (c.warn || c.fail || c.err) ? (c.fail || c.err ? "ic-err" : "ic-wn") : "ic-nt";
            const icon = c.pass ? "✓" : (c.fail || c.err) ? "✕" : (c.warn ? "!" : "–");
            return (
              <div key={i} className="seo-check">
                <div className={`seo-ic ${cls}`}>{icon}</div>
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* URL Slug */}
      <div className="pp-field">
        <div className="f-lbl">URL SLUG</div>
        <input type="text" value={state.slug || ""} onChange={(e) => set("slug", e.target.value)} placeholder="your-post-slug" />
        <div className="slug-path">
          /article/{state.slug || "your-post-slug"}
          <div className="slug-hint" style={{ fontSize: 11, color: "var(--text4)", marginTop: 4, fontStyle: "italic" }}>
            This determines the public URL.
          </div>
        </div>
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>
          META TITLE
          <span className={`f-cnt ${(metaTitle || "").length > 60 ? "bad" : ""}`}>
            {(metaTitle || "").length} / 60
          </span>
        </div>
        <input type="text" value={metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder={postTitle || "SEO page title…"} />
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>
          META DESCRIPTION
          <span className={`f-cnt ${(metaDesc || "").length > 160 ? "bad" : (metaDesc || "").length > 120 ? "warn" : ""}`}>
            {(metaDesc || "").length} / 160
          </span>
        </div>
        <textarea value={metaDesc} onChange={(e) => set("metaDesc", e.target.value)} placeholder={excerpt || "Brief description for search results…"} style={{ minHeight: 80 }} />
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>FOCUS KEYWORD</div>
        <input type="text" value={state.focusKeyword || ""} onChange={(e) => set("focusKeyword", e.target.value)} placeholder="Neural Networks" />
      </div>

      {/* OG / Social Image */}
      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>OG / SOCIAL IMAGE</span>
          {state.ogImage && (
            <button onClick={() => { set("ogImage", ""); setIsOverriding(false); }} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11, padding: 0 }}>Remove override</button>
          )}
        </div>
        <input ref={ogFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleOgUpload} />

        {state.ogImage ? (
          <div style={{ position: "relative" }}>
            <img src={state.ogImage} alt="OG/Social" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--radius)", display: "block" }} />
            <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>Custom override</div>
          </div>
        ) : socialPreview ? (
          <div style={{ position: "relative" }}>
            {isOverriding ? (
              <div className="img-drop" onClick={() => ogFileInputRef.current?.click()}>
                <div className="img-drop-icon">{I.image}</div>
                <div className="img-drop-text"><b>Click to upload</b> social image</div>
              </div>
            ) : (
              <>
                <img src={socialPreview} alt="Social preview" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--radius)", display: "block", opacity: 0.85 }} />
                <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>Using featured image</div>
                <button
                  onClick={() => setIsOverriding(true)}
                  style={{ position: "absolute", bottom: 6, right: 6, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}
                >Override Social Image</button>
              </>
            )}
          </div>
        ) : (
          <div className="img-drop" onClick={() => ogFileInputRef.current?.click()}>
            <div className="img-drop-icon">{I.image}</div>
            <div className="img-drop-text"><b>Click to upload</b> or drag &amp; drop</div>
          </div>
        )}
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>SCHEMA TYPE</div>
        <select value={state.schemaType || "Article"} onChange={(e) => set("schemaType", e.target.value)}>
          {STUDIO_SCHEMA_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </>
  );
}
