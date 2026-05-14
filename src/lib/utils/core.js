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
