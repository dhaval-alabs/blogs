"use client";
import { apiFetch } from "@/utils/basePath";

import { useRef } from "react";
import { Toggle, Section, I } from "./StudioIcons";
import { getWidgetEntry } from "./widgetForms/registry";
import { STUDIO_CATEGORIES } from "@/lib/config";

// Registry-driven widget configurator.
// To add a new widget type, edit ./widgetForms/registry.js — no edits here.
function WidgetConfigPanel({ widgetId, widget, dispatch, context }) {
  const update = (data) => dispatch({ type: "UPDATE_WIDGET", id: widgetId, data });
  const entry = getWidgetEntry(widget.type);
  if (!entry) return null;
  const { Form, label, color } = entry;

  return (
    <div style={{ background: "var(--bg2)", border: `2px solid ${color}`, borderRadius: 12, padding: 14, marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {label} Widget
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: "SET_ACTIVE_WIDGET", id: null })}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 16, lineHeight: 1, padding: 0 }}
        >×</button>
      </div>
      <Form widget={widget} update={update} context={context} />
    </div>
  );
}

export default function DetailsPanel({ state, dispatch, set, showToast, isSuperAdmin }) {
  const fileInputRef = useRef(null);

  // Topics + courses are fetched once by useStudioDraft on mount; this panel
  // just reads from session state. Previously each tab switch unmounted the
  // panel and re-fired both fetches.
  const categories = state.studioTopics?.length ? state.studioTopics : STUDIO_CATEGORIES;
  const studioCourses = state.studioCourses || [];

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set("isUploadingImage", true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) set("featuredImage", data.url);
      else showToast("Upload failed: " + (data.error || "unknown"), "err");
    } catch { showToast("Upload failed. Please try again.", "err"); }
    finally { set("isUploadingImage", false); e.target.value = ""; }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); dispatch({ type: "ADD_TAG", value: state.tagInput }); }
    else if (e.key === "Backspace" && !state.tagInput && state.tags.length > 0) dispatch({ type: "POP_TAG" });
  };

  const handleEntityTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); dispatch({ type: "ADD_ENTITY_TAG", value: state.entityTagInput }); }
    else if (e.key === "Backspace" && !state.entityTagInput && state.entityTags.length > 0) dispatch({ type: "POP_ENTITY_TAG" });
  };

  const excerptLen = state.excerpt.length;

  return (
    <>
      {/* Active Widget Configuration */}
      {state.activeWidgetId && state.widgets?.[state.activeWidgetId] && (
        <div className="pp-field">
          <WidgetConfigPanel
            widgetId={state.activeWidgetId}
            widget={state.widgets[state.activeWidgetId]}
            dispatch={dispatch}
            context={{ studioCourses }}
          />
        </div>
      )}

      {/* Featured Image */}
      <div className="pp-field">
        <div className="f-lbl">FEATURED IMAGE</div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
        {state.featuredImage ? (
          <div style={{ position: "relative" }}>
            <img src={state.featuredImage} alt="Featured" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--radius)", display: "block" }} />
            <button onClick={() => set("featuredImage", "")} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>Remove</button>
          </div>
        ) : (
          <div className="img-drop" onClick={() => fileInputRef.current?.click()} style={{ opacity: state.isUploadingImage ? 0.6 : 1 }}>
            <div className="img-drop-icon">{I.image}</div>
            <div className="img-drop-text">
              {state.isUploadingImage ? "Uploading…" : <><b>Click to upload</b> or drag &amp; drop</>}
            </div>
          </div>
        )}
      </div>

      {/* Alt Text (SEO Required) */}
      {state.featuredImage && (
        <div className="pp-field" style={{ paddingTop: 0 }}>
          <div className="f-lbl">
            ALT TEXT <span style={{ color: "var(--red)", fontSize: 11 }}>*</span>
            <span className={`f-cnt ${state.altText.length > 150 ? "bad" : state.altText.length >= 5 ? "" : state.altText.length > 0 ? "warn" : ""}`}>
              {state.altText.length}/150
            </span>
          </div>
          <input
            type="text"
            value={state.altText}
            onChange={(e) => {
              set("altText", e.target.value);
              const len = e.target.value.trim().length;
              if (len === 0) set("altTextError", "Alt text is required for SEO");
              else if (len < 5) set("altTextError", "Alt text must be at least 5 characters");
              else if (len > 150) set("altTextError", "Alt text must be 150 characters or less");
              else set("altTextError", "");
            }}
            placeholder="Descriptive alt text for this image..."
            className={state.altTextError ? "alt-err-input" : ""}
          />
          {state.altTextError && (
            <div className="alt-err-msg">{state.altTextError}</div>
          )}
        </div>
      )}

      {/* Excerpt */}
      <div className="pp-field">
        <div className="f-lbl">
          EXCERPT
          <span className={`f-cnt ${excerptLen > 160 ? "bad" : excerptLen > 100 ? "warn" : ""}`}>{excerptLen}/100</span>
        </div>
        <textarea value={state.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="A brief summary for search results..." style={{ minHeight: 68 }} />
      </div>

      {/* Topics */}
      <div className="pp-field">
        <div className="f-lbl">TOPICS</div>
        <div className="topics-row">
          {categories.map((cat) => (
            <button key={cat} className={`topic-pill ${state.category === cat ? "sel" : ""}`} onClick={() => set("category", cat)}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Domain Tags */}
      <div className="pp-field">
        <div className="f-lbl">DOMAIN TAGS</div>
        <div className="tag-wrap" onClick={() => document.getElementById("studio-tag-input")?.focus()}>
          {state.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
              <span className="tag-x" onClick={() => dispatch({ type: "REMOVE_TAG", value: tag })}>×</span>
            </span>
          ))}
          <input id="studio-tag-input" className="tag-input" placeholder={state.tags.length === 0 ? "Add tag, press Enter" : ""} value={state.tagInput} onChange={(e) => set("tagInput", e.target.value)} onKeyDown={handleTagKeyDown} onBlur={() => { if (state.tagInput.trim()) dispatch({ type: "ADD_TAG", value: state.tagInput }); }} />
        </div>
      </div>

      {/* Skill Level */}
      <div className="pp-field">
        <div className="f-lbl">SKILL LEVEL</div>
        <div className="skill-row">
          {[{ label: "Beginner", cls: "s-beg" }, { label: "Intermediate", cls: "s-int" }, { label: "Advanced", cls: "s-adv" }].map(({ label, cls }) => (
            <button key={label} className={`skill-btn ${state.skill === label ? cls : ""}`} onClick={() => set("skill", label)}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Collapsible Sections ── */}



      {/* AI Hints T1 */}
      <Section title="AI Recommendation Hints" tier="T1" open={state.openSections.ai} onToggle={() => dispatch({ type: "TOGGLE_SECTION", key: "ai" })}>
        <div className="toggle-row">
          <span className="toggle-lbl">Include in AI recommendation</span>
          <Toggle checked={state.aiInclusionEnabled} onChange={(v) => set("aiInclusionEnabled", v)} />
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>
            Concept Entity Tags
            <span style={{ fontSize: 9, color: "var(--text3)", background: "var(--bg3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)", fontWeight: 400, letterSpacing: 0 }}>for embeddings</span>
          </div>
          <div className="tag-wrap" onClick={() => document.getElementById("entity-tag-input")?.focus()}>
            {state.entityTags.map((tag) => (
              <span key={tag} className="tag-chip">{tag}<span className="tag-x" onClick={() => dispatch({ type: "REMOVE_ENTITY_TAG", value: tag })}>×</span></span>
            ))}
            <input id="entity-tag-input" className="tag-input" placeholder={state.entityTags.length === 0 ? "Neural network, overfitting…" : ""} value={state.entityTagInput} onChange={(e) => set("entityTagInput", e.target.value)} onKeyDown={handleEntityTagKeyDown} onBlur={() => { if (state.entityTagInput.trim()) dispatch({ type: "ADD_ENTITY_TAG", value: state.entityTagInput }); }} />
          </div>
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>
            Manual Related Post IDs
            <span style={{ fontSize: 9, color: "var(--text3)", background: "var(--bg3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)", fontWeight: 400, letterSpacing: 0 }}>comma-separated</span>
          </div>
          <input type="text" value={state.relatedPostIds} onChange={(e) => set("relatedPostIds", e.target.value)} placeholder="12, 45, 78" />
        </div>
      </Section>

      {/* Author & Trust Signals T3 */}
      <Section title="Author & Trust Signals" tier="T3" open={state.openSections.author} onToggle={() => dispatch({ type: "TOGGLE_SECTION", key: "author" })}>
        {isSuperAdmin && (
          <div style={{ marginBottom: 20 }}>
            <div className="f-lbl" style={{ marginBottom: 6 }}>SELECT AUTHOR <span style={{ color: "var(--red)", fontSize: 11 }}>*</span></div>
            <select
              value={state.authorId}
              onChange={(e) => set("authorId", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)" }}
            >
              {state.allAuthors?.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name} ({a.email})</option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: "var(--text4)", marginTop: 4 }}>Only Super Admins can change the publishing author.</div>
          </div>
        )}
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>Author bio
            <span style={{ fontSize: 9, color: "var(--text3)", background: "var(--bg3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)", fontWeight: 400, letterSpacing: 0 }}>override</span>
          </div>
          <textarea value={state.authorBio} onChange={(e) => set("authorBio", e.target.value)} placeholder="Short bio for this article..." style={{ minHeight: 56 }} />
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>Fact-Checker</div>
          <input type="text" value={state.factChecker} onChange={(e) => set("factChecker", e.target.value)} placeholder="Review name or credential" />
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>Last Reviewed Date</div>
          <input type="date" value={state.lastReviewedDate} onChange={(e) => set("lastReviewedDate", e.target.value)} />
        </div>
      </Section>

      {/* Discussion T3 */}
      <Section title="Discussion Settings" tier="T3" open={state.openSections.discussion} onToggle={() => dispatch({ type: "TOGGLE_SECTION", key: "discussion" })}>
        <div className="toggle-row">
          <span className="toggle-lbl">Enable Q&amp;A section</span>
          <Toggle checked={state.qaEnabled} onChange={(v) => set("qaEnabled", v)} />
        </div>
        <div className="toggle-row">
          <span className="toggle-lbl">Enable FAQ schema</span>
          <Toggle checked={state.faqSchemaEnabled} onChange={(v) => set("faqSchemaEnabled", v)} />
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>Moderation Mode</div>
          <div className="mode-row">
            {["auto", "manual", "off"].map((mode) => (
              <button key={mode} className={`mode-btn ${state.moderationMode === mode ? "on" : ""}`} onClick={() => set("moderationMode", mode)}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Advanced T3 */}
      <Section title="Advanced / Accessibility" tier="T3" open={state.openSections.advanced} onToggle={() => dispatch({ type: "TOGGLE_SECTION", key: "advanced" })}>
        <div className="toggle-row">
          <span className="toggle-lbl">Semantic search index</span>
          <Toggle checked={state.semanticIndexEnabled} onChange={(v) => set("semanticIndexEnabled", v)} />
        </div>
        <div className="toggle-row">
          <span className="toggle-lbl">Include in salary hub</span>
          <Toggle checked={state.salaryHubEnabled} onChange={(v) => set("salaryHubEnabled", v)} />
        </div>
        <div className="toggle-row">
          <span className="toggle-lbl">Dark mode compatible</span>
          <Toggle checked={state.darkModeCompat} onChange={(v) => set("darkModeCompat", v)} />
        </div>
        <div>
          <div className="f-lbl" style={{ marginBottom: 6 }}>Reading progress bar color</div>
          <div className="color-row">
            <input type="color" className="color-swatch" value={state.progressBarColor} onChange={(e) => set("progressBarColor", e.target.value)} />
            <input type="text" value={state.progressBarColor} onChange={(e) => set("progressBarColor", e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} />
          </div>
          <div className="color-bar" style={{ background: state.progressBarColor }} />
        </div>
      </Section>

      {/* Publish Date (editable for published/scheduled posts) */}
      {state.editingPostId && (
        <div className="pp-field">
          <div className="f-lbl" style={{ marginBottom: 6 }}>
            PUBLISH DATE
            <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400, marginLeft: 6 }}>past dates allowed</span>
          </div>
          <input
            type="date"
            value={state.publishDate || ""}
            onChange={(e) => set("publishDate", e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Danger Zone / Status Management */}
      {state.editingPostId && state.status === "Published" && (
        <div style={{ marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            className="revert-draft-btn"
            onClick={() => {
              const post = state.allPosts.find(p => p.id === state.editingPostId);
              if (post) set('statusConfirmPost', post);
            }}
          >
            Move to Draft (Unpublish)
          </button>
          <p style={{ fontSize: 10, color: "var(--text4)", marginTop: 8, textAlign: 'center', lineHeight: 1.4 }}>
            Removes the post from public blog and returns it to drafts.
          </p>
        </div>
      )}
    </>
  );
}
