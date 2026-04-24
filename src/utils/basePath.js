export function withBasePath(path) {
  if (!path) return "";
  // Don't modify absolute URLs
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  // Blog is served under /blog/ in production via an upstream proxy, so static
  // assets and same-origin links must be prefixed. NEXT_PUBLIC_BASE_PATH
  // overrides this if set (e.g. for staging on a different subpath).
  const base =
    process.env.NEXT_PUBLIC_BASE_PATH ||
    (process.env.NODE_ENV === "production" ? "/blog" : "");
  if (!base) return path;

  // Ensure path starts with a slash if we have a base path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const url = withBasePath(path);
  return fetch(url, options);
}
