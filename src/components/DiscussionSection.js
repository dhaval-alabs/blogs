"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { postCommentAction, fetchCommentsAction, likeCommentAction } from "@/app/actions";

// Deterministic avatar color from username
const AVATAR_COLORS = [
  { bg: "#003b93", text: "#fff" },
  { bg: "#0e7490", text: "#fff" },
  { bg: "#7c3aed", text: "#fff" },
  { bg: "#b45309", text: "#fff" },
  { bg: "#059669", text: "#fff" },
  { bg: "#dc2626", text: "#fff" },
  { bg: "#0369a1", text: "#fff" },
  { bg: "#9333ea", text: "#fff" },
];
function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name = "") {
  return name.split(" ").map((w) => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

const norm = (s) => String(s || "").trim().toLowerCase();

/**
 * Discussion / comments section backed by Supabase.
 *
 * Relevant comments are auto-approved and answered by the brand within a few
 * seconds (Gemini, server-side). To surface that without a manual refresh we
 * optimistically show the submitted comment, then poll briefly after posting
 * until the approved comment + AI reply arrive.
 *
 * @param {{ postSlug?: string, title?: string }} props
 */
export default function DiscussionSection({ postSlug, title = "Discussion" }) {
  const addToast = useToast();
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [userName, setUserName] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [likedSet, setLikedSet] = useState(new Set());
  // Optimistic, not-yet-confirmed items the visitor just submitted.
  const [pending, setPending] = useState([]);
  const watchRef = useRef(0);

  // Load comments from Supabase. Returns the fresh list so callers can reconcile.
  const loadComments = useCallback(async () => {
    if (!postSlug) return [];
    const result = await fetchCommentsAction(postSlug);
    if (result.success) {
      setComments(result.comments);
      return result.comments;
    }
    return [];
  }, [postSlug]);

  useEffect(() => {
    loadComments();
    try {
      const stored = localStorage.getItem(`likedComments_${postSlug}`);
      if (stored) setLikedSet(new Set(JSON.parse(stored)));
    } catch {}
    return () => { watchRef.current++; }; // cancel any in-flight poll on unmount
  }, [loadComments, postSlug]);

  // Drop optimistic items once the server confirms them (matched by user+text).
  const reconcile = useCallback((fresh) => {
    const seen = new Set();
    for (const c of fresh) {
      seen.add(`${norm(c.user)}::${norm(c.text)}`);
      for (const r of c.replies || []) seen.add(`${norm(r.user)}::${norm(r.text)}`);
    }
    setPending((prev) => prev.filter((p) => !seen.has(`${norm(p.user)}::${norm(p.text)}`)));
  }, []);

  // After a post, the brand reply lands in ~2-5s. Poll a few times so it shows
  // up live. Only runs right after the visitor acts — no steady-state polling.
  const watchForUpdates = useCallback(() => {
    const token = ++watchRef.current;
    let attempts = 0;
    const tick = async () => {
      if (watchRef.current !== token) return; // superseded by a newer action/unmount
      const fresh = await loadComments();
      reconcile(fresh);
      attempts++;
      if (attempts < 12 && watchRef.current === token) {
        setTimeout(tick, 2500);
      }
    };
    setTimeout(tick, 2000);
  }, [loadComments, reconcile]);

  // Resolve which top-level thread a given comment id belongs to.
  const rootIdOf = useCallback((id) => {
    for (const c of comments) {
      if (c.id === id) return c.id;
      if ((c.replies || []).some((r) => r.id === id)) return c.id;
    }
    return null;
  }, [comments]);

  async function postComment() {
    if (!commentInput.trim()) return;
    const text = commentInput;
    const user = userName.trim() || "Anonymous";
    setLoading(true);
    try {
      const result = await postCommentAction({ postSlug: postSlug || "general", userName: user, text });
      if (result.success) {
        setCommentInput("");
        setPending((p) => [
          { tmpId: `tmp-${Date.now()}`, user, text, parentCommentId: null, rootId: null, createdAt: Date.now() },
          ...p,
        ]);
        addToast("Submitted — checking for a reply…", "success");
        watchForUpdates();
      } else {
        addToast(result.error || "Failed to post", "error");
      }
    } catch {
      addToast("Failed to post comment", "error");
    } finally {
      setLoading(false);
    }
  }

  async function postReply(parentId) {
    if (!replyText.trim()) return;
    const text = replyText;
    const user = userName.trim() || "Anonymous";
    const rootId = rootIdOf(parentId) ?? parentId;
    setLoading(true);
    try {
      const result = await postCommentAction({
        postSlug: postSlug || "general",
        userName: user,
        text,
        parentCommentId: parentId,
      });
      if (result.success) {
        setReplyText("");
        setReplyingTo(null);
        setPending((p) => [
          ...p,
          { tmpId: `tmp-${Date.now()}`, user, text, parentCommentId: parentId, rootId, createdAt: Date.now() },
        ]);
        addToast("Reply submitted — checking for a response…", "success");
        watchForUpdates();
      } else {
        addToast(result.error || "Failed to reply", "error");
      }
    } catch {
      addToast("Failed to post reply", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(commentId) {
    const key = String(commentId);
    const already = likedSet.has(key);
    const delta = already ? -1 : 1;

    const nextLiked = new Set(likedSet);
    if (already) nextLiked.delete(key);
    else nextLiked.add(key);
    setLikedSet(nextLiked);
    localStorage.setItem(`likedComments_${postSlug}`, JSON.stringify([...nextLiked]));

    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) return { ...c, likes: Math.max(0, c.likes + delta) };
        return {
          ...c,
          replies: c.replies.map((r) =>
            r.id === commentId ? { ...r, likes: Math.max(0, r.likes + delta) } : r
          ),
        };
      })
    );

    const result = await likeCommentAction(commentId, delta);

    if (!result.success) {
      addToast(result.error || "Failed to sync like with server", "error");
      const revertedLiked = new Set(likedSet);
      if (already) revertedLiked.add(key);
      else revertedLiked.delete(key);
      setLikedSet(revertedLiked);
      localStorage.setItem(`likedComments_${postSlug}`, JSON.stringify([...revertedLiked]));
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, likes: Math.max(0, c.likes - delta) };
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId ? { ...r, likes: Math.max(0, r.likes - delta) } : r
            ),
          };
        })
      );
    }
  }

  const pendingTop = pending.filter((p) => !p.parentCommentId);
  const pendingRepliesFor = (rootId) =>
    pending.filter((p) => p.parentCommentId && p.rootId === rootId);

  const totalComments =
    comments.length +
    comments.reduce((a, c) => a + (c.replies?.length || 0), 0) +
    pending.length;

  // Small reusable reply composer
  const ReplyForm = ({ parentId }) => (
    <div className="mt-3 flex gap-2">
      <input
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && postReply(parentId)}
        placeholder="Write a reply…"
        disabled={loading}
        autoFocus
        className="flex-1 px-3 py-2 rounded-xl text-sm outline-none bg-surface-container-lowest dark:bg-[#060e20] dark:text-[#dae2fd] border border-outline-variant/20 dark:border-[#424754] focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      />
      <button
        onClick={() => postReply(parentId)}
        disabled={loading}
        className="px-4 py-2 bg-primary text-on-primary rounded-full font-bold text-xs whitespace-nowrap disabled:opacity-60"
      >
        Reply
      </button>
    </div>
  );

  const BrandBadge = () => (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary dark:bg-[#adc6ff]/15 dark:text-[#adc6ff]">
      <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
      Team
    </span>
  );

  const PendingTag = () => (
    <span className="text-[10px] font-medium text-on-surface-variant/70 dark:text-[#8c909f] italic">
      · awaiting review…
    </span>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-[family-name:var(--font-headline)] font-bold text-lg text-on-background dark:text-[#dae2fd]">
          {title}
        </h3>
        <span className="text-sm text-on-surface-variant dark:text-[#8c909f]">
          {totalComments} comment{totalComments !== 1 ? "s" : ""}
        </span>
      </div>

      {/* New comment */}
      <div className="flex gap-3 mb-8 items-start flex-col sm:flex-row">
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-full bg-surface-container-high dark:bg-[#2d3449] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary dark:text-[#c2c6d6] text-lg">person</span>
          </div>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
            className="w-36 px-3 py-2.5 rounded-xl text-sm outline-none bg-surface-container-low dark:bg-[#131b2e] dark:text-[#dae2fd] border border-outline-variant/20 dark:border-[#424754] focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40"
          />
        </div>
        <div className="flex gap-3 flex-1 w-full">
          <input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && postComment()}
            placeholder="Ask a question or share your thoughts..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none bg-surface-container-low dark:bg-[#131b2e] dark:text-[#dae2fd] border border-outline-variant/20 dark:border-[#424754] focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40 disabled:opacity-60"
          />
          <button
            onClick={postComment}
            disabled={loading}
            className="bg-primary text-white dark:bg-[#adc6ff] dark:text-[#0b1326] active:scale-[0.98] px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap self-center disabled:opacity-60 transition-all"
          >
            {loading ? "…" : "Post"}
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex flex-col divide-y divide-outline-variant/10 dark:divide-[#424754]/40">
        {/* Optimistic top-level comments the visitor just posted */}
        {pendingTop.map((p) => {
          const color = getAvatarColor(p.user);
          return (
            <div key={p.tmpId} className="flex gap-4 py-5 opacity-60">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: color.bg, color: color.text }}>
                {getInitials(p.user)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-on-background dark:text-[#dae2fd]">{p.user}</span>
                  <PendingTag />
                </div>
                <p className="text-sm text-on-surface-variant dark:text-[#c2c6d6] leading-relaxed">{p.text}</p>
              </div>
            </div>
          );
        })}

        {comments.map((c) => {
          const color = getAvatarColor(c.user);
          const threadReplies = [
            ...(c.replies || []),
            ...pendingRepliesFor(c.id).map((p) => ({ ...p, id: p.tmpId, time: "now", _pending: true })),
          ];
          return (
            <div key={c.id} className="flex gap-4 py-5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: color.bg, color: color.text }}
              >
                {getInitials(c.user)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-on-background dark:text-[#dae2fd]">{c.user}</span>
                  {c.isBrand && <BrandBadge />}
                  <span className="text-xs text-on-surface-variant dark:text-[#8c909f]">{c.time}</span>
                </div>
                <p className="text-sm text-on-surface-variant dark:text-[#c2c6d6] leading-relaxed">{c.text}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => handleLike(c.id)}
                    className={`text-xs font-medium flex items-center gap-1 transition-colors ${
                      likedSet.has(String(c.id))
                        ? "text-primary dark:text-[#adc6ff]"
                        : "text-on-surface-variant dark:text-[#8c909f] hover:text-primary dark:hover:text-[#adc6ff]"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: likedSet.has(String(c.id)) ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      favorite
                    </span>
                    {c.likes > 0 && c.likes}
                  </button>
                  <button
                    onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(""); }}
                    className="text-xs font-medium text-on-surface-variant dark:text-[#8c909f] hover:text-primary dark:hover:text-[#adc6ff] transition-colors"
                  >
                    Reply
                  </button>
                </div>

                {replyingTo === c.id && <ReplyForm parentId={c.id} />}

                {/* Thread replies (flattened, time-ordered) */}
                {threadReplies.map((r) => {
                  const rColor = getAvatarColor(r.user);
                  return (
                    <div
                      key={r.id}
                      className={`mt-4 flex gap-3 pl-4 border-l-2 border-outline-variant/10 dark:border-[#424754] ${r._pending ? "opacity-60" : ""}`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{ background: rColor.bg, color: rColor.text }}
                      >
                        {getInitials(r.user)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm text-on-background dark:text-[#dae2fd]">{r.user}</span>
                          {r.isBrand && <BrandBadge />}
                          {r._pending ? <PendingTag /> : <span className="text-xs text-on-surface-variant dark:text-[#8c909f]">{r.time}</span>}
                        </div>
                        <p className="text-sm text-on-surface-variant dark:text-[#c2c6d6] leading-relaxed">{r.text}</p>
                        {!r._pending && (
                          <div className="flex items-center gap-4 mt-1">
                            <button
                              onClick={() => handleLike(r.id)}
                              className={`text-xs font-medium flex items-center gap-1 transition-colors ${
                                likedSet.has(String(r.id))
                                  ? "text-primary dark:text-[#adc6ff]"
                                  : "text-on-surface-variant dark:text-[#8c909f] hover:text-primary dark:hover:text-[#adc6ff]"
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-sm"
                                style={{ fontVariationSettings: likedSet.has(String(r.id)) ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                favorite
                              </span>
                              {r.likes > 0 && r.likes}
                            </button>
                            <button
                              onClick={() => { setReplyingTo(replyingTo === r.id ? null : r.id); setReplyText(""); }}
                              className="text-xs font-medium text-on-surface-variant dark:text-[#8c909f] hover:text-primary dark:hover:text-[#adc6ff] transition-colors"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                        {replyingTo === r.id && <ReplyForm parentId={r.id} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {comments.length === 0 && pendingTop.length === 0 && (
          <p className="text-sm text-on-surface-variant dark:text-[#8c909f] py-8 text-center">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </div>
  );
}
