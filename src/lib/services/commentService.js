import { after } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getCallerSlug } from '@/lib/infrastructure/auth';
import { revalidateRoute } from '@/lib/utils/core';
import { reviewComment, BRAND_AUTHOR } from './commentAiService';

function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function postComment(input) {
  try {
    const postSlug = input?.postSlug;
    const userName = String(input?.userName || 'Anonymous').trim();
    const text = String(input?.text || '').trim();
    const parentCommentId = input?.parentCommentId ? parseInt(input.parentCommentId, 10) : null;

    if (!postSlug) return { success: false, error: 'Post identifier is missing.' };
    if (!text) return { success: false, error: 'Comment text is required.' };

    const db = getServiceClient();
    if (!db) return { success: false, error: 'Database connection failed.' };

    const row = {
      post_slug: String(postSlug).slice(0, 200),
      user_name: userName.slice(0, 50),
      text: text.slice(0, 2000),
      parent_comment_id: parentCommentId,
      likes: 0,
      status: 'pending',
    };

    const { data: inserted, error: dbError } = await db
      .from('comments')
      .insert(row)
      .select('id')
      .single();
    if (dbError) throw dbError;

    // Hand the comment to Gemini for review AFTER the response is sent, so the
    // visitor gets an instant "submitted" ack. Relevant comments get
    // auto-approved + a brand reply; the rest stay pending for human review.
    if (inserted?.id) {
      after(() => reviewComment(inserted.id));
    }

    return { success: true, pending: true };
  } catch (err) {
    console.error('postComment failed:', err);
    return { success: false, error: String(err?.message || 'Internal server error') };
  }
}

export async function likeComment(commentId, delta = 1) {
  try {
    const db = getServiceClient();
    const { data: newLikes, error } = await db.rpc('increment_comment_likes', {
      p_id: commentId,
      p_delta: delta,
    });
    if (error) {
      console.error('likeComment RPC error:', error.message);
      return { success: false, error: String(error.message) };
    }

    revalidateRoute('/');
    return { success: true, likes: newLikes };
  } catch (err) {
    console.error('likeComment crashed:', err);
    return { success: false, error: String(err?.message || 'Failed to like comment.') };
  }
}

export async function fetchComments(postSlug) {
  try {
    if (!postSlug) return { success: true, comments: [] };

    const db = getServiceClient();
    const { data, error: fetchErr } = await db
      .from('comments')
      .select('*')
      .eq('post_slug', postSlug)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('fetchComments error:', fetchErr.message);
      return { success: true, comments: [] };
    }

    // Flatten each thread under its ROOT comment. Replies can nest arbitrarily
    // (a user replies to the brand reply, the brand replies again, …) — we walk
    // each row up to its top-most ancestor and collect every descendant as a
    // single time-ordered list under that root. This keeps the UI a clean
    // two-level thread no matter how deep the underlying chain goes.
    const rows = data || [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const toComment = (row) => ({
      id: row.id,
      user: row.user_name,
      text: row.text,
      likes: row.likes || 0,
      time: formatRelativeTime(row.created_at),
      parentCommentId: row.parent_comment_id,
      createdAt: row.created_at,
      isBrand: row.user_name === BRAND_AUTHOR,
      replies: [],
    });
    const rootIdOf = (row) => {
      let cur = row;
      let guard = 0;
      while (cur.parent_comment_id && byId.has(cur.parent_comment_id) && guard++ < 50) {
        cur = byId.get(cur.parent_comment_id);
      }
      return cur.id;
    };

    const topLevel = [];
    const repliesByRoot = new Map();
    for (const row of rows) {
      const isRoot = !row.parent_comment_id || !byId.has(row.parent_comment_id);
      if (isRoot) {
        topLevel.push(toComment(row));
      } else {
        const rootId = rootIdOf(row);
        if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, []);
        repliesByRoot.get(rootId).push(toComment(row));
      }
    }

    for (const c of topLevel) {
      c.replies = (repliesByRoot.get(c.id) || []).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    return { success: true, comments: topLevel };
  } catch (error) {
    console.error('fetchComments failed:', error);
    return { success: true, comments: [] };
  }
}

export async function fetchPendingComments() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('comments')
      .select('*, parent:parent_comment_id(text, user_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data || []).map(row => ({
      id: row.id,
      postSlug: row.post_slug,
      user: row.user_name,
      text: row.text,
      likes: row.likes || 0,
      parentCommentId: row.parent_comment_id,
      parentContext: row.parent ? { text: row.parent.text, user: row.parent.user_name } : null,
      createdAt: row.created_at,
      time: formatRelativeTime(row.created_at),
    }));

    return { success: true, comments };
  } catch (error) {
    console.error('fetchPendingComments failed:', error);
    return { success: false, error: 'Failed to fetch pending comments.' };
  }
}

export async function fetchApprovedComments() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('comments')
      .select('*, parent:parent_comment_id(text, user_name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const comments = (data || []).map(row => ({
      id: row.id,
      postSlug: row.post_slug,
      user: row.user_name,
      text: row.text,
      likes: row.likes || 0,
      parentCommentId: row.parent_comment_id,
      parentContext: row.parent ? { text: row.parent.text, user: row.parent.user_name } : null,
      createdAt: row.created_at,
      time: formatRelativeTime(row.created_at),
    }));

    return { success: true, comments };
  } catch (error) {
    console.error('fetchApprovedComments failed:', error);
    return { success: false, error: 'Failed to fetch approved comments.' };
  }
}

export async function approveComment(commentId) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('comments').update({ status: 'approved' }).eq('id', commentId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('approveComment failed:', error);
    return { success: false, error: 'Failed to approve comment.' };
  }
}

export async function rejectComment(commentId) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('comments').delete().eq('id', commentId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('rejectComment failed:', error);
    return { success: false, error: 'Failed to reject comment.' };
  }
}

export async function batchModerateComments(commentIds, action) {
  try {
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return { success: false, error: 'No comments provided' };
    }
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();

    if (action === 'approve') {
      const { error } = await db.from('comments').update({ status: 'approved' }).in('id', commentIds);
      if (error) throw error;
    } else if (action === 'reject') {
      const { error } = await db.from('comments').delete().in('id', commentIds);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('batchModerateComments failed:', error);
    return { success: false, error: `Failed to ${action} comments.` };
  }
}
