"use client";
import { withBasePath, apiFetch } from "@/utils/basePath";

import { useState, useRef, useEffect } from "react";

function formatMarkdownLite(text) {
  if (!text) return "";
  
  // Escape HTML first for safety
  let safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white/95">$1</strong>');
  
  // Inline code
  safeText = safeText.replace(/`([^`]+)`/g, '<code class="bg-black/20 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-100">$1</code>');

  // Links [text](url)
  safeText = safeText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline decoration-amber-300/70 underline-offset-2 hover:text-amber-200">$1</a>');

  // Bare URLs (not already in href="")
  safeText = safeText.replace(/(^|\s)(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="underline decoration-amber-300/70 underline-offset-2 hover:text-amber-200">$2</a>');

  // Lists (- item or * item or 1. item)
  safeText = safeText.replace(/^(?:-|\*|\d+\.) (.+)$/gm, '<div class="ml-4 flex gap-2"><span class="text-white/50">•</span><span class="flex-1">$1</span></div>');

  return safeText;
}

export default function AskAI({
  questions = [],
  context = "",
  tags = [],
  slug = "",
  placeholder = "Ask anything about this article...",
}) {
  const [query, setQuery]               = useState("");
  const [answer, setAnswer]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [asked, setAsked]               = useState(false);
  const [followups, setFollowups]       = useState([]);
  const [relatedCourses, setRelatedCourses] = useState([]);
  const abortRef = useRef(null);

  // Stable string key derived from the tags array so the effect only re-runs
  // when the actual tag values change, not on every render (arrays are always
  // a new reference which would cause an infinite fetch loop).
  const tagsKey = JSON.stringify(tags || []);

  // Fetch + rank courses by tag overlap once (used after an answer renders)
  useEffect(() => {
    let cancel = false;
    const parsedTags = JSON.parse(tagsKey);
    apiFetch("/api/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancel || !Array.isArray(data)) return;
        const tagSet = new Set(parsedTags.map((t) => String(t).toLowerCase()));
        const ranked = tagSet.size === 0
          ? data
          : [...data]
              .map((c) => {
                const ct = Array.isArray(c.domain_tags) ? c.domain_tags : [];
                const score = ct.reduce((n, t) => n + (tagSet.has(String(t).toLowerCase()) ? 1 : 0), 0);
                return { c, score };
              })
              .sort((a, b) => b.score - a.score || (a.c.sort_order ?? 0) - (b.c.sort_order ?? 0))
              .map(({ c }) => c);
        setRelatedCourses(ranked.slice(0, 2));
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [tagsKey]);

  async function fetchFollowups(q, a) {
    try {
      const res = await apiFetch("/api/ask-ai/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, answer: a, context }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.questions)) setFollowups(data.questions);
    } catch {}
  }

  async function ask(q) {
    const question = (q || query).trim();
    if (!question || loading) return;

    setQuery(question);
    setAnswer("");
    setFollowups([]);
    setLoading(true);
    setAsked(true);

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const res = await apiFetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, tags, slug }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAnswer(full);
      }

      if (full.trim().length > 20) fetchFollowups(question, full);
    } catch (err) {
      if (err.name !== "AbortError") {
        setAnswer("Sorry, something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    if (abortRef.current) abortRef.current.abort();
    setAsked(false);
    setQuery("");
    setAnswer("");
    setFollowups([]);
    setLoading(false);
  }

  // Mobile/tablet overlay state — desktop (lg+) always shows the inline card.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll and hide the floating mobile bottom nav while the overlay is open
  // so the Ask AI sheet can cover the full viewport without visual conflicts.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nav = document.querySelector(".mobile-bottom-nav");
    const prevNavDisplay = nav?.style.display ?? "";
    if (nav) nav.style.display = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      if (nav) nav.style.display = prevNavDisplay;
    };
  }, [mobileOpen]);

  const headerBlock = (
    <h3 className="font-[family-name:var(--font-headline)] font-bold text-lg text-white mb-4 flex items-center gap-2">
      <span className="material-symbols-outlined text-white/80">auto_awesome</span>
      Ask the AI
    </h3>
  );

  const inputBlock = (
    <div className="relative">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === "Enter" && ask()}
        className="w-full pl-12 pr-12 py-3.5 rounded-2xl text-sm bg-white/10 text-white border border-white/10 backdrop-blur-md shadow-lg outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/40"
      />
      <button onClick={() => ask()} aria-label="Send question" disabled={loading || !query.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white text-[#003369] shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {loading ? "more_horiz" : "arrow_upward"}
        </span>
      </button>
    </div>
  );

  const bodyBlock = (
    <>
      {/* Answer panel */}
      {asked && (
        <div className="mb-5 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-sm">

          {/* Question label */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
            AI Thinking about: "{query}"
          </p>

          {/* Loading dots */}
          {loading && !answer && (
            <div className="flex items-center gap-2 py-1">
              <span className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
              <span className="text-xs text-white/80">Thinking…</span>
            </div>
          )}

          {/* Streamed answer */}
          {answer && (
            <div 
              className="text-[13px] leading-relaxed text-white whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdownLite(answer) + (loading ? '<span class="inline-block w-0.5 h-3.5 bg-white animate-pulse ml-0.5 translate-y-0.5 rounded-full"></span>' : '') 
              }}
            />
          )}
        </div>
      )}

      {/* AI-generated follow-up chips */}
      {asked && !loading && followups.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 px-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            Continue exploring
          </p>
          <div className="flex flex-col gap-2">
            {followups.map((q, i) => (
              <button key={i} onClick={() => ask(q)}
                className="text-left px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:-translate-y-0.5">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related courses (inside widget) */}
      {asked && !loading && relatedCourses.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 px-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">school</span>
            Related AnalytixLabs Courses
          </p>
          <div className="flex flex-col gap-2">
            {relatedCourses.map((c) => (
              <a
                key={c.id}
                href={c.url && c.url !== "#" ? c.url : "https://www.analytixlabs.co.in/courses"}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-300 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                  <div className="flex-1 min-w-0">
                    {c.label && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-200/80 mb-0.5">
                        {c.label}
                      </p>
                    )}
                    <p className="text-[12.5px] font-bold text-white leading-snug mb-1">
                      {c.title}
                    </p>
                    {(c.duration || c.rating) && (
                      <p className="text-[11px] text-white/60">
                        {c.duration}{c.duration && c.rating ? " · " : ""}
                        {c.rating ? `★ ${c.rating}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-white/50 text-[18px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Suggested chips — shown when not in answer state */}
      {!asked && questions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest px-1">
            Suggested by AI
          </p>
          <div className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <button key={i} onClick={() => ask(q)}
                className="text-left px-4 py-3 rounded-2xl text-[13px] font-medium transition-all bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset link after answer */}
      {asked && (
        <button onClick={reset}
          className="text-xs font-bold text-white hover:underline flex items-center gap-1 mt-2">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Ask another question
        </button>
      )}
    </>
  );

  // Desktop card composition — matches the original look (header + input on top, body below)
  const card = (
    <div
      className="rounded-3xl border p-6 border-white/10 shadow-xl h-full"
      style={{ background: "#003369" }}
    >
      {headerBlock}
      <div className="mb-6">{inputBlock}</div>
      {bodyBlock}
    </div>
  );

  return (
    <>
      {/* Desktop / large screens: inline card in the sidebar */}
      <div className="hidden lg:block">{card}</div>

      {/* Mobile & tablet: floating action button (FAB) in the corner */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open Ask the AI"
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{ background: "#003369" }}
        >
          <span className="material-symbols-outlined text-2xl text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="absolute -top-1 -right-1 bg-amber-300 text-[#003369] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow">AI</span>
        </button>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Ask the AI"
          >
            {/* Backdrop — sits above the floating bottom nav (which is z-50) */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Chat-style sheet: header at top, scrollable body in the middle,
                input pinned at the bottom. On mobile the sheet fills the whole
                viewport (no gap below); on sm+ it centers as a modal. */}
            <div
              className="relative w-full h-[100dvh] sm:h-auto sm:max-w-lg sm:mx-4 sm:max-h-[88vh] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              style={{ background: "#003369" }}
            >
              {/* Header */}
              <div className="relative flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
                {headerBlock}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close"
                  className="w-9 h-9 -mt-2 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                {bodyBlock}
              </div>

              {/* Input pinned to the bottom — safe-area aware for notched devices */}
              <div
                className="px-4 pt-3 border-t border-white/10 bg-[#003369]"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
              >
                {inputBlock}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
