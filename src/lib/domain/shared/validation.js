export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid payload';
  if (!payload.title?.trim()) return 'Title is required';
  if (payload.content !== undefined && typeof payload.content !== 'string') return 'Content must be a string';
  if (payload.slug && !/^[a-z0-9-]+$/.test(payload.slug)) return 'Slug may only contain lowercase letters, numbers, and hyphens';
  return null;
}

export function validateAltText(image, altText) {
  if (!image) return null;
  if (!altText || typeof altText !== 'string') return 'Alt text is required for SEO';
  const trimmed = altText.trim();
  if (trimmed.length < 5) return 'Alt text must be at least 5 characters';
  if (trimmed.length > 150) return 'Alt text must be 150 characters or less';
  return null;
}
