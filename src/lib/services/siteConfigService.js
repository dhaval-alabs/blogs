import { requireSuperAdmin, getCallerSlug } from '@/lib/infrastructure/auth';
import { getServiceClient } from '@/lib/supabase';
import { revalidateRoute } from '@/lib/utils/core';

export async function upsertTopics(topics) {
  try {
    if (!Array.isArray(topics)) return { success: false, error: 'Topics must be an array.' };
    const db = await requireSuperAdmin();
    const { error } = await db.from('site_config').upsert(
      { key: 'topics', value: topics },
      { onConflict: 'key' }
    );
    if (error) throw error;
    revalidateRoute('/');
    revalidateRoute('/blog');
    return { success: true };
  } catch (error) {
    console.error('upsertTopics failed:', error);
    return { success: false, error: error.message || 'Failed to save topics.' };
  }
}

export async function updateBlogPageConfig({ featuredSlugs = [], carousels = [], categoriesWidget = null }) {
  try {
    const db = await requireSuperAdmin();

    const { data: existing } = await db
      .from('site_config')
      .select('zones')
      .eq('key', 'global')
      .maybeSingle();

    const currentZones = existing?.zones || {};

    const cleanFeatured = Array.isArray(featuredSlugs)
      ? featuredSlugs.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];

    const cleanCarousels = Array.isArray(carousels)
      ? carousels
        .map((c) => ({
          id: String(c.id || '').trim() || `carousel-${Math.random().toString(36).slice(2, 8)}`,
          title: String(c.title || 'Untitled').trim(),
          source: c.source === 'category' || c.source === 'tag' || c.source === 'manual' ? c.source : 'latest',
          category: String(c.category || '').trim(),
          slugs: Array.isArray(c.slugs) ? c.slugs.filter(Boolean) : [],
          limit: Math.min(Math.max(parseInt(c.limit) || 10, 1), 30),
          enabled: c.enabled !== false,
        }))
        .slice(0, 10)
      : [];

    const existingWidget = currentZones?.blog_page?.categories_widget || null;
    const cw = categoriesWidget ?? existingWidget;
    const cleanCategoriesWidget = cw && typeof cw === 'object'
      ? {
        enabled: cw.enabled !== false,
        title: String(cw.title || 'Categories').trim().slice(0, 60),
        mode: cw.mode === 'manual' ? 'manual' : 'auto',
        limit: Math.min(Math.max(parseInt(cw.limit) || 12, 1), 30),
        categories: Array.isArray(cw.categories)
          ? cw.categories.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
          : [],
      }
      : { enabled: true, title: 'Categories', mode: 'auto', limit: 12, categories: [] };

    const newZones = {
      ...currentZones,
      blog_page: {
        featured_slugs: cleanFeatured,
        carousels: cleanCarousels,
        categories_widget: cleanCategoriesWidget,
      },
    };

    const { error: upsertErr } = await db
      .from('site_config')
      .upsert({ key: 'global', zones: newZones, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (upsertErr) return { success: false, error: upsertErr.message };

    revalidateRoute('/blog');
    revalidateRoute('/');
    return { success: true, config: newZones.blog_page };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to update blog config.' };
  }
}

export async function fetchRedirects() {
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
    console.error('fetchRedirects failed:', error);
    return { success: false, error: error.message || 'Failed to fetch redirects.' };
  }
}

export async function saveRedirect(payload, id = null) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    if (!payload.source || !payload.destination) {
      return { success: false, error: 'Source and destination are required.' };
    }

    // Normalize source so lookups match regardless of how the admin typed it.
    // The proxy strips trailing slashes before lookup (see src/proxy.js), so
    // sources stored with a trailing slash would silently never match.
    const normalizeSource = (s) => {
      let v = s.trim();
      if (!v.startsWith('/') && !v.startsWith('http')) v = '/' + v;
      if (v.length > 1) v = v.replace(/\/+$/, '');
      return v;
    };

    const db = getServiceClient();
    const row = {
      source: normalizeSource(payload.source),
      destination: payload.destination.trim(),
      type: parseInt(payload.type || '301', 10),
      active: payload.active !== false,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await db.from('redirects').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('redirects').insert(row);
      if (error) throw error;
    }

    // Push the new state to Edge Config. Fire-and-forget on failures so an
    // Edge Config outage doesn't block the admin save.
    const { syncRedirectsToEdgeConfig } = await import('@/lib/infrastructure/redirects');
    syncRedirectsToEdgeConfig().catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('saveRedirect failed:', error);
    if (error.code === '23505') return { success: false, error: 'A redirect for this source already exists.' };
    return { success: false, error: error.message || 'Failed to save redirect.' };
  }
}

export async function deleteRedirect(id) {
  try {
    const { isSuperAdmin } = await getCallerSlug();
    if (!isSuperAdmin) return { success: false, error: 'Unauthorized' };

    const db = getServiceClient();
    const { error } = await db.from('redirects').delete().eq('id', id);
    if (error) throw error;

    const { syncRedirectsToEdgeConfig } = await import('@/lib/infrastructure/redirects');
    syncRedirectsToEdgeConfig().catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('deleteRedirect failed:', error);
    return { success: false, error: error.message || 'Failed to delete redirect.' };
  }
}
