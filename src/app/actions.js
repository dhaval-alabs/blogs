'use server';

import { revalidatePath } from 'next/cache';
import { getServiceClient } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

// ── Slug helpers ──────────────────────────────────────────────────
function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Revalidation helper ──────────────────────────────────────────
// next.config.mjs has trailingSlash: true, which means routes are
// registered as /blog/slug/ not /blog/slug. revalidatePath must use
// the same trailing-slash form or the cache entry is never matched.
function revalidateRoute(path) {
  const normalized = path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`;
  revalidatePath(normalized);
}

// ── Widget content sanitizer ─────────────────────────────────────
// Runs server-side before DB storage. Normalizes widget data-widget-attrs:
//   - Migrates old string-array steps → {text,url}[] for nextsteps widgets
//   - Removes any leaked editor-only keys
function sanitizeContent(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(
    /data-widget-attrs="([^"]+)"/g,
    (match, encoded) => {
      try {
        const raw = encoded.replace(/&quot;/g, '"').replace(/&#34;/g, '"');
        const attrs = JSON.parse(raw);

        // Migrate nextsteps string-array steps → object array
        if (attrs.steps) {
          let parsed = attrs.steps;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = []; }
          }
          if (Array.isArray(parsed)) {
            attrs.steps = JSON.stringify(
              parsed.map(s => typeof s === 'string' ? { text: s, url: '' } : { text: s.text ?? '', url: s.url ?? '' })
            );
          }
        }

        // Strip any editor-only runtime keys that should never reach the DB
        delete attrs.isEditing;

        const serialized = JSON.stringify(attrs).replace(/"/g, '&quot;');
        return `data-widget-attrs="${serialized}"`;
      } catch {
        return match; // leave unchanged if JSON is malformed
      }
    }
  );
}

// ── Payload validation ────────────────────────────────────────────
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid payload';
  if (!payload.title?.trim()) return 'Title is required';
  if (payload.content !== undefined && typeof payload.content !== 'string') return 'Content must be a string';
  if (payload.slug && !/^[a-z0-9-]+$/.test(payload.slug)) return 'Slug may only contain lowercase letters, numbers, and hyphens';
  return null;
}

// ── Alt text validation ──────────────────────────────────────────
function validateAltText(image, altText) {
  if (!image) return null; // no image = no alt needed
  if (!altText || typeof altText !== 'string') return 'Alt text is required for SEO';
  const trimmed = altText.trim();
  if (trimmed.length < 5) return 'Alt text must be at least 5 characters';
  if (trimmed.length > 150) return 'Alt text must be 150 characters or less';
  return null; // valid
}

// ── Payload → DB row mapping ──────────────────────────────────────
function toRow(payload) {
  return {
    title:           payload.title,
    slug:            payload.slug,
    excerpt:         payload.excerpt ?? '',
    content:         sanitizeContent(payload.content ?? ''),
    category:        payload.category ?? '',
    domain_tags:     payload.domain_tags ?? [],
    skill_level:     payload.skill_level ?? 'Beginner',
    read_time:       payload.readTime ?? '',
    author_id:       payload.authorId ?? 'al-editorial',
    image:           payload.image ?? '',
    alt_text:        payload.alt_text ?? '',
    seo:             payload.seo ?? {},
    course_mappings: payload.courseMappings ?? [],
    course_cta:      payload.courseCTA ?? '',
    newsletter:      payload.newsletter ?? {},
    ai_hints:        payload.aiHints ?? {},
    trust:           payload.trust ?? {},
    discussion:      payload.discussion ?? {},
    advanced:        payload.advanced ?? {},
  };
}

// ── Auth helper: verify session + return author slug ─────────────
// Returns { slug } on success, throws on failure.
async function getCallerSlug() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Unauthorized');

  const db = getServiceClient();
  const { data: author } = await db
    .from('authors')
    .select('slug, is_super_admin')
    .ilike('email', user.email)
    .maybeSingle();

  // Allow super-admins to act on any post; regular authors only their own
  return { slug: author?.slug || null, isSuperAdmin: author?.is_super_admin === true };
}

// ── Snapshot helper (save current post state as a version) ────────
async function snapshotVersion(db, postId) {
  // Fetch current post data
  const { data: current, error: fetchErr } = await db
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();
  if (fetchErr || !current) return; // silently skip if post doesn't exist

  // Get next version number
  const { data: latest } = await db
    .from('post_versions')
    .select('version_number')
    .eq('post_id', postId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  await db.from('post_versions').insert({
    post_id:         postId,
    title:           current.title,
    content:         current.content,
    excerpt:         current.excerpt,
    category:        current.category,
    domain_tags:     current.domain_tags,
    skill_level:     current.skill_level,
    image:           current.image,
    alt_text:        current.alt_text ?? '',
    seo:             current.seo,
    course_mappings: current.course_mappings,
    course_cta:      current.course_cta,
    newsletter:      current.newsletter,
    ai_hints:        current.ai_hints,
    trust:           current.trust,
    discussion:      current.discussion,
    advanced:        current.advanced,
    updated_by:      current.author_id || 'al-editorial',
    version_number:  nextVersion,
  });
}

// ── saveDraftAction ───────────────────────────────────────────────
export async function saveDraftAction(payload, id = null) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug } = await getCallerSlug();
    const db = getServiceClient();

    if (payload.authorId) payload = { ...payload, authorId: callerSlug || payload.authorId };

    if (id) {
      // Update existing post — preserve its current status
      const { data: original, error: fetchErr } = await db
        .from('posts')
        .select('slug, status, author_id')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      let slug = payload.slug || toSlug(payload.title);
      const { data: collision } = await db
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .maybeSingle();
      if (collision) {
        // If we're updating a draft and the slug is taken, we can keep the ID suffix
        // as a fallback, but let's be cleaner.
        slug = `${slug}-${id}`;
      }

      const row = {
        ...toRow({ ...payload, slug }),
        status:     original.status || 'Draft',
        updated_at: formatDate(),
      };
      const { error } = await db.from('posts').update(row).eq('id', id);
      if (error) throw error;

      revalidateRoute('/');
      return { success: true, id, slug };
    } else {
      // New draft — INSERT with status="Draft"
      let slug = payload.slug || toSlug(payload.title);
      const { data: existing } = await db
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existing) slug = `${slug}-${Date.now()}`;

      const row = {
        ...toRow({ ...payload, slug }),
        status:       'Draft',
        published_at: '',
        updated_at:   formatDate(),
      };
      const { data, error } = await db.from('posts').insert(row).select('id, slug').single();
      if (error) throw error;

      revalidateRoute('/');
      return { success: true, id: data.id, slug: data.slug };
    }
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('saveDraftAction failed:', msg, error?.code, error?.details);
    return { success: false, error: msg };
  }
}

// ── publishPostAction ─────────────────────────────────────────────
export async function publishPostAction(payload) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug } = await getCallerSlug();
    const db = getServiceClient();

    // Validate alt text
    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    // Ensure author_id is always a valid slug, never a UUID
    if (payload.authorId) payload = { ...payload, authorId: callerSlug || payload.authorId };

    // Build and de-duplicate slug
    let slug = payload.slug || toSlug(payload.title);
    const { data: existing } = await db
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) slug = `${slug}-${Date.now()}`;

    const row = {
      ...toRow({ ...payload, slug }),
      status:       'Published',
      published_at: formatDate(),
      updated_at:   formatDate(),
    };

    const { data, error } = await db.from('posts').insert(row).select('slug').single();
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${data.slug}`);
    return { success: true, slug: data.slug };
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('publishPostAction failed:', msg, error?.code);
    return { success: false, error: msg };
  }
}

// ── updatePostAction ──────────────────────────────────────────────
export async function updatePostAction(id, payload) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    // Validate alt text
    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    // Fetch original to verify ownership + preserve publishedAt
    const { data: original, error: fetchErr } = await db
      .from('posts')
      .select('slug, published_at, status, author_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // Ownership check: only the post author or a super admin can update
    if (!isSuperAdmin && original.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    // ★ Snapshot current version before overwriting
    await snapshotVersion(db, id);

    // Resolve slug collision with other posts
    let slug = payload.slug || toSlug(payload.title);
    const { data: collision } = await db
      .from('posts')
      .select('id, title')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle();
    
    if (collision) {
      return { 
        success: false, 
        error: `URL Conflict: The slug "${slug}" is already used by "${collision.title}". Please change the URL slug to something unique.` 
      };
    }

    const row = {
      ...toRow({ ...payload, slug }),
      status:       original.status || 'Published',
      published_at: original.published_at,
      updated_at:   formatDate(),
    };

    const { error } = await db.from('posts').update(row).eq('id', id);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${slug}`);
    if (original.slug !== slug) revalidateRoute(`/blog/${original.slug}`);
    return { success: true, slug };
  } catch (error) {
    console.error('updatePostAction failed:', error);
    return { success: false, error: 'Failed to update post. Please try again.' };
  }
}

// ── deletePostAction ──────────────────────────────────────────────
export async function deletePostAction(id) {
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const { data: post, error: fetchErr } = await db
      .from('posts')
      .select('slug, author_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (!isSuperAdmin && post.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    // Versions cascade-delete automatically via foreign key
    const { error } = await db.from('posts').delete().eq('id', id);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${post.slug}`);
    return { success: true };
  } catch (error) {
    console.error('deletePostAction failed:', error);
    return { success: false, error: 'Failed to delete post. Please try again.' };
  }
}

// ── togglePostStatusAction ────────────────────────────────────────
export async function togglePostStatusAction(id) {
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const { data: post, error: fetchErr } = await db
      .from('posts')
      .select('status, slug, author_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (!isSuperAdmin && post.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    const newStatus = post.status === 'Published' ? 'Draft' : 'Published';
    const updates = {
      status: newStatus,
      updated_at: formatDate(),
    };
    // Set published_at when publishing
    if (newStatus === 'Published') {
      updates.published_at = formatDate();
    }

    const { error } = await db.from('posts').update(updates).eq('id', id);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${post.slug}`);
    return { success: true, newStatus };
  } catch (error) {
    console.error('togglePostStatusAction failed:', error);
    return { success: false, error: 'Failed to update post status. Please try again.' };
  }
}

// ── schedulePostAction ────────────────────────────────────────────
export async function schedulePostAction(payload, scheduledDate) {
  try {
    const { slug: callerSlug } = await getCallerSlug();
    const db = getServiceClient();

    // Validate alt text
    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    // Ensure author_id is always a valid slug
    if (payload.authorId) payload = { ...payload, authorId: callerSlug || payload.authorId };

    // Build and de-duplicate slug
    let slug = payload.slug || toSlug(payload.title);
    const { data: existing } = await db
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) slug = `${slug}-${Date.now()}`;

    // Validate and format the scheduled date
    const parsedDate = scheduledDate ? new Date(scheduledDate) : null;
    const isValidDate = parsedDate && !isNaN(parsedDate.getTime()) && parsedDate > new Date();
    const publishedAt = isValidDate
      ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Scheduled';

    const row = {
      ...toRow({ ...payload, slug }),
      status:       'Scheduled',
      published_at: publishedAt,
      updated_at:   formatDate(),
    };

    const { error } = await db.from('posts').insert(row);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true, slug };
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('schedulePostAction failed:', msg, error?.code);
    return { success: false, error: msg };
  }
}

// ── fetchVersionsAction ───────────────────────────────────────────
export async function fetchVersionsAction(postId) {
  try {
    await getCallerSlug(); // require auth
    const db = getServiceClient();

    const { data, error } = await db
      .from('post_versions')
      .select('id, post_id, title, content, excerpt, category, domain_tags, skill_level, image, alt_text, seo, course_mappings, course_cta, newsletter, ai_hints, trust, discussion, advanced, updated_by, version_number, created_at')
      .eq('post_id', postId)
      .order('version_number', { ascending: false });

    if (error) throw error;

    const versions = (data || []).map((v) => ({
      ...v,
      createdAt: v.created_at,
      updatedBy: v.updated_by,
      versionNumber: v.version_number,
    }));

    return { success: true, versions };
  } catch (error) {
    console.error('fetchVersionsAction failed:', error);
    return { success: true, versions: [] };
  }
}

// ── restoreVersionAction ──────────────────────────────────────────
export async function restoreVersionAction(postId, versionId) {
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    // Ownership check on the post before restoring
    const { data: postCheck } = await db
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();
    if (postCheck && !isSuperAdmin && postCheck.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    // Fetch the version to restore
    const { data: ver, error: verErr } = await db
      .from('post_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    if (verErr) throw verErr;

    // Snapshot CURRENT post state before restoring (never overwrite history)
    await snapshotVersion(db, postId);

    // Overwrite the post with version data
    const { error: updateErr } = await db.from('posts').update({
      title:           ver.title,
      content:         ver.content,
      excerpt:         ver.excerpt,
      category:        ver.category,
      domain_tags:     ver.domain_tags,
      skill_level:     ver.skill_level,
      image:           ver.image,
      alt_text:        ver.alt_text,
      seo:             ver.seo,
      course_mappings: ver.course_mappings,
      course_cta:      ver.course_cta,
      newsletter:      ver.newsletter,
      ai_hints:        ver.ai_hints,
      trust:           ver.trust,
      discussion:      ver.discussion,
      advanced:        ver.advanced,
      updated_at:      formatDate(),
    }).eq('id', postId);
    if (updateErr) throw updateErr;

    // Fetch updated post to return
    const { data: updated } = await db
      .from('posts')
      .select('slug')
      .eq('id', postId)
      .single();

    revalidateRoute('/');
    revalidateRoute('/blog');
    if (updated) revalidateRoute(`/blog/${updated.slug}`);
    return { success: true, restoredVersion: ver.version_number };
  } catch (error) {
    console.error('restoreVersionAction failed:', error);
    return { success: false, error: 'Failed to restore version. Please try again.' };
  }
}

// ── subscribeAction ───────────────────────────────────────────────
export async function subscribeAction({ email, name = '', source = 'newsletter' }) {
  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { success: false, error: 'A valid email is required.' };
    }

    const db = getServiceClient();

    const { error } = await db.from('subscribers').upsert(
      { email: email.trim().toLowerCase(), name: name.trim(), source },
      { onConflict: 'email', ignoreDuplicates: true }
    );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('subscribeAction failed:', error);
    // Don't reveal DB details to client
    if (error.code === '23505') return { success: true }; // already subscribed
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

// ── fetchSubscribersAction (admin) ────────────────────────────────
// Returns the full subscribers list, newest first. Admin-only.
export async function fetchSubscribersAction() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('subscribers')
      .select('id, email, name, source, subscribed_at, is_active')
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    return { success: true, subscribers: data || [] };
  } catch (error) {
    console.error('fetchSubscribersAction failed:', error);
    return { success: false, error: 'Failed to fetch subscribers.' };
  }
}

// ── toggleSubscriberAction (admin) ────────────────────────────────
export async function toggleSubscriberAction(id, isActive) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db
      .from('subscribers')
      .update({ is_active: !!isActive })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('toggleSubscriberAction failed:', error);
    return { success: false, error: 'Failed to update subscriber.' };
  }
}

// ── deleteSubscriberAction (admin) ────────────────────────────────
export async function deleteSubscriberAction(id) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('subscribers').delete().eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('deleteSubscriberAction failed:', error);
    return { success: false, error: 'Failed to delete subscriber.' };
  }
}

// ── postCommentAction ─────────────────────────────────────────────
// Comments are inserted with status='pending' and must be approved
// by an admin before appearing publicly. Returns { pending: true }
// so the UI can show a "awaiting moderation" message instead of
// immediately appending the comment.
//
// IMPORTANT: Never throw inside a server action in production.
// Next.js intercepts thrown errors and replaces them with a generic
// sanitized message, preventing real error info from reaching the client.
export async function postCommentAction(input) {
  try {
    const postSlug = input?.postSlug;
    const userName = String(input?.userName || 'Anonymous').trim();
    const text = String(input?.text || '').trim();
    const parentCommentId = input?.parentCommentId ? parseInt(input.parentCommentId, 10) : null;

    if (!postSlug) {
      return { success: false, error: 'Post identifier is missing.' };
    }
    if (!text) {
      return { success: false, error: 'Comment text is required.' };
    }

    const db = getServiceClient();
    if (!db) {
      return { success: false, error: 'Database connection failed.' };
    }

    const row = {
      post_slug: String(postSlug).slice(0, 200),
      user_name: userName.slice(0, 50),
      text: text.slice(0, 2000),
      parent_comment_id: parentCommentId,
      likes: 0,
      status: 'pending',
    };

    const { error: dbError } = await db.from('comments').insert(row);

    if (dbError) {
      console.error('postCommentAction DB error:', dbError.message, dbError.code, dbError.details);
      return { success: false, error: dbError.message || 'Database error' };
    }

    return { success: true, pending: true };
  } catch (err) {
    console.error('postCommentAction crashed:', err);
    return { success: false, error: String(err?.message || 'Internal server error') };
  }
}

// ── likeCommentAction ─────────────────────────────────────────────
export async function likeCommentAction(commentId, delta = 1) {
  try {
    const db = getServiceClient();

    // Fetch current likes
    const { data: current, error: fetchErr } = await db
      .from('comments')
      .select('likes')
      .eq('id', commentId)
      .single();
    if (fetchErr) {
      console.error('likeCommentAction fetch error:', fetchErr.message);
      return { success: false, error: String(fetchErr.message) };
    }

    const newLikes = Math.max(0, (current.likes || 0) + delta);

    const { error: updateErr } = await db
      .from('comments')
      .update({ likes: newLikes })
      .eq('id', commentId);
    if (updateErr) {
      console.error('likeCommentAction update error:', updateErr.message);
      return { success: false, error: String(updateErr.message) };
    }

    revalidateRoute('/');
    return { success: true, likes: newLikes };
  } catch (err) {
    console.error('likeCommentAction crashed:', err);
    return { success: false, error: String(err?.message || 'Failed to like comment.') };
  }
}

// ── fetchCommentsAction ───────────────────────────────────────────
// Only returns comments with status='approved' for public display.
export async function fetchCommentsAction(postSlug) {
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
      console.error('fetchCommentsAction error:', fetchErr.message);
      return { success: true, comments: [] }; // graceful fallback
    }

    // Build nested tree: separate top-level from replies
    const topLevel = [];
    const replyMap = {};

    for (const row of data || []) {
      const comment = {
        id: row.id,
        user: row.user_name,
        text: row.text,
        likes: row.likes || 0,
        time: formatRelativeTime(row.created_at),
        parentCommentId: row.parent_comment_id,
        createdAt: row.created_at,
        replies: [],
      };
      if (row.parent_comment_id) {
        if (!replyMap[row.parent_comment_id]) replyMap[row.parent_comment_id] = [];
        replyMap[row.parent_comment_id].push(comment);
      } else {
        topLevel.push(comment);
      }
    }

    // Attach replies to parents
    for (const c of topLevel) {
      c.replies = (replyMap[c.id] || []).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    return { success: true, comments: topLevel };
  } catch (error) {
    console.error('fetchCommentsAction failed:', error);
    return { success: true, comments: [] }; // graceful fallback
  }
}

// ── fetchPendingCommentsAction ────────────────────────────────────
// Returns all comments awaiting moderation. Super-admin only.
export async function fetchPendingCommentsAction() {
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
    console.error('fetchPendingCommentsAction failed:', error);
    return { success: false, error: 'Failed to fetch pending comments.' };
  }
}

// ── fetchApprovedCommentsAction ───────────────────────────────────
// Returns all approved comments for management. Super-admin only.
export async function fetchApprovedCommentsAction() {
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
    console.error('fetchApprovedCommentsAction failed:', error);
    return { success: false, error: 'Failed to fetch approved comments.' };
  }
}

// ── approveCommentAction ──────────────────────────────────────────
// Sets a comment status to 'approved', making it publicly visible.
export async function approveCommentAction(commentId) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db
      .from('comments')
      .update({ status: 'approved' })
      .eq('id', commentId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('approveCommentAction failed:', error);
    return { success: false, error: 'Failed to approve comment.' };
  }
}

// ── rejectCommentAction ───────────────────────────────────────────
// Permanently deletes a rejected comment from the database.
export async function rejectCommentAction(commentId) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('rejectCommentAction failed:', error);
    return { success: false, error: 'Failed to reject comment.' };
  }
}

// ── batchModerateCommentsAction ──────────────────────────────────
// Approves or rejects multiple comments in one call.
export async function batchModerateCommentsAction(commentIds, action) {
  try {
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return { success: false, error: 'No comments provided' };
    }
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();

    if (action === 'approve') {
      const { error } = await db
        .from('comments')
        .update({ status: 'approved' })
        .in('id', commentIds);
      if (error) throw error;
    } else if (action === 'reject') {
      const { error } = await db
        .from('comments')
        .delete()
        .in('id', commentIds);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('batchModerateCommentsAction failed:', error);
    return { success: false, error: `Failed to ${action} comments.` };
  }
}

// ── Time formatting helper ────────────────────────────────────────
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

// ── adminCreateUserAction ─────────────────────────────────────────
export async function adminCreateUserAction({ 
  email, name, password, role, 
  bio = '', linkedin = '', experience = '', expertise = '', image = '', position = ''
}) {
  try {
    if (!email || !password || !name) {
      return { success: false, error: 'Email, name, and password are required.' };
    }

    // 1. Verify Requesting User's Auth and Super Admin Status
    const supabaseSession = await createClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    
    if (authErr || !user) {
      return { success: false, error: 'Unauthorized: Not logged in.' };
    }

    // Connect DB to check role
    const db = getServiceClient(); // We use service client to ensure we can read all data
    const { data: requestor, error: reqErr } = await db
      .from('authors')
      .select('is_super_admin')
      .ilike('email', user.email)
      .maybeSingle();

    if (reqErr || !requestor?.is_super_admin) {
      return { success: false, error: 'Forbidden: You must be a Super Admin to perform this action.' };
    }

    // 2. Provision new user in Supabase Auth using Service Role bypass
    const { error: createUserErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createUserErr) {
      // Supabase returns these codes/messages when the auth user already exists
      const alreadyExists =
        createUserErr.message?.toLowerCase().includes('already') ||
        createUserErr.message?.toLowerCase().includes('registered') ||
        createUserErr.code === 'email_exists' ||
        createUserErr.code === 'user_already_exists' ||
        createUserErr.status === 422;
      if (!alreadyExists) throw createUserErr;
    }

    // 3. Create or update Author Record
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();
    const isSuperAdmin = role === 'admin';

    // Check if this author already exists so we never downgrade an existing super admin
    const { data: existingAuthor } = await db
      .from('authors')
      .select('slug, is_super_admin')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Preserve super admin if the existing record already has it
    const finalIsSuperAdmin = existingAuthor?.is_super_admin ? true : isSuperAdmin;
    // Reuse existing slug if present, otherwise generate a new one
    const slug = existingAuthor?.slug || (toSlug(name) + '-' + Math.floor(Math.random() * 1000));

    const row = {
      slug,
      name,
      email: normalizedEmail,
      is_super_admin: finalIsSuperAdmin,
      initials,
      color: '#0f2554',
      bio,
      linkedin,
      experience,
      expertise: expertise.split(',').map(t => t.trim()).filter(Boolean),
      image,
      position
    };

    let dbErr;
    if (existingAuthor) {
      // Update existing row by slug (primary key)
      const { error } = await db
        .from('authors')
        .update(row)
        .eq('slug', existingAuthor.slug);
      dbErr = error;
    } else {
      const { error } = await db.from('authors').insert(row);
      dbErr = error;
    }

    if (dbErr) throw dbErr;

    return { success: true };
  } catch (error) {
    console.error('adminCreateUserAction failed:', error);
    // Surface specific known errors to the UI for clarity
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('password')) return { success: false, error: 'Password too weak (min 6 characters).' };
    if (msg.toLowerCase().includes('email')) return { success: false, error: 'Invalid or already-registered email.' };
    return { success: false, error: 'Failed to create user. Please try again.' };
  }
}

// ── updateAuthorProfileAction ────────────────────────────────────
export async function updateAuthorProfileAction({ name, bio, linkedin, experience, expertise, image, position }) {
  try {
    const supabaseSession = await createClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    
    if (authErr || !user) {
      return { success: false, error: 'Unauthorized: Not logged in.' };
    }

    const db = getServiceClient();
    
    // We update the author row where email matches the current user
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    
    const { error } = await db
      .from('authors')
      .update({
        name,
        initials,
        bio,
        linkedin,
        experience,
        expertise: (expertise || '').split(',').map(t => t.trim()).filter(Boolean),
        image,
        position,
      })
      .ilike('email', user.email);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('updateAuthorProfileAction failed:', error);
    return { success: false, error: 'Failed to update profile. Please try again.' };
  }
}

// ── Super-admin guard helper ──────────────────────────────────────
async function requireSuperAdmin() {
  const supabaseSession = await createClient();
  const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
  if (authErr || !user) throw new Error('Unauthorized');

  const db = getServiceClient();
  const { data: author } = await db
    .from('authors')
    .select('is_super_admin')
    .ilike('email', user.email)
    .maybeSingle();

  if (!author?.is_super_admin) throw new Error('Forbidden: Super admin required.');
  return db;
}

// ── Any-author guard helper ───────────────────────────────────────
async function requireAuth() {
  const supabaseSession = await createClient();
  const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
  if (authErr || !user) throw new Error('Unauthorized');
  return getServiceClient();
}

// ── createCourseAction ────────────────────────────────────────────
export async function createCourseAction({ title, label, description, image, url, duration, rating, domain_tags }) {
  try {
    const db = await requireAuth();
    const { data: last } = await db
      .from('courses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (last?.sort_order ?? -1) + 1;

    const { data, error } = await db.from('courses').insert({
      title,
      label: label || '',
      description: description || '',
      image: image || '',
      url: url || '#',
      duration: duration || '',
      rating: parseFloat(rating) || 4.5,
      domain_tags: Array.isArray(domain_tags) ? domain_tags : [],
      sort_order: nextOrder,
      is_active: true,
    }).select().single();

    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true, course: data };
  } catch (error) {
    console.error('createCourseAction failed:', error);
    return { success: false, error: error.message || 'Failed to create course.' };
  }
}

// ── updateCourseAction ────────────────────────────────────────────
export async function updateCourseAction(id, { title, label, description, image, url, duration, rating, domain_tags }) {
  try {
    const db = await requireAuth();
    const { error } = await db.from('courses').update({
      title,
      label: label || '',
      description: description || '',
      image: image || '',
      url: url || '#',
      duration: duration || '',
      rating: parseFloat(rating) || 4.5,
      domain_tags: Array.isArray(domain_tags) ? domain_tags : [],
    }).eq('id', id);

    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('updateCourseAction failed:', error);
    return { success: false, error: error.message || 'Failed to update course.' };
  }
}

// ── deleteCourseAction ────────────────────────────────────────────
export async function deleteCourseAction(id) {
  try {
    const db = await requireSuperAdmin();
    const { error } = await db.from('courses').delete().eq('id', id);
    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('deleteCourseAction failed:', error);
    return { success: false, error: error.message || 'Failed to delete course.' };
  }
}

// ── upsertTopicsAction ────────────────────────────────────────────
export async function upsertTopicsAction(topics) {
  try {
    if (!Array.isArray(topics)) return { success: false, error: 'Topics must be an array.' };
    const db = await requireAuth();
    const { error } = await db.from('site_config').upsert(
      { key: 'topics', value: topics },
      { onConflict: 'key' }
    );
    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('upsertTopicsAction failed:', error);
    return { success: false, error: error.message || 'Failed to save topics.' };
  }
}

// ── Super admin: toggle another author's is_super_admin flag ─────
export async function toggleSuperAdminAction(targetSlug, makeSuperAdmin) {
  try {
    const db = await requireSuperAdmin();

    // Self-demotion safety: block if this would leave zero super admins
    if (makeSuperAdmin === false) {
      const { data: admins } = await db
        .from('authors')
        .select('slug')
        .eq('is_super_admin', true);
      if (admins && admins.length <= 1 && admins[0]?.slug === targetSlug) {
        return { success: false, error: 'Cannot remove the last super admin.' };
      }
    }

    const { data, error } = await db
      .from('authors')
      .update({ is_super_admin: !!makeSuperAdmin })
      .eq('slug', targetSlug)
      .select('slug, name, is_super_admin')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, author: data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to toggle super admin.' };
  }
}

// ── Super admin: update /blog page config (featured posts + carousels) ─
export async function updateBlogPageConfigAction({ featuredSlugs = [], carousels = [], categoriesWidget = null }) {
  try {
    const db = await requireSuperAdmin();

    // Fetch current zones so we don't wipe other zones
    const { data: existing } = await db
      .from('site_config')
      .select('zones')
      .eq('key', 'global')
      .maybeSingle();

    const currentZones = existing?.zones || {};

    // Validate inputs
    const cleanFeatured = Array.isArray(featuredSlugs)
      ? featuredSlugs.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];

    const cleanCarousels = Array.isArray(carousels)
      ? carousels
          .map((c) => ({
            id:       String(c.id || '').trim() || `carousel-${Math.random().toString(36).slice(2, 8)}`,
            title:    String(c.title || 'Untitled').trim(),
            source:   c.source === 'category' || c.source === 'tag' || c.source === 'manual' ? c.source : 'latest',
            category: String(c.category || '').trim(),
            slugs:    Array.isArray(c.slugs) ? c.slugs.filter(Boolean) : [],
            limit:    Math.min(Math.max(parseInt(c.limit) || 10, 1), 30),
            enabled:  c.enabled !== false,
          }))
          .slice(0, 10)
      : [];

    // Preserve existing widget config when caller omits it (partial update)
    const existingWidget = currentZones?.blog_page?.categories_widget || null;
    const cw = categoriesWidget ?? existingWidget;
    const cleanCategoriesWidget = cw && typeof cw === 'object'
      ? {
          enabled:    cw.enabled !== false,
          title:      String(cw.title || 'Categories').trim().slice(0, 60),
          mode:       cw.mode === 'manual' ? 'manual' : 'auto',
          limit:      Math.min(Math.max(parseInt(cw.limit) || 12, 1), 30),
          categories: Array.isArray(cw.categories)
            ? cw.categories.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
            : [],
        }
      : {
          enabled: true,
          title: 'Categories',
          mode: 'auto',
          limit: 12,
          categories: [],
        };

    const newZones = {
      ...currentZones,
      blog_page: {
        featured_slugs:    cleanFeatured,
        carousels:         cleanCarousels,
        categories_widget: cleanCategoriesWidget,
      },
    };

    const { error: upsertErr } = await db
      .from('site_config')
      .upsert({
        key: 'global',
        zones: newZones,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (upsertErr) return { success: false, error: upsertErr.message };

    revalidateRoute('/blog');
    revalidateRoute('/');
    return { success: true, config: newZones.blog_page };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to update blog config.' };
  }
}

/** Increment/Decrement like count on an article */
export async function likePostAction(slug, delta) {
  try {
    const db = getServiceClient();
    
    // 1. Get current likes
    const { data, error: fetchErr } = await db
      .from('posts')
      .select('likes')
      .eq('slug', slug)
      .single();

    if (fetchErr) {
      console.error(`[likePostAction] Fetch error for slug ${slug}:`, fetchErr.message, fetchErr.code);
      return { success: false, error: `Article not found or DB error: ${fetchErr.message}` };
    }

    // data.likes might be undefined if column missing but query didn't throw
    const currentLikes = typeof data?.likes === 'number' ? data.likes : 0;
    const newLikes = Math.max(0, currentLikes + delta);

    // 2. Update
    const { error: updateErr } = await db
      .from('posts')
      .update({ likes: newLikes })
      .eq('slug', slug);

    if (updateErr) {
      console.error(`[likePostAction] Update error for slug ${slug}:`, updateErr.message, updateErr.code);
      return { success: false, error: `Database update failed: ${updateErr.message}` };
    }

    console.log(`[likePostAction] Successfully updated ${slug}: ${currentLikes} -> ${newLikes}`);

    revalidateRoute(`/blog/${slug}`);
    revalidateRoute('/');
    return { success: true, likes: newLikes };
  } catch (err) {
    console.error('[likePostAction] Crashed:', err);
    return { success: false, error: String(err?.message || 'Failed to like article.') };
  }
}

// ── Redirect Management Actions (Studio) ──────────────────────────

/** Fetch all configured redirects. Super-admin only. */
export async function fetchRedirectsAction() {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { data, error } = await db
      .from('redirects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, redirects: data || [] };
  } catch (error) {
    console.error('fetchRedirectsAction failed:', error);
    return { success: false, error: error.message || 'Failed to fetch redirects.' };
  }
}

/** Create or update a redirect entry. Super-admin only. */
export async function saveRedirectAction(payload, id = null) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    if (!payload.source || !payload.destination) {
      return { success: false, error: 'Source and destination are required.' };
    }

    const db = getServiceClient();
    const row = {
      source:      payload.source.trim(),
      destination: payload.destination.trim(),
      type:        parseInt(payload.type || '301', 10),
      active:      payload.active !== false,
      updated_at:  new Date().toISOString(),
    };

    if (id) {
      const { error } = await db.from('redirects').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('redirects').insert(row);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('saveRedirectAction failed:', error);
    if (error.code === '23505') return { success: false, error: 'A redirect for this source already exists.' };
    return { success: false, error: error.message || 'Failed to save redirect.' };
  }
}

/** Delete a redirect entry. Super-admin only. */
export async function deleteRedirectAction(id) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('redirects').delete().eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('deleteRedirectAction failed:', error);
    return { success: false, error: error.message || 'Failed to delete redirect.' };
  }
}
