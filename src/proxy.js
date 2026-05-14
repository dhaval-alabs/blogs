import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { lookupRedirect } from '@/lib/infrastructure/redirects';

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
