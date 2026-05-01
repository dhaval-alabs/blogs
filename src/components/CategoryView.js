"use client";
import { withBasePath, apiFetch } from "@/utils/basePath";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import { ToastProvider, useToast } from "@/components/Toast";
import dynamic from "next/dynamic";
import { SUGGESTED_AI_QUERIES, AI_CONTEXT } from "@/lib/config";

const AskAI = dynamic(() => import("@/components/AskAI"), { ssr: false, loading: () => <div className="rounded-2xl min-h-[160px] bg-surface-container/30 animate-pulse" /> });

const POSTS_PER_PAGE = 12;

function decodeCategory(slug) {
  return decodeURIComponent(slug || "").replace(/-/g, " ");
}

function CategoryContent({ categorySlug: rawSlug, initialPosts = [] }) {
  const categorySlug = decodeCategory(rawSlug);
  const addToast = useToast();

  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [bookmarked, setBookmarked] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [categorySlug]);

  useEffect(() => {
    if (!categorySlug) return;
    
    // If we already have initial posts, we don't necessarily need to re-fetch immediately
    // but we do it to ensure we have the latest data if the category changed client-side.
    if (initialPosts.length > 0 && posts.length === initialPosts.length) {
        setLoading(false);
        return;
    }

    setLoading(true);
    Promise.all([
      apiFetch(`/api/posts?topic=${encodeURIComponent(categorySlug)}`).then((r) => r.json()).catch(() => []),
      apiFetch(`/api/mdx-posts?category=${encodeURIComponent(categorySlug)}`).then((r) => r.json()).catch(() => []),
    ]).then(([supabaseData, mdxData]) => {
      const supabasePosts = Array.isArray(supabaseData) ? supabaseData : [];
      const mdxPosts = Array.isArray(mdxData) ? mdxData : [];
      const supabaseSlugs = new Set(supabasePosts.map((p) => p.slug));
      const merged = [
        ...supabasePosts,
        ...mdxPosts.filter((p) => !supabaseSlugs.has(p.slug)),
      ].sort((a, b) => new Date(b.publishedAt || b.published_at || 0) - new Date(a.publishedAt || a.published_at || 0));
      setPosts(merged);
      setLoading(false);
    });
  }, [categorySlug, initialPosts]);

  const toggleBookmark = (slug) => {
    const next = new Set(bookmarked);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
      addToast("Article saved for later!", "success");
    }
    setBookmarked(next);
  };

  const handleShare = (slug) => {
    navigator.clipboard?.writeText(window.location.origin + `/blog/${slug}`);
    addToast("Link copied!", "success");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-[#0b1326]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-on-surface-variant dark:text-[#c2c6d6]">Loading…</span>
        </div>
      </div>
    );

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * POSTS_PER_PAGE;
  const paginated = posts.slice(startIdx, startIdx + POSTS_PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <Navbar activeCategory={categorySlug} />

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-primary dark:text-[#adc6ff] hover:underline mb-3 inline-block">
            ← All posts
          </Link>
          <h1 className="font-[family-name:var(--font-headline)] font-extrabold text-3xl md:text-4xl text-on-background dark:text-[#dae2fd] capitalize">
            {categorySlug}
          </h1>
          <p className="text-on-surface-variant dark:text-[#c2c6d6] mt-2 text-sm">
            {posts.length} article{posts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-on-surface-variant dark:text-[#c2c6d6] py-10">No posts found in this category.</p>
        ) : (
          <>
            <p className="text-xs text-on-surface-variant dark:text-[#c2c6d6] mb-4">
              Showing {startIdx + 1}–{Math.min(startIdx + POSTS_PER_PAGE, posts.length)} of {posts.length}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginated.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  bookmarked={bookmarked.has(post.slug)}
                  onToggleBookmark={toggleBookmark}
                  onShare={handleShare}
                />
              ))}
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-10"
            />
          </>
        )}
      </div>

      <Footer />
      <MobileBottomNav activePage="home" />

      {/* Global Mobile AI FAB — ensures the widget is accessible across categories */}
      <div className="lg:hidden">
        <AskAI
          questions={SUGGESTED_AI_QUERIES}
          context={`Category: ${categorySlug}\n${AI_CONTEXT}`}
          placeholder={`Ask anything about ${categorySlug}…`}
        />
      </div>
    </>
  );
}

export default function CategoryView({ categorySlug, initialPosts = [] }) {
  return (
    <ToastProvider>
      <CategoryContent categorySlug={categorySlug} initialPosts={initialPosts} />
    </ToastProvider>
  );
}
