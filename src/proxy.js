import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { lookupRedirect } from '@/lib/infrastructure/redirects';
import { BRIEF_EXACT_REDIRECTS, GSC_RESIDUAL_REDIRECTS } from '@/lib/infrastructure/hardcoded-redirects';

// Known-stale rows in the Supabase `redirects` table (dynamic/CMS layer) that
// shadow a genuinely published post and would otherwise 301 it away before it
// can render. The proper fix is deactivating the row and letting Studio's
// admin UI push the change to Vercel Edge Config — but that cache only
// refreshes on a Studio save, so until that happens (or the stale row is
// deleted outright) this bypass keeps the live post reachable independent of
// Edge Config's state. Safe to remove once the Edge Config cache is confirmed
// to no longer carry the corresponding entry.
const DYNAMIC_REDIRECT_BYPASS = new Set([
  // id 226 in `blog.redirects`: source '/blog/choose-python-data-science-course'
  // → '/blog/what-is-data-science/', deactivated 2026-07-30 but Edge Config
  // hadn't picked that up as of the same date.
  '/blog/choose-python-data-science-course',
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// next.config's trailingSlash:true means every real route needs a trailing
// slash or Next 308s to add one — a wasted hop, and (confirmed 2026-08-18)
// the other half of a genuine infinite redirect loop: a same-origin
// destination saved without one bounced through the slash-add 308 straight
// back into an external (Cloudflare-side) rule redirecting the other way.
// Skips paths with a query string/hash already past the pathname, or that
// end in something that looks like a file extension (e.g. sitemap.xml).
function withTrailingSlash(path) {
  const splitIndex = path.search(/[?#]/);
  const pathname = splitIndex === -1 ? path : path.slice(0, splitIndex);
  const suffix = splitIndex === -1 ? '' : path.slice(splitIndex);
  if (pathname === '' || pathname.endsWith('/')) return path;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return path;
  return `${pathname}/${suffix}`;
}

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

  // ── SEO 404 / migration redirects (SEO-team brief, 2026-06-16) ───
  // Runs before trailing-slash normalization → one clean 301 with UTM kept.
  // Checked BEFORE the dynamic/CMS redirects below: these ~50 entries are
  // curated and SEO-verified per brief, so they must win even if a stale or
  // malformed CMS row exists in Supabase for the same exact source path
  // (this bit us in round 3 — 6 legacy CMS rows pre-dating the brief's
  // consolidated destinations were silently overriding the correct fix).
  const brief = briefRedirect(pathname);
  if (brief) {
    const target = brief.startsWith('http')
      ? new URL(brief)
      : new URL(brief, request.url);
    target.search = request.nextUrl.search; // preserve UTM / query params
    return NextResponse.redirect(target.toString(), 301);
  }

  // ── Dynamic Redirects (public paths only) ───────────────────────
  // Reads from Vercel Edge Config (<1ms at the edge) with a Supabase
  // fallback for local dev. See src/lib/infrastructure/redirects.js.
  const dynamicRedirect = DYNAMIC_REDIRECT_BYPASS.has(pathname)
    ? null
    : await lookupRedirect(pathname);
  if (dynamicRedirect) {
    // A 410/404 row retires the URL rather than redirecting it.
    // NextResponse.redirect() throws on any non-redirect status, which
    // surfaced as a 500 (row 91, /blog/category/blog-analytixlabs, type 410).
    const status = Number(dynamicRedirect.type) || 301;
    if (status === 410 || status === 404) {
      return new NextResponse(status === 410 ? 'Gone' : 'Not Found', { status });
    }
    const rawDest = dynamicRedirect.destination;
    // Defensive: a destination saved without a leading slash (e.g. a CMS
    // data-entry typo — "blog/foo/" instead of "/blog/foo/") is a *relative*
    // reference to the URL constructor, so it resolves against the current
    // request path instead of the site root, producing a nested 404 like
    // /blog/source-slug/blog/foo/ instead of replacing the path outright.
    const dest = rawDest.startsWith('http')
      ? rawDest
      : new URL(withTrailingSlash(rawDest.startsWith('/') ? rawDest : `/${rawDest}`), request.url).toString();
    return NextResponse.redirect(dest, REDIRECT_STATUSES.has(status) ? status : 301);
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
