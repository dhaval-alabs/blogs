"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import BlogLeadForm from "@/components/BlogLeadForm";
import { ToastProvider, useToast } from "@/components/Toast";
import { likePostAction } from "@/app/actions";
import "@/components/TiptapEditor.css";
import parse from "html-react-parser";
import { stripInlineColors } from "@/utils/sanitizeContent";

// ── Below-the-fold / heavy article components are code-split so the critical
//    article markup renders first with minimum JS. All retain identical UX.
const CoursesGrid = dynamic(() => import("@/components/CoursesGrid"), { ssr: false });
const AskAI = dynamic(() => import("@/components/AskAI"), { ssr: false, loading: () => <div className="rounded-2xl min-h-[160px] bg-surface-container/30 animate-pulse" /> });
const SidebarAuthorSpotlight = dynamic(() => import("@/components/SidebarAuthorSpotlight"), { ssr: false });
const SidebarSalaryWidget = dynamic(() => import("@/components/SidebarSalaryWidget"), { ssr: false });
const SidebarCourseCard = dynamic(() => import("@/components/SidebarCourseCard"), { ssr: false });
const DiscussionSection = dynamic(() => import("@/components/DiscussionSection"), { ssr: false });
const FrontendKnowledgeCheck = dynamic(() => import("@/components/FrontendKnowledgeCheck"), { ssr: false });

// Generate contextual AI questions from post domain tags / FAQ headings
function formatBlogDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function buildSuggestedQuestions(post) {
  // Extract question-headings from post HTML
  const re = /<h[2-4][^>]*>([^<]*\?[^<]*)<\/h[2-4]>/gi;
  const found = [];
  let m;
  while ((m = re.exec(post.content || "")) !== null) {
    const q = m[1].replace(/<[^>]+>/g, "").trim();
    if (q.length > 5) found.push(q);
  }
  if (found.length >= 3) return found.slice(0, 5);

  const tagMap = {
    "Machine Learning":  "What is machine learning?",
    "Deep Learning":     "How do neural networks work?",
    "Transformers":      "Why are Transformers costly?",
    "LLMs":              "What are large language models?",
    "Data Science":      "How to start a data science career?",
    "Python":            "Best Python libraries for ML?",
    "Statistics":        "What statistics do I need for ML?",
    "NLP":               "What is natural language processing?",
    "MLOps":             "What is MLOps?",
    "Generative AI":     "What is generative AI?",
  };
  const fromTags = (post.domain_tags || []).map(t => tagMap[t]).filter(Boolean);
  const fallback = ["I'm a beginner, where to start?", "What skills should I learn first?"];
  return [...found, ...fromTags, ...fallback].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
}

function ArticleContent({ post, recommendedArticles, courseMatch, authorPostCount = 0, sidebarWidgets = [] }) {
  // Layout visibility flags — opt-out by default.
  // These blocks render unless explicitly disabled by the author in the CMS.
  // This ensures that globally configured sidebar widgets are visible on all articles.
  const layout = {
    showLeadGen:      post.advanced?.showLeadGen      !== false,
    showNextSteps:    post.advanced?.showNextSteps     !== false,
    showCourseCta:    post.advanced?.showCourseCta     !== false,
    showRightSidebar: post.advanced?.showRightSidebar  !== false,
  };
  const addToast      = useToast();
  const [progress, setProgress] = useState(0);
  const [toc, setToc]           = useState([]);
  const [activeSection, setActiveSection] = useState("");
  const [liked, setLiked]       = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [bookmarked, setBookmarked] = useState(false);
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const articleRef = useRef(null);
  const headingRefs = useRef({});
  const author = post.author || {};
  const suggestedQuestions = buildSuggestedQuestions(post);

  useEffect(() => {
    setBookmarked(localStorage.getItem(`bookmark_${post.slug}`) === "true");
    const wasLiked = localStorage.getItem(`like_${post.slug}`) === "true";
    setLiked(wasLiked);
    // Reset like count to server value whenever slug or server-side count changes.
    // We no longer read likeCount from localStorage to avoid stale global data.
    setLikeCount(post.likeCount ?? 0);
  }, [post.slug, post.likeCount]);

  // Reading progress
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // TOC generation
  useEffect(() => {
    if (!articleRef.current) return;
    const headings = articleRef.current.querySelectorAll("h2, h3");
    const extracted = [];
    headingRefs.current = {};
    headings.forEach((h, i) => {
      const id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + i;
      h.id = id;
      headingRefs.current[id] = h;
      extracted.push({ id, label: h.textContent.trim(), level: h.tagName.toLowerCase() });
    });
    setToc(extracted);
    if (extracted.length > 0) setActiveSection(extracted[0].id);
  }, [post.content]);

  // TOC scroll tracker — highlights the last heading that has passed the navbar line
  useEffect(() => {
    if (toc.length === 0) return;
    const OFFSET = 96; // navbar height + small buffer

    const allIds = [...toc.map((s) => s.id), "discussion"];

    const onScroll = () => {
      let current = allIds[0];
      for (const id of allIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= OFFSET) current = id;
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // set correct active section on mount
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  // Fade-in
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".fade-in-section").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleTocClick = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSection(id);
    if (showMobileToc) setShowMobileToc(false);
    window.history.pushState(null, "", `${window.location.pathname}#${id}`);

    // Re-query the heading fresh at click time by DOM index.
    // Stored refs can go stale when React re-renders the content IIFE; index-based
    // lookup against the live DOM is always correct.
    requestAnimationFrame(() => {
      const idx = toc.findIndex((t) => t.id === id);
      let target = null;
      if (idx !== -1 && articleRef.current) {
        target = articleRef.current.querySelectorAll("h2, h3")[idx] || null;
      }
      if (!target) target = document.getElementById(id);
      if (!target) return;

      const NAVBAR = 88;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - NAVBAR);
      // Use the two-argument form — widest browser compatibility, no cancellation.
      window.scrollTo(0, top);
    });
  };

  async function handleLike() {
    const alreadyLiked = liked;
    const delta = alreadyLiked ? -1 : 1;
    const newCount = Math.max(0, likeCount + delta);

    // Optimistic Update
    setLiked(!alreadyLiked);
    setLikeCount(newCount);
    localStorage.setItem(`like_${post.slug}`, String(!alreadyLiked));

    // Persist to DB
    const result = await likePostAction(post.slug, delta);
    
    if (!result.success) {
      // Revert optimistic update on failure
      addToast(result.error || "Failed to sync like with server", "error");
      setLiked(alreadyLiked);
      setLikeCount(likeCount);
      localStorage.setItem(`like_${post.slug}`, String(alreadyLiked));
    }
  }

  function handleBookmark() {
    const n = !bookmarked;
    setBookmarked(n);
    if (n) localStorage.setItem(`bookmark_${post.slug}`, "true");
    else   localStorage.removeItem(`bookmark_${post.slug}`);
    addToast(n ? "Article saved for later!" : "Removed from saved articles", n ? "success" : "info");
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => addToast("Link copied to clipboard!", "success"))
      .catch(() => addToast("Failed to copy link", "error"));
    setShowShare(false);
  }


  // Sidebar search removed — use FilterBar on /article page instead

  const likeDisplay = likeCount >= 1000 ? (likeCount / 1000).toFixed(1) + "k" : likeCount;

  // TOC entries including fixed items
  const tocItems = toc.length > 0 ? toc : [
    { id: "discussion", label: "Discussion", level: "h2" },
  ];
  const tocWithDiscussion = [...tocItems, { id: "discussion", label: "Discussion", level: "h2" }];

  return (
    <>
      <Navbar activeCategory={post.category} />

      {/* Reading Progress */}
      <div className="fixed top-16 left-0 w-full z-40 h-0.5 bg-outline-variant/20 dark:bg-[#222a3d]">
        <div className="h-full bg-primary dark:bg-[#adc6ff] transition-all duration-75"
          style={{ width: `${progress}%` }} />
      </div>

      {/* ── 3-col layout ─────────────────────────────────────── */}
      <div className="pt-20 pb-12 w-full max-w-[1400px] mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[260px_minmax(0,1fr)_260px] gap-8 xl:gap-12">

        {/* ── Left Sidebar ── */}
        <aside className="hidden lg:flex flex-col gap-0">
          <div className="sticky top-24 flex flex-col gap-0 rounded-2xl overflow-hidden border border-white/10 shadow-xl max-h-[calc(100vh-8rem)] pb-6"
            style={{ background: "linear-gradient(180deg, #003369 38%, #001f4d 100%)" }}>

            {/* TOC */}
            {tocItems.length > 0 && (
              <>
                <nav className="p-6 flex flex-col gap-1 overflow-y-auto min-h-0 flex-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100 mb-3">
                    In this article
                  </h4>
                  {tocWithDiscussion.map((s, i) => (
                    <a key={s.id + i} href={`#${s.id}`}
                      onClick={(e) => handleTocClick(e, s.id)}
                      className={`py-1.5 pl-3 border-l-2 text-[13px] transition-colors ${
                        activeSection === s.id
                          ? "border-white text-white font-bold"
                          : "border-white/10 text-blue-100/60 hover:text-white"
                      } ${s.level === "h3" ? "pl-6 text-xs" : ""}`}>
                      {s.label}
                    </a>
                  ))}
                </nav>
                <div className="mx-6 border-t border-white/20" />
              </>
            )}

            {/* Author Spotlight (Left Sidebar - compact, dark variant for gradient background) */}
            <SidebarAuthorSpotlight
              author={author}
              articleCount={authorPostCount}
              variant="dark"
              compact
            />
          </div>
        </aside>

        {/* ── Article Canvas ── */}
        <main className="w-full min-w-0">

          {/* ── Article Header ── */}
          <header className="mb-10">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {post.category && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-green-500/60 text-green-700 dark:text-green-400 dark:border-green-500/40 bg-green-50 dark:bg-green-900/20">
                  {post.category}
                </span>
              )}
              {post.skill_level && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-outline-variant/30 dark:border-[#424754] text-on-surface-variant dark:text-[#c2c6d6] bg-surface-container dark:bg-[#131b2e]">
                  {post.skill_level}
                </span>
              )}
            </div>

            <h1 className="font-[family-name:var(--font-headline)] font-extrabold text-4xl md:text-5xl text-on-background dark:text-[#dae2fd] leading-[1.08] tracking-tight mb-6">
              {post.title}
            </h1>

            {/* Mobile TOC */}
            {tocItems.length > 0 && (
              <div className="lg:hidden mb-4">
                <button onClick={() => setShowMobileToc(!showMobileToc)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-low dark:bg-[#131b2e] border border-outline-variant/20 dark:border-[#424754] rounded-xl text-sm font-semibold dark:text-[#dae2fd] w-full justify-between">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary dark:text-[#adc6ff] text-sm">list</span>
                    Contents ({tocItems.length} sections)
                  </span>
                  <span className="material-symbols-outlined text-secondary dark:text-[#c2c6d6] text-sm transition-transform"
                    style={{ transform: showMobileToc ? "rotate(180deg)" : "none" }}>
                    expand_more
                  </span>
                </button>
                {showMobileToc && (
                  <nav className="mt-2 p-4 bg-surface-container-low dark:bg-[#131b2e] border border-outline-variant/20 dark:border-[#424754] rounded-xl flex flex-col gap-2">
                    {tocWithDiscussion.map((s, i) => (
                      <a key={s.id + i} href={`#${s.id}`}
                        onClick={(e) => handleTocClick(e, s.id)}
                        className={`block py-3 px-4 rounded-xl text-sm transition-all ${
                          activeSection === s.id
                            ? "bg-primary text-white font-bold shadow-lg"
                            : "bg-surface-container-high dark:bg-[#171f33] text-on-surface-variant dark:text-[#c2c6d6]"
                        }`}>
                        {s.label}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-on-surface-variant dark:text-[#8c909f] mb-6">
              {post.publishedAt && <span>Published {formatBlogDate(post.publishedAt)}</span>}
              {post.updatedAt && post.updatedAt !== post.publishedAt && (
                <><span className="opacity-30">·</span><span>Updated {formatBlogDate(post.updatedAt)}</span></>
              )}
              {post.readTime && <><span className="opacity-30">·</span><span>{post.readTime}</span></>}
              {post.skill_level && <><span className="opacity-30">·</span><span>{post.skill_level}</span></>}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2 flex-wrap pb-6 border-b border-outline-variant/10 dark:border-[#424754]">
              {/* Like */}
              <button onClick={handleLike}
                className={`like-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all ${
                  liked
                    ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    : "border-outline-variant/30 dark:border-[#424754] bg-white dark:bg-[#131b2e] text-on-surface-variant dark:text-[#c2c6d6] hover:border-red-300"
                }`}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0", color: liked ? "#ef4444" : "inherit" }}>favorite</span>
                {likeDisplay}
              </button>

              {/* Comments */}
              <a href="#discussion"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border border-outline-variant/30 dark:border-[#424754] bg-white dark:bg-[#131b2e] text-on-surface-variant dark:text-[#8c909f] hover:border-primary/40 transition-colors">
                <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                Comments
              </a>

              {/* Share */}
              <div className="relative">
                <button onClick={() => setShowShare(s => !s)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border border-outline-variant/30 dark:border-[#424754] bg-white dark:bg-[#131b2e] text-on-surface-variant dark:text-[#c2c6d6] hover:border-primary/40 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  Share
                </button>
                {showShare && (
                  <div className="absolute left-0 top-full mt-2 w-44 bg-white dark:bg-[#171f33] border border-outline-variant/20 dark:border-[#424754] rounded-xl shadow-xl z-20 overflow-hidden">
                    <button onClick={handleCopyLink}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-container-low dark:hover:bg-[#222a3d] dark:text-[#dae2fd]">
                      <span className="material-symbols-outlined text-base">link</span>Copy Link
                    </button>
                    <button onClick={() => { window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, "_blank"); setShowShare(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm border-t border-outline-variant/10 dark:border-[#424754] hover:bg-surface-container-low dark:hover:bg-[#222a3d] dark:text-[#dae2fd]">
                      <span className="material-symbols-outlined text-base">share_reviews</span>LinkedIn
                    </button>
                    <button onClick={() => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(post.title)}`, "_blank"); setShowShare(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm border-t border-outline-variant/10 dark:border-[#424754] hover:bg-surface-container-low dark:hover:bg-[#222a3d] dark:text-[#dae2fd]">
                      <span className="material-symbols-outlined text-base">post_add</span>Twitter / X
                    </button>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* ── Article Body ── */}
          <article className="prose max-w-none min-w-0 overflow-hidden" ref={articleRef}>
            {(() => {
              // Authors using the editor's color picker bake `<span style="color: …">`
              // into the saved HTML. Inline colors override our light/dark CSS, so
              // dark-coloured text becomes invisible in dark mode (and vice versa).
              // Strip color / background-color from inline styles before render so
              // our theme rules in TiptapEditor.css can take over.
              const content = stripInlineColors(post.content || "");
              if (!content.startsWith("<")) {
                return <p className="text-xl font-medium text-on-surface dark:text-[#dae2fd] leading-relaxed mb-10">{post.excerpt}</p>;
              }

              // Legacy shortcode mapping — these only render when the author explicitly placed
              // the shortcode in content AND the corresponding CMS layout flag is enabled.
              // [[quiz]] is intentionally excluded — quizzes are now inline Tiptap widget nodes.
              const WIDGETS = {
                "[[newsletter]]":  "newsletter",
                "[[nextsteps]]":   "nextsteps",
                "[[coursematch]]": "coursematch",
              };

              const parts = content.split(/(\[\[newsletter\]\]|\[\[nextsteps\]\]|\[\[coursematch\]\])/gi);

              // Helper to render specific widget
              const renderWidget = (type, attrs = {}) => {
                if (type === "newsletter") {
                  const headline = attrs.headline || `Free Resource: ${post.domain_tags?.[0] || "Data Science"} Career Roadmap PDF`;
                  const subtext  = attrs.subtext  || "Get our 2026 edition — covering top roles, skills, salaries, and learning paths. Trusted by 80,000+ learners.";
                  const button   = attrs.ctaLabel || "Get Free PDF →";

                  return (
                    <div key="newsletter-widget" className="my-10 rounded-2xl overflow-hidden border border-slate-200 dark:border-[#424754] bg-[#f8fafc] dark:bg-[#131b2e]">
                      <div className="p-7">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-primary text-xl">download</span>
                          <h4 className="font-[family-name:var(--font-headline)] font-bold text-lg text-slate-900 dark:text-[#dae2fd]">
                            {headline}
                          </h4>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">
                          {subtext}
                        </p>
                        <form className="flex flex-col sm:flex-row gap-3" onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            const name = fd.get("name")?.toString().trim();
                            const email = fd.get("email")?.toString().trim();
                            if (!email || !email.includes("@")) { addToast("Please enter a valid email", "error"); return; }
                            const { subscribeAction } = await import("@/app/actions");
                            const result = await subscribeAction({ email, name, source: "article-pdf" });
                            if (result.success) { addToast("Roadmap PDF sent to your email!", "success"); e.target.reset(); }
                            else addToast(result.error || "Failed to subscribe", "error");
                          }}>
                          <input type="text" name="name" placeholder="Your name"
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border border-slate-200 dark:border-[#424754] bg-white dark:bg-[#0b1326] text-slate-900 dark:text-[#dae2fd] placeholder:text-slate-400" />
                          <input type="email" name="email" placeholder="Enter your work email"
                            className="flex-[2] px-4 py-2.5 rounded-xl text-sm outline-none border border-slate-200 dark:border-[#424754] bg-white dark:bg-[#0b1326] text-slate-900 dark:text-[#dae2fd] placeholder:text-slate-400" />
                          <button type="submit"
                            className="bg-primary text-white hover:bg-primary/90 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap shadow-sm transition-all">
                            {button}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                }

                if (type === "nextsteps") {
                  let steps = [];
                  if (attrs.steps) {
                    try {
                      const parsed = typeof attrs.steps === "string" ? JSON.parse(attrs.steps) : attrs.steps;
                      steps = (parsed || []).filter(s => s.text?.trim());
                    } catch {}
                  }

                  // Default steps if none provided in editor
                  if (!steps.length) {
                    steps = [
                      { icon: "quiz",         text: "Take a quick quiz",           url: "#discussion" },
                      { icon: "download",     text: "Download PDF Guide",          url: "#newsletter" },
                      { icon: "school",       text: `View ${post.domain_tags?.[0] || "AI"} Curriculum`, url: "https://www.analytixlabs.co.in/courses" },
                      { icon: "group",        text: "Join Study Community",        url: "https://www.analytixlabs.co.in/community" },
                    ];
                  }

                  return (
                    <div key="nextsteps-widget" className="my-10 rounded-2xl border border-slate-200 dark:border-[#424754] overflow-hidden shadow-sm bg-[#f8fafc] dark:bg-[#131b2e]">
                      <div className="px-6 py-4 border-b border-slate-200 dark:border-[#424754]"
                        style={{ background: "linear-gradient(90deg,rgba(0,59,147,0.03) 0%,transparent 100%)" }}>
                        <h3 className="font-[family-name:var(--font-headline)] font-bold text-base flex items-center gap-2 text-slate-900 dark:text-[#dae2fd]">
                          <span className="text-amber-500">✦</span>
                          Next Steps for You
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-[#c2c6d6] mt-0.5">
                          Great progress on {post.domain_tags?.[0] || "this topic"}! Based on your reading, what would you like to do next?
                        </p>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {steps.map((step, i) => (
                          <a key={i} href={step.url || "#"}
                            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all bg-white dark:bg-[#0b1326] border-slate-200 dark:border-[#424754] !text-slate-700 dark:!text-[#c2c6d6] hover:border-primary/30 dark:hover:border-primary/60 hover:!text-primary dark:hover:!text-[#adc6ff] hover:-translate-y-0.5 shadow-sm no-underline">
                            <span className="material-symbols-outlined text-base text-slate-500">{step.icon || "arrow_forward"}</span>
                            <span className="leading-snug">{step.text}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (type === "coursematch") {
                  const title = attrs.courseName || courseMatch?.title || "Advanced AI Curriculum";
                  const desc  = attrs.ctaHeadline || (!attrs.courseName ? (courseMatch?.desc || "") : "");
                  const url   = attrs.courseUrl || "https://www.analytixlabs.co.in/courses";

                  return (
                    <div key="course-widget" style={{ background: "#eef2ff", border: "1px solid #a5b4fc", borderRadius: 12, padding: "20px 24px", margin: "2.5rem 0" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Recommended Course</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e1b4b", marginBottom: desc ? 6 : 10, lineHeight: 1.3 }}>{title}</div>
                          {desc && <div style={{ fontSize: 13, color: "#6366f1", marginBottom: 12, lineHeight: 1.5 }}>{desc}</div>}
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-block", background: "#4f46e5", color: "#fff", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                            Enroll Now →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              };

              const renderedElements = parts.map((part, idx) => {
                const lowerPart = part.toLowerCase();
                if (WIDGETS[lowerPart]) {
                  const wType = WIDGETS[lowerPart];
                  // Respect layout flags — shortcodes placed by the author only render
                  // if the corresponding flag is explicitly enabled in the CMS.
                  if (wType === "newsletter"  && !layout.showLeadGen)   return null;
                  if (wType === "nextsteps"   && !layout.showNextSteps)  return null;
                  if (wType === "coursematch" && !layout.showCourseCta)  return null;
                  return renderWidget(wType);
                }
                return (
                  <div key={idx} className="tiptap-prose">
                    {parse(stripInlineColors(part), {
                      replace(domNode) {
                        // Strip any embedded script tags (e.g. old schema or tracking code)
                        // to prevent duplication with our modern schema injection.
                        if (domNode.type === "script" || domNode.name === "script") {
                          return <></>;
                        }

                        if (
                          domNode.type === "tag" &&
                          domNode.name === "div" &&
                          domNode.attribs?.["data-widget"]
                        ) {
                          const widgetType = domNode.attribs["data-widget"];
                          let attrs = {};
                          try {
                            attrs = JSON.parse(domNode.attribs["data-widget-attrs"] || "{}");
                          } catch {}

                          if (widgetType === "quiz") {
                            return (
                              <FrontendKnowledgeCheck
                                question={attrs.question}
                                options={attrs.options}
                                correctIndex={attrs.correctIndex}
                                explanation={attrs.explanation}
                              />
                            );
                          }

                          // Handle other inline widgets correctly with custom attributes
                          if (["newsletter", "nextsteps", "coursematch"].includes(widgetType)) {
                            return renderWidget(widgetType, attrs);
                          }

                          // other widget types can be mapped here as they are built
                          return <></>;
                        }
                      },
                    })}
                  </div>
                );
              });

              return renderedElements;
            })()}
          </article>

          {/* ── Lead Capture ── */}
          {layout.showLeadGen && (
            <section className="mt-16">
              <BlogLeadForm sourceName={`Blog_Article_${post.slug || "unknown"}`} />
            </section>
          )}

          {/* ── Discussion ── */}
          <section id="discussion" className="mt-20 pt-10 border-t border-outline-variant/20 dark:border-[#424754]">
            <DiscussionSection postSlug={post.slug} />
          </section>
        </main>

        {/* ── Right Sidebar ── */}
        <aside className={`${layout.showRightSidebar ? "hidden lg:flex" : "hidden"} flex-col gap-5`}>
          <div className="sticky top-24 flex flex-col gap-5 max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain scrollbar-hide">
            {sidebarWidgets.filter(w => w.enabled).map(widget => {
              switch (widget.type) {

                case 'ask_ai':
                  return (
                    <AskAI
                      key={widget.id}
                      questions={suggestedQuestions}
                      context={`Title: ${post.title}\nExcerpt: ${post.excerpt || ""}\nTopics: ${(post.domain_tags || []).join(", ")}`}
                      tags={post.domain_tags || []}
                      slug={post.slug || ""}
                      placeholder="Ask anything about this article…"
                    />
                  );

                case 'recommended_posts':
                  return recommendedArticles?.length > 0 ? (
                    <div key={widget.id} className="rounded-2xl border p-5 bg-surface-container-lowest dark:bg-[#0b1326] border-outline-variant/20 dark:border-[#424754]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-[family-name:var(--font-headline)] font-bold text-base dark:text-[#dae2fd]">Recommended</h3>
                        <span className="material-symbols-outlined text-primary dark:text-[#adc6ff] text-xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      </div>
                      <ul className="flex flex-col gap-4">
                        {recommendedArticles.slice(0, widget.config?.count ?? 3).map(item => (
                          <li key={item.id}>
                            <Link href={`/blog/${item.slug}`} className="group block">
                              <p className="text-[10px] font-[family-name:var(--font-label)] uppercase text-on-surface-variant dark:text-[#8c909f] mb-0.5">{item.category}</p>
                              <h5 className="text-[13px] font-bold leading-snug group-hover:text-primary dark:group-hover:text-[#adc6ff] transition-colors dark:text-[#dae2fd]">
                                {item.title}
                              </h5>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;

                case 'author_spotlight':
                  return (
                    <SidebarAuthorSpotlight
                      key={widget.id}
                      author={post.author}
                      articleCount={authorPostCount}
                      compact
                    />
                  );

                case 'salary_table':
                  return <SidebarSalaryWidget key={widget.id} config={widget.config} />;

                case 'course_cta':
                case 'course_card': {
                  const cfg = widget.config ?? {};
                  const baseCourse = (cfg.use_article_match && courseMatch) ? courseMatch : null;
                  
                  // Stabilize derivation: prioritization must be identical on SSR and Hydration
                  const title = cfg.fallback_title || baseCourse?.title || "Data Science Master Program";
                  
                  const course = {
                    title,
                    duration: cfg.fallback_duration || baseCourse?.duration || "6 months",
                    rating:   cfg.fallback_rating   || baseCourse?.rating   || 4.8,
                    ctaUrl:   cfg.cta_url           || baseCourse?.ctaUrl   || "",
                    ctaLabel: cfg.cta_label         || baseCourse?.ctaLabel || "Enroll Now →",
                    image:    baseCourse?.image     || ""
                  };

                  return <SidebarCourseCard key={widget.id} course={course} />;
                }

                default:
                  if (process.env.NODE_ENV === 'development') {
                    console.warn(`[Sidebar] Unknown widget type: ${widget.type}`, widget);
                  }
                  return null;
              }
            })}
          </div>
        </aside>
      </div>

      {/* ── Related Courses ── */}
      <CoursesGrid showViewAll={false} tags={post.domain_tags || []} />

      <Footer />
      <MobileBottomNav activePage="none" />

      {/* Global Mobile AI FAB — ensures the widget is accessible even when sidebar is hidden */}
      <div className="lg:hidden">
        {sidebarWidgets.filter(w => w.type === 'ask_ai' && w.enabled).map(widget => (
          <AskAI
            key={`mobile-${widget.id}`}
            questions={suggestedQuestions}
            context={`Title: ${post.title}\nExcerpt: ${post.excerpt || ""}\nTopics: ${(post.domain_tags || []).join(", ")}`}
            tags={post.domain_tags || []}
            slug={post.slug || ""}
            placeholder="Ask anything about this article…"
          />
        ))}
      </div>
    </>
  );
}

export default function ArticlePageWrapper({ post, recommendedArticles, courseMatch, authorPostCount, sidebarWidgets }) {
  return (
    <ToastProvider>
      <ArticleContent post={post} recommendedArticles={recommendedArticles} courseMatch={courseMatch} authorPostCount={authorPostCount} sidebarWidgets={sidebarWidgets} />
    </ToastProvider>
  );
}
