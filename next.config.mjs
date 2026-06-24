/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // SEO: canonicalize every URL with a trailing slash. Next.js will 308-redirect
  // /foo → /foo/ automatically, ensuring search engines index a single canonical form.
  trailingSlash: true,
  compress: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['sharp'],
  experimental: {
    serverActions: {
      allowedOrigins: ['www.analytixlabs.co.in', 'analytixlabs.co.in'],
    },
    // Tree-shake large icon/parser libs — only used exports land in the bundle
    optimizePackageImports: ['lucide-react', 'html-react-parser'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        // Supabase Storage — covers all projects
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/**",
      },
      {
        // Local dev uploads served from public/uploads/
        protocol: "http",
        hostname: "localhost",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/uploads/**",
      },
      {
        // WordPress migrated images from AnalytixLabs
        protocol: "https",
        hostname: "www.analytixlabs.co.in",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async headers() {
    // Long-lived immutable caching for public static assets — addresses GTmetrix
    // "Serve static assets with an efficient cache policy" audit.
    const oneYearImmutable = "public, max-age=31536000, immutable";
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|webp|avif|ico|woff|woff2|ttf|otf)",
        headers: [{ key: "Cache-Control", value: oneYearImmutable }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: oneYearImmutable }],
      },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: oneYearImmutable }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/article/:slug',
        destination: '/blog/:slug/',
        permanent: true,
      },
      {
        source: '/article/:slug/',
        destination: '/blog/:slug/',
        permanent: true,
      },
      {
        source: '/blogs',
        destination: '/blog/',
        permanent: true,
      },
      {
        source: '/blogs/:slug*',
        destination: '/blog/:slug*/',
        permanent: true,
      },
      // NOTE: the SEO-team 404/migration redirects (Antigravity brief,
      // 2026-06-16) intentionally live in src/proxy.js, NOT here. With
      // `trailingSlash: true`, a next.config redirect on a bare URL chains
      // (308 add-slash → 301), which fails the brief's "single 301, no chains"
      // requirement. The proxy runs before trailing-slash normalization, so it
      // emits one clean 301 (with UTM preserved). See briefRedirect() there.
    ];
  },
};

export default nextConfig;
