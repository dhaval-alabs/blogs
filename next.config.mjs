/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // SEO: canonicalize every URL with a trailing slash. Next.js will 308-redirect
  // /foo → /foo/ automatically, ensuring search engines index a single canonical form.
  trailingSlash: true,
  serverExternalPackages: ['sharp'],
  images: {
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
    ];
  },
};

export default nextConfig;
