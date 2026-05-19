// Shared read-time calculation. Single source of truth for studio compute,
// publish guard, render-side fallback, and the MDX importer.
//
// Model:
//   - Prose: 238 wpm (Medium's empirical figure)
//   - Code blocks (<pre>/<code>): flat +30s per block
//   - Images (<img>/<figure>): 12s, 11s, 10s, ... floor 3s (Medium's curve)
//   - Embeds (<iframe>): 30s each
//   - Floor: 1 minute when content is non-empty; 0 only for empty input

const WORDS_PER_MINUTE = 238;
const SECONDS_PER_CODE_BLOCK = 30;
const SECONDS_PER_IFRAME = 30;
const IMAGE_SECONDS_START = 12;
const IMAGE_SECONDS_FLOOR = 3;

function countMatches(html, regex) {
  const m = html.match(regex);
  return m ? m.length : 0;
}

function imageSeconds(count) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.max(IMAGE_SECONDS_FLOOR, IMAGE_SECONDS_START - i);
  }
  return total;
}

export function calculateReadTime(input) {
  if (!input || typeof input !== 'string') return 0;

  let html = input;

  // Pull out code blocks and count them, then remove their content from prose.
  const codeBlockCount = countMatches(html, /<pre[\s>][\s\S]*?<\/pre>/gi);
  html = html.replace(/<pre[\s>][\s\S]*?<\/pre>/gi, ' ');

  // Inline <code> outside <pre>: still strip so it doesn't inflate word count,
  // but don't add fixed time (snippets are read inline at prose speed already).
  html = html.replace(/<code[\s>][\s\S]*?<\/code>/gi, ' ');

  // Count images and iframes, then strip so their attributes don't pollute word count.
  const imageCount = countMatches(html, /<img\b[^>]*>/gi);
  const iframeCount = countMatches(html, /<iframe\b[\s\S]*?<\/iframe>/gi);
  html = html.replace(/<img\b[^>]*>/gi, ' ');
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ');
  html = html.replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ');

  // Strip <script>/<style> entirely (their text content is not "read").
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  html = html.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

  // Strip remaining tags.
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;

  const proseMinutes = words / WORDS_PER_MINUTE;
  const extraSeconds =
    codeBlockCount * SECONDS_PER_CODE_BLOCK +
    iframeCount * SECONDS_PER_IFRAME +
    imageSeconds(imageCount);
  const totalMinutes = proseMinutes + extraSeconds / 60;

  if (totalMinutes <= 0) return 0;
  return Math.max(1, Math.round(totalMinutes));
}

// Accepts either an integer ("5"), a number (5), or a stored string ("5 min read").
// Returns 0 if the value can't be interpreted as a positive integer.
export function parseReadTime(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const match = String(value).match(/-?\d+/);
  if (!match) return 0;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Resolve a read-time string for display. Prefers the stored value if it's
// a sane positive integer; otherwise computes from the content as a fallback.
export function resolveReadTime(stored, content) {
  const parsed = parseReadTime(stored);
  if (parsed > 0) return parsed;
  return calculateReadTime(content);
}

export function formatReadTime(minutes) {
  const n = parseReadTime(minutes);
  return n > 0 ? `${n} min read` : '';
}
