import { revalidatePath } from 'next/cache';

export function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export function formatDate() {
  return new Date().toISOString();
}

// next.config.mjs has trailingSlash: true, so routes are registered as /blog/slug/
// not /blog/slug — revalidatePath must use the same trailing-slash form.
export function revalidateRoute(path) {
  const normalized = path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`;
  revalidatePath(normalized);
}

// The sitemap is a metadata route handler at /blog/sitemap.xml. Called on
// every change that can alter its URL list or a <lastmod>: publish,
// unpublish, delete, (re)schedule, slug or updated_at changes, and
// redirect saves. Its hourly `revalidate` hasn't been refreshing it in
// production, so this keeps it current regardless.
// The 'layout' type is required: with trailingSlash the route's cache tags
// are `/blog/sitemap.xml/` and `/blog/sitemap.xml/layout`, and a plain
// revalidatePath (with or without the slash) matches neither — verified on a
// production build, where only the 'layout' form regenerated it.
export function revalidateSitemap() {
  revalidatePath('/blog/sitemap.xml', 'layout');
}
