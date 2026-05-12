"use client";
import { withBasePath, apiFetch } from "@/utils/basePath";

import { useRef, useState, useMemo } from "react";
import { STUDIO_SCHEMA_TYPES } from "@/lib/config";
import { I } from "./StudioIcons";

export default function SeoPanel({ state, set, showToast }) {
  const kw = state.focusKeyword.toLowerCase().trim();
  const effectiveDesc = state.metaDesc || state.excerpt;
  const ogFileInputRef = useRef(null);
  const [isOverriding, setIsOverriding] = useState(false);

  // ── SEO Logic ──────────────────────────────────────────────────
  const siteDomain = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const internalDomains = ["analytixlabs.co.in", "localhost", ...(siteDomain ? [siteDomain] : [])];

  const { internalLinkCount } = useMemo(() => {
    const html = state.postBody || "";
    const hrefMatches = [...html.matchAll(/\bhref=["']([^"']+)["']/gi)];
    let internal = 0;
    let external = 0;
    for (const match of hrefMatches) {
      const href = match[1];
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      if (href.startsWith("/") || internalDomains.some((d) => href.includes(d))) {
        internal++;
      } else if (/^https?:\/\//i.test(href)) {
        external++;
      }
    }
    // Course Match widgets are inherently internal CTAs
    const widgetMatches = [...html.matchAll(/data-widget=["']coursematch["']/gi)];
    internal += widgetMatches.length;
    return { internalLinkCount: internal };
  }, [state.postBody]);

  const keywordDensity = useMemo(() => {
    if (!kw || !state.postBody || state.wordCount === 0) return null;
    const text = state.postBody.replace(/<[^>]+>/g, " ").toLowerCase();
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    return parseFloat(((count / state.wordCount) * 100).toFixed(1));
  }, [kw, state.postBody, state.wordCount]);

  // Task 5: check metaTitle (falling back to postTitle) for focus keyword
  const titleToCheck = (state.metaTitle || state.postTitle || "").toLowerCase();
  const kwInTitlePass = !!(kw && titleToCheck.includes(kw));
  const kwInTitleLabel = !kw
    ? "Focus keyword in title — set a focus keyword first"
    : !state.metaTitle
    ? kwInTitlePass
      ? "Focus keyword in title ✓ (article title)"
      : "Focus keyword in title — add a meta title"
    : kwInTitlePass
    ? "Focus keyword in title ✓"
    : "Focus keyword missing from meta title";
  const kwInTitleNeutral = !kw || (!state.metaTitle && !state.postTitle);

  // Task 4: keyword density label + status using rubric
  const kwDensityLabel = (() => {
    if (keywordDensity === null) return "Keyword density — set a focus keyword first";
    const n = keywordDensity.toFixed(1);
    if (keywordDensity < 1.0) return `Keyword density low (${n}%) — aim for 1–2%`;
    if (keywordDensity <= 2.5) return `Keyword density good (${n}%) ✓`;
    if (keywordDensity <= 3.5) return `Keyword density slightly high (${n}%) — keep under 2.5%`;
    return `Keyword density too high (${n}%) — risk of keyword stuffing`;
  })();
  const kwDensityPass = keywordDensity !== null && keywordDensity >= 1.0 && keywordDensity <= 2.5;
  const kwDensityWarn = keywordDensity !== null && (keywordDensity < 1.0 || (keywordDensity > 2.5 && keywordDensity <= 3.5));
  const kwDensityErr = keywordDensity !== null && keywordDensity > 3.5;
  const kwDensityNeutral = keywordDensity === null;

  const seoChecks = [
    { label: kwInTitleLabel, pass: kwInTitlePass && !kwInTitleNeutral, warn: !kwInTitlePass && !kwInTitleNeutral && !!kw, neutral: kwInTitleNeutral },
    { label: "Meta description present", pass: effectiveDesc.length >= 50, warn: effectiveDesc.length > 0 && effectiveDesc.length < 50 },
    { label: kwDensityLabel, pass: kwDensityPass, warn: kwDensityWarn, err: kwDensityErr, neutral: kwDensityNeutral },
    { label: state.altText?.trim().length >= 5 ? "Alt text present ✓" : "Missing alt text on images", pass: state.altText?.trim().length >= 5, warn: !state.altText?.trim().length },
    { label: `Internal links: ${internalLinkCount} found`, pass: internalLinkCount >= 2, warn: internalLinkCount > 0 && internalLinkCount < 2, fail: internalLinkCount === 0 },
  ];

  const seoScore = Math.round((seoChecks.filter((c) => c.pass).length / seoChecks.length) * 100);
  const seoGrade = seoScore >= 80 ? "Excellent" : seoScore >= 40 ? "Good — room to improve" : "Needs work";
  const seoColor = seoScore >= 80 ? "#16a34a" : seoScore >= 40 ? "#f97316" : "#ef4444";
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
            <div className="seo-sub">{seoChecks.filter((c) => !c.pass).length} issues to resolve</div>
          </div>
        </div>
        <div className="seo-checks" style={{ marginTop: 12 }}>
          {seoChecks.map((c, i) => {
            const cls = c.pass ? "ic-ok" : c.warn ? "ic-wn" : c.neutral ? "ic-nt" : "ic-err";
            const icon = c.pass ? "✓" : c.warn ? "!" : c.neutral ? "–" : "✕";
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
        <input type="text" value={state.slug} onChange={(e) => set("slug", e.target.value)} placeholder="your-post-slug" />
        <div className="slug-path">
          /article/{state.slug || "your-post-slug"}
          <div className="slug-hint" style={{ fontSize: 11, color: "var(--text4)", marginTop: 4, fontStyle: "italic" }}>
            This determines the public URL. Changes will update the redirection path.
          </div>
        </div>
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>META TITLE <span className={`f-cnt ${state.metaTitle.length > 60 ? "bad" : ""}`}>{state.metaTitle.length} / 60</span></div>
        <input type="text" value={state.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder={state.postTitle || "SEO page title…"} />
      </div>
      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>META DESCRIPTION <span className={`f-cnt ${state.metaDesc.length > 160 ? "bad" : state.metaDesc.length > 120 ? "warn" : ""}`}>{state.metaDesc.length} / 160</span></div>
        <textarea value={state.metaDesc} onChange={(e) => set("metaDesc", e.target.value)} placeholder={state.excerpt || "Brief description for search results…"} style={{ minHeight: 80 }} />
      </div>
      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>FOCUS KEYWORD</div>
        <input type="text" value={state.focusKeyword} onChange={(e) => set("focusKeyword", e.target.value)} placeholder="Neural Networks" />
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
          /* Custom OG image has been set */
          <div style={{ position: "relative" }}>
            <img src={state.ogImage} alt="OG/Social" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--radius)", display: "block" }} />
            <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>Custom override</div>
          </div>
        ) : socialPreview ? (
          /* Showing featured image as default */
          <div style={{ position: "relative" }}>
            {isOverriding ? (
              <div className="img-drop" onClick={() => ogFileInputRef.current?.click()}>
                <div className="img-drop-icon">{I.image}</div>
                <div className="img-drop-text"><b>Click to upload</b> social image</div>
              </div>
            ) : (
              <>
                <img src={socialPreview} alt="Social preview (featured image)" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--radius)", display: "block", opacity: 0.85 }} />
                <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>Using featured image</div>
                <button
                  onClick={() => setIsOverriding(true)}
                  style={{ position: "absolute", bottom: 6, right: 6, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}
                >Override Social Image</button>
              </>
            )}
          </div>
        ) : (
          /* No image at all */
          <div className="img-drop" onClick={() => ogFileInputRef.current?.click()}>
            <div className="img-drop-icon">{I.image}</div>
            <div className="img-drop-text"><b>Click to upload</b> or drag &amp; drop</div>
          </div>
        )}
      </div>

      <div className="pp-field">
        <div className="f-lbl" style={{ marginBottom: 6 }}>SCHEMA TYPE</div>
        <select value={state.schemaType} onChange={(e) => set("schemaType", e.target.value)}>
          {STUDIO_SCHEMA_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </>
  );
}
