import { getServiceClient } from '@/lib/supabase';
import { toSlug, formatDate } from '@/lib/utils/core';
import { revalidateRoute } from '@/lib/infrastructure/cache';
import { validatePayload, validateAltText } from '@/lib/domain/shared/validation';
import { getCallerSlug } from '@/lib/infrastructure/auth';
import { toRow } from '@/lib/domain/posts/mappers';

export async function snapshotVersion(db, postId) {
  // Delegates to the snapshot_post_version Postgres function, which runs
  // under a row lock and a single transaction — eliminating the
  // version_number race that the JS read-modify-write loop had.
  const { error } = await db.rpc('snapshot_post_version', { p_post_id: postId });
  if (error) throw error;
}

export async function saveDraft(payload, id = null) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    if (payload.authorId) {
      payload = {
        ...payload,
        authorId: (isSuperAdmin && payload.authorId) ? payload.authorId : (callerSlug || 'al-editorial')
      };
    }

    if (id) {
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
        slug = `${slug}-${id}`;
      }

      const row = {
        ...toRow({ ...payload, slug }),
        status: original.status || 'Draft',
        updated_at: formatDate(),
      };
      const { error } = await db.from('posts').update(row).eq('id', id);
      if (error) throw error;

      revalidateRoute('/');
      return { success: true, id, slug };
    } else {
      let slug = payload.slug || toSlug(payload.title);
      const { data: existing } = await db
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existing) { if (payload.slug) return { success: false, error: `URL Conflict: The slug "${slug}" is already in use.` }; slug = `${slug}-${Date.now()}`; }

      const row = {
        ...toRow({ ...payload, slug }),
        status: 'Draft',
        published_at: null,
        updated_at: formatDate(),
      };
      const { data, error } = await db.from('posts').insert(row).select('id, slug').single();
      if (error) throw error;

      revalidateRoute('/');
      return { success: true, id: data.id, slug: data.slug };
    }
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('saveDraft failed:', msg, error?.code, error?.details);
    return { success: false, error: msg };
  }
}

export async function publishPost(payload) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    if (payload.authorId) {
      payload = {
        ...payload,
        authorId: (isSuperAdmin && payload.authorId) ? payload.authorId : (callerSlug || 'al-editorial')
      };
    }

    let slug = payload.slug || toSlug(payload.title);
    const { data: existing } = await db
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) { if (payload.slug) return { success: false, error: `URL Conflict: The slug "${slug}" is already in use.` }; slug = `${slug}-${Date.now()}`; }

    const row = {
      ...toRow({ ...payload, slug }),
      status: 'Published',
      published_at: formatDate(),
      updated_at: formatDate(),
    };

    const { data, error } = await db.from('posts').insert(row).select('slug').single();
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${data.slug}`);
    return { success: true, slug: data.slug };
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('publishPost failed:', msg, error?.code);
    return { success: false, error: msg };
  }
}

export async function updatePost(id, payload) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    const { data: original, error: fetchErr } = await db
      .from('posts')
      .select('slug, published_at, status, author_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (!isSuperAdmin && original.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    let slug = payload.slug || toSlug(payload.title);

    let publishedAt = original.published_at;
    if (payload.publishDate) {
      try {
        const d = new Date(payload.publishDate);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      } catch { }
    }

    const row = {
      ...toRow({ ...payload, slug }),
      status: original.status || 'Published',
      published_at: publishedAt,
      updated_at: formatDate(),
    };

    const { data: rpcResult, error: rpcErr } = await db.rpc('update_post_atomic', {
      p_id: id,
      p_row: row,
    });
    if (rpcErr) throw rpcErr;
    if (!rpcResult?.ok) {
      return { success: false, error: rpcResult?.error || 'Failed to update post.' };
    }

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${slug}`);
    if (original.slug !== slug) revalidateRoute(`/blog/${original.slug}`);
    return { success: true, slug };
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('updatePost failed:', msg, error?.code, error?.details, error?.hint);
    return { success: false, error: msg };
  }
}

export async function publishExistingDraft(id, payload) {
  const validationError = validatePayload(payload);
  if (validationError) return { success: false, error: validationError };
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    const { data: original, error: fetchErr } = await db
      .from('posts')
      .select('slug, published_at, status, author_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (!isSuperAdmin && original.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    let slug = payload.slug || toSlug(payload.title);

    let publishedAt = original.published_at || formatDate();
    if (payload.publishDate) {
      try {
        const d = new Date(payload.publishDate);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      } catch { }
    }

    const row = {
      ...toRow({ ...payload, slug }),
      status: 'Published',
      published_at: publishedAt,
      updated_at: formatDate(),
    };

    const { data: rpcResult, error: rpcErr } = await db.rpc('update_post_atomic', {
      p_id: id,
      p_row: row,
    });
    if (rpcErr) throw rpcErr;
    if (!rpcResult?.ok) {
      return { success: false, error: rpcResult?.error || 'Failed to publish post.' };
    }

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${slug}`);
    if (original.slug !== slug) revalidateRoute(`/blog/${original.slug}`);
    return { success: true, slug };
  } catch (error) {
    console.error('publishExistingDraft failed:', error);
    return { success: false, error: 'Failed to publish post. Please try again.' };
  }
}

export async function deletePost(id) {
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

    const { error } = await db.from('posts').delete().eq('id', id);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    revalidateRoute(`/blog/${post.slug}`);
    return { success: true };
  } catch (error) {
    console.error('deletePost failed:', error);
    return { success: false, error: 'Failed to delete post. Please try again.' };
  }
}

export async function togglePostStatus(id) {
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
    console.error('togglePostStatus failed:', error);
    return { success: false, error: 'Failed to update post status. Please try again.' };
  }
}

export async function schedulePost(payload, scheduledDate) {
  try {
    const { slug: callerSlug } = await getCallerSlug();
    const db = getServiceClient();

    const altErr = validateAltText(payload.image, payload.alt_text);
    if (altErr) return { success: false, error: altErr };

    if (payload.authorId) payload = { ...payload, authorId: callerSlug || payload.authorId };

    let slug = payload.slug || toSlug(payload.title);
    const { data: existing } = await db
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) { if (payload.slug) return { success: false, error: `URL Conflict: The slug "${slug}" is already in use.` }; slug = `${slug}-${Date.now()}`; }

    const parsedDate = scheduledDate ? new Date(scheduledDate) : null;
    const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
    const publishedAt = isValidDate ? parsedDate.toISOString() : new Date().toISOString();

    const row = {
      ...toRow({ ...payload, slug }),
      status: 'Scheduled',
      published_at: publishedAt,
      updated_at: formatDate(),
    };

    const { error } = await db.from('posts').insert(row);
    if (error) throw error;

    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true, slug };
  } catch (error) {
    const msg = error?.message || error?.toString() || 'Unknown error';
    console.error('schedulePost failed:', msg, error?.code);
    return { success: false, error: msg };
  }
}

export async function fetchVersions(postId) {
  try {
    await getCallerSlug();
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
    console.error('fetchVersions failed:', error);
    return { success: true, versions: [] };
  }
}

export async function restoreVersion(postId, versionId) {
  try {
    const { slug: callerSlug, isSuperAdmin } = await getCallerSlug();
    const db = getServiceClient();

    const { data: postCheck } = await db
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();
    if (postCheck && !isSuperAdmin && postCheck.author_id !== callerSlug) {
      return { success: false, error: 'Forbidden: you do not own this post.' };
    }

    const { data: ver, error: verErr } = await db
      .from('post_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    if (verErr) throw verErr;

    await snapshotVersion(db, postId);

    const { error: updateErr } = await db.from('posts').update({
      title: ver.title,
      content: ver.content,
      excerpt: ver.excerpt,
      category: ver.category,
      domain_tags: ver.domain_tags,
      skill_level: ver.skill_level,
      image: ver.image,
      alt_text: ver.alt_text,
      seo: ver.seo,
      course_mappings: ver.course_mappings,
      course_cta: ver.course_cta,
      newsletter: ver.newsletter,
      ai_hints: ver.ai_hints,
      trust: ver.trust,
      discussion: ver.discussion,
      advanced: ver.advanced,
      updated_at: formatDate(),
    }).eq('id', postId);
    if (updateErr) throw updateErr;

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
    console.error('restoreVersion failed:', error);
    return { success: false, error: 'Failed to restore version. Please try again.' };
  }
}

export async function likePost(slug, delta) {
  try {
    const db = getServiceClient();
    const { data: newLikes, error } = await db.rpc('increment_post_likes', {
      p_slug: slug,
      p_delta: delta,
    });
    if (error) {
      console.error(`[likePost] RPC error for slug ${slug}:`, error.message, error.code);
      return { success: false, error: String(error.message) };
    }

    revalidateRoute(`/blog/${slug}`);
    revalidateRoute('/');
    return { success: true, likes: newLikes };
  } catch (err) {
    console.error('[likePost] Crashed:', err);
    return { success: false, error: String(err?.message || 'Failed to like article.') };
  }
}
