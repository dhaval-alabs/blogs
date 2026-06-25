import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { lookupRedirect } from '@/lib/infrastructure/redirects';

// Legacy WordPress URL shapes that were never migrated and 404 on the new
// site (GSC "Not found (404)"). These are open-ended families, so we collapse
// them with patterns rather than enumerating thousands of dead URLs. Takes a
// pathname with NO trailing slash (the proxy normalizes before calling) and
// returns a canonical 301 destination, or null. Destinations are chosen so the
// normalized form never re-matches a pattern — no redirect loops.
function legacyWpRedirect(pathname) {
  if (!pathname.startsWith('/blog/') && pathname !== '/blog') return null;

  // WordPress tag & author archives — no equivalent on the new site.
  if (pathname === '/blog/tag' || pathname.startsWith('/blog/tag/')) return '/blog/';
  if (pathname === '/blog/author' || pathname.startsWith('/blog/author/')) return '/blog/';

  // RSS feed endpoints: /blog/<...>/feed → the canonical page it belonged to;
  // bare /blog/feed → the blog index.
  if (pathname === '/blog/feed') return '/blog/';
  if (pathname.endsWith('/feed')) {
    const base = pathname.slice(0, -'/feed'.length);
    return base === '/blog' || base === '' ? '/blog/' : `${base}/`;
  }

  // Old dated permalinks: /blog/2019/01/30/some-slug → /blog/some-slug/
  const dated = pathname.match(/^\/blog\/\d{4}\/\d{2}\/\d{2}\/([^/]+)$/);
  if (dated) return `/blog/${dated[1]}/`;

  return null;
}

// SEO 404 / migration redirects confirmed by the SEO team (Antigravity
// blog-fixes brief, 2026-06-16). Implemented here rather than in next.config
// `redirects()` so they run BEFORE trailing-slash canonicalization — that
// yields a single 301 hop for both the slashed and unslashed forms (a
// next.config redirect would chain 308→301 under `trailingSlash: true`).
// `pathname` arrives already trailing-slash-stripped; the caller re-attaches
// the query string so UTM params survive the redirect.
const BRIEF_EXACT_REDIRECTS = {
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
};

// Residual individual 404s from the GSC "Not found (404)" report (June 2026)
// that the brief's Fix 1–5 don't cover. Every destination was verified to
// return 200 on www.analytixlabs.co.in (no chains). Exact-match only, so they
// resolve via briefRedirect's exact check below — which runs before
// legacyWpRedirect, letting the two dated-permalink entries override its
// generic dated rule (which would otherwise resolve them to a now-renamed slug
// and 404).
const GSC_RESIDUAL_REDIRECTS = {
  // Renamed / variant slugs → current live post
  '/blog/7-data-science-deep-learning-projects-absolutely-learn': '/blog/deep-learning-projects/',
  '/blog/business-analytics-vs-business-intelligence-whats-difference': '/blog/business-intelligence-vs-business-analytics/',
  '/blog/data-preprocessing-in-machine-learning': '/blog/data-processing-in-machine-learning/',
  '/blog/healthcare-analytics-with-python': '/blog/healthcare-analytics/',
  '/blog/how-to-build-custom-nlp-pipelines': '/blog/building-custom-nlp-pipeline/',
  '/blog/random-forest-regression-a-comprehensive-guide': '/blog/random-forest-regression/',
  '/blog/artificial-intelligence/ai-models': '/blog/ai-models/',
  '/blog/ai-skills-playbook-2026': '/blog/ai-skills-in-demand/',
  // Old dated permalinks whose target slug was itself renamed (override the
  // generic dated handler in legacyWpRedirect)
  '/blog/2020/05/07/50-ultimate-python-data-science-libraries-to-learn-in-2020': '/blog/50-ultimate-python-data-science-libraries-to-learn/',
  '/blog/2019/02/19/exploring-career-avenues-deep-learning-certification-2019': '/blog/exploring-career-avenues-deep-learning-certification-2024/',
  // Original post no longer exists → closest live page / category hub
  '/blog/advantages-disadvantages-of-artificial-intelligence': '/blog/artificial-intelligence/',
  '/blog/data-scientist-vs-machine-learning-engineer': '/blog/data-science/',
  '/blog/what-is-marketing-analytics': '/blog/what-is-business-analytics/',
  '/blog/2020/02/08/the-ai-and-machine-learning-trends-to-watch-out-for-in-2020': '/blog/artificial-intelligence/',
  '/blog/what-is-langchain': '/blog/artificial-intelligence/',
  // No relevant target → blog index
  '/blog/best-geospatial-technology-trends-for-2022': '/blog/',
  '/blog/interview-q-a': '/blog/',
  '/blog/securepanel': '/blog/',
};

function briefRedirect(pathname) {
  // Fix 1–3 — exact matches (SEO-team brief) + residual GSC 404s.
  const exact = BRIEF_EXACT_REDIRECTS[pathname] ?? GSC_RESIDUAL_REDIRECTS[pathname];
  if (exact) return exact;

  // Fix 4 — /blog/blog/ double-prefix (legacy WP URLs Google still holds).
  // This app has NO /blog/page/[n] route, so paginated double-prefix URLs go
  // to the blog index; any other double-prefix collapses one /blog/ level.
  // (Confirmed there is no link-generation bug in the app — this IS the fix.)
  if (pathname === '/blog/blog' || pathname.startsWith('/blog/blog/page/')) return '/blog/';
  if (pathname.startsWith('/blog/blog/')) {
    return `/blog/${pathname.slice('/blog/blog/'.length)}/`;
  }

  // Fix 5 — strip a trailing /1000 segment (suspected Elementor/WP artefact,
  // ~57 URLs). Interim safety net; skip bare /blog/1000 to avoid a `//` dest.
  if (pathname.endsWith('/1000')) {
    const base = pathname.slice(0, -'/1000'.length);
    if (base.startsWith('/blog/') && base !== '/blog') return `${base}/`;
  }

  return null;
}

export async function proxy(request) {
  // Subdomain canonicalization: 301 direct hits on blog.analytixlabs.co.in
  // to www.analytixlabs.co.in so Google only sees one canonical URL.
  //
  // The Cloudflare Worker that reverse-proxies www.analytixlabs.co.in/blog/*
  // sets the custom header x-alabs-from-worker: 1 on every request it forwards.
  // When we see that header we skip the redirect — because the user is actually
  // browsing www and the Worker is just fetching content on their behalf.
  //
  // Custom non-standard headers like x-alabs-from-worker are not overridden or
  // stripped by Vercel's edge, making them a reliable handshake signal.
  // Only redirect paths that the Cloudflare Worker actually forwards at
  // www.analytixlabs.co.in (/blog/*). /studio, /api, and other internal
  // paths must stay reachable on the Vercel subdomain — if we redirect
  // them to www they fall through to WordPress and 404.
  const rawPathname = request.nextUrl.pathname;
  const isWorkerForwardedPath =
    rawPathname === '/blog' || rawPathname.startsWith('/blog/');

  const fromWorker = request.headers.get('x-alabs-from-worker') === '1';
  const effectiveHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

  if (
    !fromWorker &&
    isWorkerForwardedPath &&
    effectiveHost.startsWith('blog.analytixlabs.co.in')
  ) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.host = 'www.analytixlabs.co.in';
    url.port = '';
    return NextResponse.redirect(url.toString(), 301);
  }

  // Normalize pathname so trailing-slash canonicalization (next.config.mjs
  // `trailingSlash: true`) doesn't desync these checks and cause a redirect loop.
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/';
  const isStudioPath = pathname.startsWith('/studio');

  // Auth check is ONLY needed for /studio/* routes. Running it on every
  // public page hit (blog, homepage, bot crawls, prefetches) burned a
  // Supabase auth round-trip per request — the single biggest fixed cost
  // in the proxy. Skipped for public paths.
  if (isStudioPath) {
    let supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user && pathname !== '/studio/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/studio/login/';
      return NextResponse.redirect(url);
    }
    if (user && pathname === '/studio/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/studio/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ── Dynamic Redirects (public paths only) ───────────────────────
  // Reads from Vercel Edge Config (<1ms at the edge) with a Supabase
  // fallback for local dev. See src/lib/infrastructure/redirects.js.
  const dynamicRedirect = await lookupRedirect(pathname);
  if (dynamicRedirect) {
    const dest = dynamicRedirect.destination.startsWith('http')
      ? dynamicRedirect.destination
      : new URL(dynamicRedirect.destination, request.url).toString();
    return NextResponse.redirect(dest, dynamicRedirect.type || 301);
  }

  // ── SEO 404 / migration redirects (SEO-team brief, 2026-06-16) ───
  // Runs before trailing-slash normalization → one clean 301 with UTM kept.
  const brief = briefRedirect(pathname);
  if (brief) {
    const target = brief.startsWith('http')
      ? new URL(brief)
      : new URL(brief, request.url);
    target.search = request.nextUrl.search; // preserve UTM / query params
    return NextResponse.redirect(target.toString(), 301);
  }

  // Catch-all for legacy WordPress tag/author/feed/dated URLs (runs after the
  // exact-match table above, so a specific redirect always takes priority).
  const legacy = legacyWpRedirect(pathname);
  if (legacy) {
    return NextResponse.redirect(new URL(legacy, request.url).toString(), 301);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api                — internal API routes
     * - _next/static       — static assets
     * - _next/image        — image optimization
     * - _next/data         — RSC data fetches (proxy fires anyway, but skip explicit ones)
     * - favicon.ico, robots.txt, sitemap.xml, manifest.* — metadata files
     * - rss, feed          — RSS feeds, hit by aggregators every few minutes
     * - .well-known/*      — security.txt, etc.
     * - any path with a static-asset file extension
     *
     * Excluding these saves a proxy invocation entirely — that's a redirect
     * lookup + cold-start cost avoided per match, on top of any DB calls.
     */
    '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.|rss|feed|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf|txt|xml|json)$).*)',
  ],
};
