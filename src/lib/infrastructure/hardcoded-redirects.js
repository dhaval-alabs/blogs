// Hardcoded exact-match redirect tables, shared between src/proxy.js (which
// serves them) and src/app/blog/sitemap.js (which needs to know about them
// too, so a code-level redirect doesn't silently leave a sitemap entry
// pointing at a URL that 301s instead of returning 200). Kept dependency-free
// so it's safe to import from either an edge-runtime file (proxy.js) or a
// Node-runtime one (sitemap.js) without pulling in unrelated bundles.

// SEO 404 / migration redirects confirmed by the SEO team (Antigravity
// blog-fixes brief, 2026-06-16). Implemented here rather than in next.config
// `redirects()` so they run BEFORE trailing-slash canonicalization — that
// yields a single 301 hop for both the slashed and unslashed forms (a
// next.config redirect would chain 308→301 under `trailingSlash: true`).
// `pathname` arrives already trailing-slash-stripped; the caller re-attaches
// the query string so UTM params survive the redirect.
export const BRIEF_EXACT_REDIRECTS = {
  // Fix 1 — truncated-slug 404s (destinations verified live 200 by SEO team)
  '/blog/the-best': '/blog/the-best-machine-learning-tools-python-vs-r-vs-sas/',
  '/blog/building-': '/blog/building-self-learning-ai-agents-in-python/',
  '/blog/real-time-': '/blog/real-time-analytics/',
  '/blog/what-is-i': '/blog/what-is-image-segmentation/',
  '/blog/101-of-artificial-': '/blog/101-of-artificial-intelligence-ai-what-to-know-as-a-beginner/',
  '/blog/characteristics-': '/blog/characteristics-of-big-data/',
  '/blog/business-intelligence-': '/blog/business-intelligence-value-chain/',
  '/blog/what-is-agentic-': '/blog/what-is-agentic-ai/',
  '/blog/what-is-artificial-': '/blog/what-is-artificial-intelligence-engineering/',
  // Fix 2 — old / garbled blog slugs
  // INTERIM: remove this line when /careers/ ships on the main site (Dhaval will notify).
  '/blog/careers-at-analytixlabs': '/contact-us/',
  '/blog/data-science-and-ai-1777560853996': '/blog/data-science-and-ai/', // LinkedIn share artefact
  '/blog/blog--analytixlabs': '/blog/', // garbled CMS artefact
  // Fix 3 — old category pages
  '/blog/business-intelligence': '/blog/business-analytics/',
  '/blog/report': 'https://www.analytixlabs.co.in/free-resources/', // cross-domain → main site

  // Round 3 (Antigravity brief, 2026-08-03), Fix 1 — six Python posts still
  // 404 since June; Google keeps re-crawling them.
  '/blog/python-training-can-give-good-start-career': '/blog/why-python-for-data-science-is-industrys-top-choice/',
  '/blog/using-python-is-a-satisfying-experience-for-coders': '/blog/why-python-for-data-science-is-industrys-top-choice/',
  '/blog/python-skills-can-be-vital-for-a-successful-career-in-data-science': '/blog/why-python-for-data-science-is-industrys-top-choice/',
  '/blog/why-python-training': '/blog/why-python-for-data-science-is-industrys-top-choice/',
  '/blog/python-training-makes-industry-ready': '/blog/choose-python-data-science-course/',
  '/blog/5-reasons-python-practical-choice-language': '/blog/choose-python-data-science-course/',
  // Round 3, Fix 2 — Yoast strips the date from these old permalinks correctly,
  // but the resulting slug (year still embedded) doesn't exist in Next.js.
  '/blog/exploring-career-avenues-deep-learning-certification-2019': '/blog/exploring-career-avenues-deep-learning-certification-2024/',
  '/blog/50-ultimate-python-data-science-libraries-to-learn-in-2020': '/blog/data-analytics-with-python/',
  // Round 3, Fix 3 — truncated slugs newly appeared in GSC.
  '/blog/data-science-and': '/blog/data-science-and-ai/',
  '/blog/what-i': '/blog/', // too truncated to infer a specific post — route to blog home
  // Round 3, Fix 4 — content bug: an internal link somewhere has a stray/line-break
  // space before the last word, so Google crawls these with a literal space
  // (encoded as %20). See scripts/find-space-slugs (or a Supabase content grep
  // for "characteristics-of-big- data" / "components-of- artificial-intelligence")
  // to fix the source link too, or these will keep getting rediscovered.
  '/blog/characteristics-of-big-%20data': '/blog/characteristics-of-big-data/',
  '/blog/components-of-%20artificial-intelligence': '/blog/components-of-artificial-intelligence/',

  // Round 4 (Antigravity brief, 2026-08-31) — active truncation bug producing
  // new truncated-slug 404s (crawl dates July 27–Aug 21, 2026). Root cause
  // NOT found in this codebase: PostCard.js, RecommendedPosts.js, the ask-ai
  // knowledge-grounding formatter, and the social share buttons were all
  // audited and every one builds its href/URL from the untouched slug field,
  // never a truncated display string. Likely origin is external (a
  // third-party aggregator/scraper linkifying a truncated page title). All
  // destinations verified live (200) 2026-08-31.
  '/blog/random-forest-reg': '/blog/random-forest-regression/',
  '/blog/logistic': '/blog/logistic-regression-in-python/',
  '/blog/classification-in-mac': '/blog/classification-in-machine-learning/',
  '/blog/data-reduction-in': '/blog/data-reduction-in-data-mining/',
  '/blog/component': '/blog/components-of-artificial-intelligence/',
  // The post at this slug was renamed to /blog/ai-applications/ in Supabase
  // (2026-09-14) — no post row remains at the old slug, only a leftover
  // WordPress-migration MDX file (content/blog/applications-of-artificial-
  // intelligence.mdx) still serving stale content, invisible to Studio's
  // post list since /api/posts?all=true only queries the posts table. A
  // prior redirect attempt (Supabase redirects id 232) never worked: its
  // source was a full URL instead of a normalized path, and its destination
  // pointed at blog.analytixlabs.co.in (the Studio-only host) instead of
  // www. Fixed here at the code level instead. All three sibling truncated-
  // slug entries below repointed directly at the real final destination to
  // avoid chaining through this now-redirected slug.
  '/blog/applications-of-artificial-intelligence': '/blog/ai-applications/',
  '/blog/applications-of-artificial...': '/blog/ai-applications/',
  '/blog/applications-of-artificial-intelligence/%21': '/blog/ai-applications/',
  '/blog/applications-of-arti': '/blog/ai-applications/',
  '/blog/data-analysis-and-interpretatio': '/blog/data-analysis-and-interpretation/',
  '/blog/data-analysis': '/blog/data-analysis-and-interpretation/',
  '/blog/python-interview-questions-for': '/blog/python-interview-questions-for-data-science/',
  '/blog/father-of-artificial': '/blog/father-of-artificial-intelligence/',
  '/blog/father': '/blog/father-of-artificial-intelligence/',
  '/blog/types-of-business': '/blog/types-of-business-analytics/',
  // Brief suggested best-programming-language-for-machine-learning as the
  // fallback target, but that slug itself 301s (truncated to -machine) —
  // pointing directly at the real final destination to avoid the extra hop.
  '/blog/types-of-algorithms-with-different-machine-learning-algorithm-examples': '/blog/best-programming-language-for-machine/',
  // Brief flagged these three as "needs CMS search, do not guess" — searched
  // Supabase directly, each resolved to exactly one live published post.
  '/blog/descriptive': '/blog/descriptive-and-inferential-statistics/',
  '/blog/parametric': '/blog/parametric-and-non-parametric-test/',
  '/blog/data-science-life': '/blog/data-science-life-cycle/',
  // Too short/generic to safely infer a specific post — brief's own
  // recommended fallback, same treatment as the existing '/blog/what-i' above.
  '/blog/what': '/blog/',
  '/blog/wh': '/blog/',
  '/blog/full': '/blog/',
  '/blog/type': '/blog/',
  '/blog/types': '/blog/',
  '/blog/types-of': '/blog/',
};

// Residual individual 404s from the GSC "Not found (404)" report (June 2026)
// that the brief's Fix 1–5 don't cover. Every destination was verified to
// return 200 on www.analytixlabs.co.in (no chains). Exact-match only, so they
// resolve via briefRedirect's exact check below — which runs before
// legacyWpRedirect, letting the two dated-permalink entries override its
// generic dated rule (which would otherwise resolve them to a now-renamed slug
// and 404).
export const GSC_RESIDUAL_REDIRECTS = {
  // Renamed / variant slugs → current live post
  '/blog/7-data-science-deep-learning-projects-absolutely-learn': '/blog/deep-learning-projects/',
  '/blog/business-analytics-vs-business-intelligence-whats-difference': '/blog/business-intelligence-vs-business-analytics/',
  '/blog/data-preprocessing-in-machine-learning': '/blog/data-processing-in-machine-learning/',
  '/blog/healthcare-analytics-with-python': '/blog/healthcare-analytics/',
  '/blog/how-to-build-custom-nlp-pipelines': '/blog/building-custom-nlp-pipeline/',
  '/blog/random-forest-regression-a-comprehensive-guide': '/blog/random-forest-regression/',
  '/blog/artificial-intelligence/ai-models': '/blog/ai-models/',
  '/blog/ai-skills-playbook-2026': '/blog/ai-skills-in-demand/',
  // Round 3, Fix 5 — repointed from a loosely-related category page to the
  // exact-match post that exists for each (category-page redirects risk being
  // treated as a soft 404 rather than honoured, wasting link equity).
  '/blog/what-is-langchain': '/blog/langchain-components-and-uses/',
  '/blog/what-is-marketing-analytics': '/blog/marketing-mix-modeling/',
  '/blog/data-scientist-vs-machine-learning-engineer': '/blog/machine-learning-engineer-vs-data-scientist/',
  // Old dated permalinks whose target slug was itself renamed (override the
  // generic dated handler in legacyWpRedirect)
  '/blog/2020/05/07/50-ultimate-python-data-science-libraries-to-learn-in-2020': '/blog/50-ultimate-python-data-science-libraries-to-learn/',
  '/blog/2019/02/19/exploring-career-avenues-deep-learning-certification-2019': '/blog/exploring-career-avenues-deep-learning-certification-2024/',
  // Original post no longer exists → closest live page / category hub
  '/blog/advantages-disadvantages-of-artificial-intelligence': '/blog/artificial-intelligence/',
  '/blog/2020/02/08/the-ai-and-machine-learning-trends-to-watch-out-for-in-2020': '/blog/artificial-intelligence/',
  // No relevant target → blog index
  '/blog/best-geospatial-technology-trends-for-2022': '/blog/',
  '/blog/interview-q-a': '/blog/',
  '/blog/securepanel': '/blog/',
};
