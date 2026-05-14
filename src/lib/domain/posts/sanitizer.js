// Runs server-side before DB storage. Normalizes widget data-widget-attrs:
//   - Migrates old string-array steps → {text,url}[] for nextsteps widgets
//   - Removes any leaked editor-only keys
export function sanitizeContent(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(
    /data-widget-attrs="([^"]+)"/g,
    (match, encoded) => {
      try {
        const raw = encoded.replace(/&quot;/g, '"').replace(/&#34;/g, '"');
        const attrs = JSON.parse(raw);

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

        delete attrs.isEditing;

        const serialized = JSON.stringify(attrs).replace(/"/g, '&quot;');
        return `data-widget-attrs="${serialized}"`;
      } catch {
        return match;
      }
    }
  );
}
