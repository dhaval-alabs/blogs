"use client";

import { useState, useRef, useEffect } from "react";

// Render a plain-text answer that may include markdown links [text](url).
// Streaming-safe: if a link is mid-emission we fall back to showing the raw
// characters so nothing visibly "jumps" as tokens arrive.
function renderAnswer(text) {
  if (!text) return null;
  const parts = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={`lnk-${i++}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-amber-300/70 underline-offset-2 hover:text-amber-200"
      >
        {m[1]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
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

  // Fetch + rank courses by tag overlap once (used after an answer renders)
  useEffect(() => {
    let cancel = false;
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancel || !Array.isArray(data)) return;
        const tagSet = new Set((tags || []).map((t) => String(t).toLowerCase()));
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
  }, [tags]);

  async function fetchFollowups(q, a) {
    try {
      const res = await fetch("/api/ask-ai/followups", {
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
      const res = await fetch("/api/ask-ai", {
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

  return (
    <div className="rounded-3xl border p-6 border-white/10 shadow-xl"
      style={{ background: "#003369" }}>
      <h3 className="font-[family-name:var(--font-headline)] font-bold text-lg text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-white/80">auto_awesome</span>
        Ask the AI
      </h3>

      {/* Input row */}
      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          className="w-full pl-12 pr-12 py-3.5 rounded-2xl text-sm bg-white/10 text-white border border-white/10 backdrop-blur-md shadow-lg outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/40"
        />
        <button onClick={() => ask()} aria-label="Ask AI"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-2xl"
            style={{ color: loading ? "#9ca3af" : "#fbbf24", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </button>
      </div>

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
            <div className="text-[13px] leading-relaxed text-white whitespace-pre-wrap break-words">
              {renderAnswer(answer)}
              {loading && (
                <span className="inline-block w-0.5 h-3.5 bg-white animate-pulse ml-0.5 translate-y-0.5 rounded-full" />
              )}
            </div>
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
                href={c.url || "https://www.analytixlabs.co.in/"}
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
    </div>
  );
}
