export function withBasePath(path) {
  if (!path) return "";
  // Don't modify absolute URLs
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!base) return path;

  // Ensure path starts with a slash if we have a base path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const url = withBasePath(path);
  return fetch(url, options);
}
