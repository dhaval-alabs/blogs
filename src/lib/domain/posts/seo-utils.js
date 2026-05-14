// Single source of truth for SEO scoring.
//
// Previously this logic was duplicated in components/studio/PostsTable.js
// (used for the CSV export column) and components/studio/SeoPanel.js (used
// for the live editor panel) — with subtly different thresholds, so the
// score the author saw while editing did not match the score in the CSV.
//
// Framework-free; safe to import from server or client.

export const INTERNAL_DOMAINS = ['analytixlabs.co.in', 'localhost'];

// ── Primitives ─────────────────────────────────────────────────────
export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function countWords(html) {
  const text = stripHtml(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export function countInternalLinks(html, internalDomains = INTERNAL_DOMAINS) {
  if (!html) return 0;
  const hrefMatches = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
  let count = 0;
  for (const match of hrefMatches) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('/') || href.startsWith('./') || internalDomains.some((d) => href.includes(d))) {
      count++;
    }
  }
  const widgetMatches = [...html.matchAll(/data-widget=["']coursematch["']/gi)];
  return count + widgetMatches.length;
}

export function countExternalLinks(html, internalDomains = INTERNAL_DOMAINS) {
  if (!html) return 0;
  const hrefMatches = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
  let count = 0;
  for (const match of hrefMatches) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('/') || href.startsWith('./') || internalDomains.some((d) => href.includes(d))) continue;
    if (/^https?:\/\//i.test(href)) count++;
  }
  return count;
}

export function scanImageAltText(html) {
  if (!html) return { total: 0, missing: 0 };
  const imgs = [...html.matchAll(/<img[^>]+>/gi)];
  let missing = 0;
  for (const img of imgs) {
    const altMatch = img[0].match(/alt\s*=\s*["']([^"']*)["']/i);
    if (!altMatch || !altMatch[1].trim()) missing++;
  }
  return { total: imgs.length, missing };
}

export function computeKeywordDensity(html, focusKeyword, wordCount = null) {
  if (!focusKeyword || !html) return 0;
  const total = wordCount ?? countWords(html);
  if (total === 0) return 0;
  const text = stripHtml(html).toLowerCase();
  const escaped = focusKeyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
  return parseFloat((((matches ? matches.length : 0) / total) * 100).toFixed(1));
}

// Adapters at each callsite map editor state or DB rows into this shape.
function normalize(input) {
  if (!input) return { title: '', body: '', excerpt: '', focusKeyword: '', metaTitle: '', metaDesc: '', altText: '' };
  if ('body' in input) {
    return {
      title: input.title || '',
      body: input.body || '',
      excerpt: input.excerpt || '',
      focusKeyword: input.focusKeyword || '',
      metaTitle: input.metaTitle || '',
      metaDesc: input.metaDesc || '',
      altText: input.altText || '',
    };
  }
  const seo = input.seo || {};
  return {
    title: input.title || '',
    body: input.content || input.postBody || '',
    excerpt: input.excerpt || '',
    focusKeyword: seo.focusKeyword || '',
    metaTitle: seo.metaTitle || '',
    metaDesc: seo.metaDesc || '',
    altText: input.altText || input.alt_text || '',
  };
}

// ── Check engine ───────────────────────────────────────────────────
export function computeSeoChecks(input) {
  const { title, body, focusKeyword, metaTitle, metaDesc, altText } = normalize(input);

  const kw = focusKeyword.toLowerCase().trim();
  const titleToCheck = (metaTitle || title).toLowerCase();
  const wordCount = countWords(body);
  const density = kw && wordCount > 0
    ? computeKeywordDensity(body, kw, wordCount)
    : null;
  const internalLinks = countInternalLinks(body);
  const { total: imageCount, missing: imagesWithoutAlt } = scanImageAltText(body);
  const effectiveAltLen = altText.trim().length;

  const kwInTitleNeutral = !kw;
  const kwInTitlePass = !!(kw && titleToCheck.includes(kw));
  const kwInTitleLabel = kwInTitleNeutral
    ? 'Focus keyword in title — set keyword first'
    : !metaTitle
      ? (kwInTitlePass ? 'Keyword in title ✓ (using article title)' : 'Keyword missing from title')
      : (kwInTitlePass ? 'Focus keyword in title ✓' : 'Focus keyword missing from meta title');

  const metaDescLen = metaDesc.length;
  const metaDescPass = metaDescLen >= 70 && metaDescLen <= 160;
  const metaDescWarn = (metaDescLen > 0 && metaDescLen < 70) || metaDescLen > 160;
  const metaDescFail = metaDescLen === 0;

  const kwDensityNeutral = density === null;
  const kwDensityLabel = kwDensityNeutral
    ? 'Keyword density — set keyword first'
    : density < 0.5 ? `Density too low (${density}%) — aim for 1%`
    : density <= 2.5 ? `Density good (${density}%) ✓`
    : density <= 4.0 ? `Density high (${density}%) — avoid stuffing`
    : `Density too high (${density}%) — risk of penalty`;
  const kwDensityPass = !kwDensityNeutral && density >= 0.8 && density <= 2.5;
  const kwDensityWarn = !kwDensityNeutral && ((density >= 0.5 && density < 0.8) || (density > 2.5 && density <= 4.0));
  const kwDensityFail = !kwDensityNeutral && (density < 0.5 || density > 4.0);

  const altCheckNeutral = imageCount === 0 && effectiveAltLen === 0;
  const altCheckLabel = imageCount === 0
    ? (effectiveAltLen >= 5 ? 'Featured image alt text ✓' : 'No images found')
    : (imagesWithoutAlt === 0 ? 'All images have alt text ✓' : `${imagesWithoutAlt} images missing alt text`);
  const altCheckPass = !altCheckNeutral && imagesWithoutAlt === 0 && (imageCount > 0 || effectiveAltLen >= 5);
  const altCheckWarn = imagesWithoutAlt > 0;

  const internalLinksLabel = `Internal links: ${internalLinks} found`;
  const internalLinksPass = internalLinks >= 2;
  const internalLinksWarn = internalLinks === 1;
  const internalLinksFail = internalLinks === 0;

  return [
    { id: 'kw_in_title',    label: kwInTitleLabel,    pass: kwInTitlePass && !kwInTitleNeutral, warn: !kwInTitlePass && !kwInTitleNeutral, neutral: kwInTitleNeutral },
    { id: 'meta_desc',      label: metaDesc ? 'Meta description present ✓' : 'Missing meta description', pass: metaDescPass, warn: metaDescWarn, fail: metaDescFail },
    { id: 'kw_density',     label: kwDensityLabel,    pass: kwDensityPass, warn: kwDensityWarn, fail: kwDensityFail, neutral: kwDensityNeutral },
    { id: 'alt_text',       label: altCheckLabel,     pass: altCheckPass, warn: altCheckWarn, neutral: altCheckNeutral },
    { id: 'internal_links', label: internalLinksLabel, pass: internalLinksPass, warn: internalLinksWarn, fail: internalLinksFail },
  ];
}

export function computeSeoScore(input) {
  const checks = computeSeoChecks(input);
  const scorable = checks.filter((c) => !c.neutral);
  if (scorable.length === 0) return 0;
  return Math.round((scorable.filter((c) => c.pass).length / scorable.length) * 100);
}

export function gradeSeoScore(score) {
  if (score >= 80) return { grade: 'Excellent', color: '#16a34a' };
  if (score >= 40) return { grade: 'Good',      color: '#f97316' };
  return                  { grade: 'Needs Work', color: '#ef4444' };
}
