// Render-time cleanup of post body HTML (SEO audit, 14 Oct 2026).
//
// Stored content is never rewritten: this runs on the HTML string just before
// it reaches the article component, so it covers every existing post and any
// future one, and is reversible by removing the call.
//
//   1. Internal links: every <a href> pointing at our own site is normalised
//      so it no longer hits a redirect — https, no doubled slashes, known
//      redirects resolved to their destination, trailing slash added.
//   2. In-body <h1> → <h2>: the template already renders the post title as
//      the page's only <h1>.

const ORIGIN = 'https://www.analytixlabs.co.in';

// Absolute or protocol-relative URL on our own host (www or bare).
const OWN_URL_RE = /^(?:https?:)?\/\/(?:www\.)?analytixlabs\.co\.in(?=[/?#]|$)(.*)$/i;

// Paths that are files or infrastructure, not pages: never add a slash.
const NO_SLASH_PREFIXES = ['/wp-content/', '/_next/', '/api/', '/cdn-cgi/'];

// Redirects that are not visible to the Supabase redirects table: main-site
// (WordPress) pages and the /blog/ redirects that live in Cloudflare Bulk
// Redirects. Every destination verified 200 with zero hops on 2026-10-26.
// Sources match with or without a trailing slash; destinations are output
// exactly as written.
// Deliberately absent: /data-science-r-analytics-training (slash and no-slash
// forms resolve to different pages, pending a decision; the trailing-slash
// rule applies) and /agentic-ai-course (mis-slugged on WordPress; the
// trailing-slash rule handles it once fixed).
// If best-programming-language-for-machine gets its full slug back, update
// the two entries pointing at it in the same change.
export const STATIC_REDIRECTS = {
  // Main-site pages
  '/pg-in-data-science': '/data-science-specialization-course/',
  '/blog/pg-in-data-science': '/data-science-specialization-course/',
  '/data-science-specialization-co': '/data-science-specialization-course/',
  '/courses/data-science-specialization-course': '/data-science-specialization-course/',
  '/pg-in-data-analytics': '/data-analyst-certification-courses/',
  '/pg-course-in-data-analytics': '/data-analyst-certification-courses/',
  '/courses/pg-in-data-analytics': '/data-analyst-certification-courses/',
  '/courses/pg-course-in-data-analytics': '/data-analyst-certification-courses/',
  '/advanced-excel-training-certification-course-online': '/business-analytics-course/',
  '/courses/advanced-excel-training-certification-course-online': '/business-analytics-course/',
  '/business-analyst-training-course-online': '/business-analytics-course/',
  '/courses/business-analyst-training-course-online': '/business-analytics-course/',
  '/business-analytics-data-science-course': '/business-analytics-course/',
  '/courses/business-analytics-data-science-course': '/business-analytics-course/',
  '/data-visualization-analytics-course': '/business-analytics-course/',
  '/applied-ai-and-machine-learning-course': '/artificial-intelligence-certification-courses-online/',
  '/artificial-intelligence-engineering-course': '/artificial-intelligence-certification-courses-online/',
  '/courses/artificial-intelligence-engineering-course': '/artificial-intelligence-certification-courses-online/',
  '/courses/artificial-intelligence-certification-courses-online': '/artificial-intelligence-certification-courses-online/',
  '/ai-deep-learning-training-with-python': '/artificial-intelligence-certification-courses-online/',
  '/full-stack-ai-course': '/artificial-intelligence-certification-courses-online/',
  '/courses/machine-learning-course-certification-training': '/machine-learning-course-certification-training/',
  '/courses/data-science-r-analytics-training': '/data-science-r-analytics-training/',
  '/deep-learning-course': '/deep-learning-with-python/',
  '/big-data-analytics-python-spark-training': '/big-data-analytics-hadoop-spark-training-course-online/',
  '/big-data-analytics-hadoop-training-course-online': '/big-data-analytics-hadoop-spark-training-course-online/',
  '/data-analytics-training-course-in-bangalore': '/data-analyst-training-course-in-bangalore/',
  '/business-analytics-course-in-bangalore': '/business-analyst-course-in-bangalore/',
  '/placements/placements-june-2024': '/placements/',
  '/placements/placements-june-2025': '/placements/',
  '/candidates-outsourcing': '/enterprises/',
  '/types-of-agents-in-ai': '/blog/types-of-agents-in-ai/',
  '/author/al-editorial': '/blog/',

  // Blog posts (Cloudflare Bulk Redirects unless noted)
  '/blog/what-is-the-syllabus-of-data-science': '/blog/data-science-course-syllabus-and-subjects/',
  '/blog/future-of-business-analytics': '/blog/business-analytics-in-india/',
  '/blog/applications-of-artificial-intelligence': '/blog/ai-applications/',
  '/blog/data-science-tutorial': '/blog/what-is-data-science/',
  '/blog/use-tableau-data-analyst': '/blog/power-bi-vs-tableau/',
  '/blog/top-reasons-choose-python-big-data-analytics-applied-ai-projects': '/blog/what-is-data-science/',
  '/blog/data-warehouse': '/blog/what-is-data-warehouse/',
  '/blog/business-analyst-vs-data-analyst': '/blog/data-analyst-vs-business-analyst/',
  '/blog/what-are-the-reasons-behind-the-growing-popularity-of-python': '/blog/what-is-data-science/',
  '/blog/data-lake-and-data-warehouse-just-synonyms-or-different-ideas': '/blog/data-lake-vs-data-warehouse/',
  '/blog/why-has-python-become-one-of-the-most-loved-programming-languages': '/blog/what-is-data-science/',
  '/blog/learning-python-helps': '/blog/7-beginner-tips-every-python-training-student-know/',
  '/blog/best-programming-language-for-machine-learning': '/blog/best-programming-language-for-machine/',
  '/blog/types-of-algorithms-with-different-machine-learning-algorithm-examples': '/blog/best-programming-language-for-machine/',
  '/blog/50-ultimate-python-data-science-libraries-to-learn-in-2020': '/blog/data-analytics-with-python/',
  '/blog/2020/05/07/50-ultimate-python-data-science-libraries-to-learn-in-2020': '/blog/50-ultimate-python-data-science-libraries-to-learn/',
  '/blog/2018/03/28/big-data-importance-enterprise': '/blog/big-data-importance-enterprise/',
  '/blog/2020/03/18/data-science-can-be-for-everyone': '/blog/data-science-can-be-for-everyone/',
  '/blog/data-preprocessing-in-machine-learning': '/blog/data-processing-in-machine-learning/',
  '/blog/business-analytics-vs-business-intelligence-whats-difference': '/blog/business-intelligence-vs-business-analytics/',
  '/blog/advantages-disadvantages-of-artificial-intelligence': '/blog/artificial-intelligence/',
  '/blog/ai-skills-playbook-2026': '/blog/ai-skills-in-demand/',
  '/blog/data-scientist-vs-machine-learning-engineer': '/blog/machine-learning-engineer-vs-data-scientist/',
  '/blog/healthcare-analytics-with-python': '/blog/healthcare-analytics/',
  '/blog/how-to-build-custom-nlp-pipelines': '/blog/building-custom-nlp-pipeline/',
  '/blog/what-is-langchain': '/blog/langchain-components-and-uses/',
  '/blog/what-is-marketing-analytics': '/blog/marketing-mix-modeling/',
  '/blog/category/deep-learning': '/blog/deep-learning/',

  // Dead blog URLs given redirects in the same audit (Fix 1)
  '/blog/data-science-resume-with-examples': '/blog/data-scientist-resume/',
  '/blog/artificial-intelligence-course-eligibility': '/blog/eligibility-for-artificial-intelligence-course/',
  '/blog/factor-analysis-vs-pca': '/blog/pca-vs-factor-analysis/',
  '/blog/what-is-business-analytics-2': '/blog/what-is-business-analytics/',
  '/blog/learning-tip-101-learn-r-programming-language-stay-relevant-ahead': '/blog/r-programming-language-basics/',
  '/blog/need-a-machine-learning-job-learn-any-of-these-machine-learning-tools-part-2': '/blog/need-a-machine-learning-job-learn-any-of-these-machine-learning-tools-part-1/',
};

const stripSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * Builds the lookup used by normalizeInternalHref: the static map plus any
 * extra { source: destination } pairs (e.g. active /blog/ rows from the
 * redirects table). Static entries win. Keys are stored without a trailing
 * slash.
 */
export function buildRedirectLookup(extra = {}) {
  const lookup = new Map();
  for (const [src, dest] of Object.entries(extra)) lookup.set(stripSlash(src), dest);
  for (const [src, dest] of Object.entries(STATIC_REDIRECTS)) lookup.set(stripSlash(src), dest);
  return lookup;
}

function needsSlash(path) {
  if (path.endsWith('/')) return false;
  if (NO_SLASH_PREFIXES.some((p) => path.startsWith(p))) return false;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return !last.includes('.');
}

/**
 * Normalises one href if it points at our own site; anything else (external,
 * mailto:, tel:, #anchor, relative without a leading slash) is returned as is.
 * Query string and #hash are preserved exactly.
 */
export function normalizeInternalHref(href, lookup = buildRedirectLookup()) {
  if (typeof href !== 'string') return href;
  const raw = href.trim();
  let rest;
  let absolute;
  const own = OWN_URL_RE.exec(raw);
  if (own) {
    rest = own[1];
    absolute = true;
  } else if (raw.startsWith('/') && !raw.startsWith('//')) {
    rest = raw;
    absolute = false;
  } else {
    return href;
  }

  const cut = rest.search(/[?#]/);
  let path = cut === -1 ? rest : rest.slice(0, cut);
  const suffix = cut === -1 ? '' : rest.slice(cut);

  path = path.replace(/\/{2,}/g, '/') || '/';

  // Follow known redirects (bounded, in case a table row chains).
  for (let hops = 0; hops < 5; hops++) {
    const dest = lookup.get(stripSlash(path));
    if (!dest) break;
    const ownDest = OWN_URL_RE.exec(dest);
    if (ownDest) {
      path = ownDest[1].split(/[?#]/)[0] || '/';
    } else if (dest.startsWith('/')) {
      path = dest;
    } else if (/^https?:\/\//i.test(dest)) {
      return dest + suffix; // redirect to another host
    } else {
      path = `/${dest}`; // table rows saved without a leading slash
    }
  }

  if (needsSlash(path)) path += '/';
  return (absolute ? ORIGIN : '') + path + suffix;
}

/**
 * Applies both render-time fixes to post body HTML: internal <a href>
 * normalisation and <h1> → <h2>. Only <a> tags' href attributes are touched —
 * never src, srcset or link text.
 */
export function normalizeArticleHtml(html, lookup = buildRedirectLookup()) {
  if (typeof html !== 'string' || !html) return html;
  return html
    .replace(/<a\b[^>]*>/gi, (tag) =>
      tag.replace(/(\shref\s*=\s*)(?:"([^"]*)"|'([^']*)')/i, (m, pre, dq, sq) => {
        const quote = dq !== undefined ? '"' : "'";
        const value = dq !== undefined ? dq : sq;
        return `${pre}${quote}${normalizeInternalHref(value, lookup)}${quote}`;
      })
    )
    .replace(/<(\/?)h1(?=[\s>/])/gi, '<$1h2');
}
