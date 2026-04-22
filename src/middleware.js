import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  // Subdomain canonicalization: 301 direct hits on blog.analytixlabs.co.in
  // to www.analytixlabs.co.in. The Cloudflare Worker that reverse-proxies
  // www.analytixlabs.co.in/blog/* presents www.* as the client-visible host,
  // so those requests pass through. Vercel always populates x-forwarded-host
  // with the client's requested host, so we trust it when present.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const effectiveHost = forwardedHost || request.headers.get('host') || '';
  if (effectiveHost.startsWith('blog.analytixlabs.co.in')) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.host = 'www.analytixlabs.co.in';
    url.port = '';
    return NextResponse.redirect(url.toString(), 301);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Validate the user's session
  const { data: { user } } = await supabase.auth.getUser();

  // Normalize pathname so trailing-slash canonicalization (next.config.mjs
  // `trailingSlash: true`) doesn't desync these checks and cause a redirect loop.
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/';

  // If there's no user, and they are trying to access /studio pages (but not /studio/login)
  if (!user && pathname.startsWith('/studio') && pathname !== '/studio/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/studio/login/';
    return NextResponse.redirect(url);
  }

  // If there IS a user, and they are trying to view the login page, redirect to studio
  if (user && pathname === '/studio/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/studio/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
