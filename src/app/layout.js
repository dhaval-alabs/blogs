import { Manrope, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ClientInit from "@/components/ClientInit";
import TrackingScripts from "@/components/TrackingScripts";
import NavigationProgress from "@/components/NavigationProgress";
import { Suspense } from "react";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  // Trimmed from 5 → 3 weights. 500/800 collapse to adjacent weights via font-synthesis.
  weight: ["400", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-label",
  weight: ["500", "700"],
  display: "swap",
});

const SITE_TITLE = "AnalytixLabs Editorial | Data Science & AI Insights";
const SITE_DESCRIPTION =
  "Deep, authoritative insights into Data Science, Machine Learning, AI, and Analytics from industry experts at AnalytixLabs.";

// Sitewide fallback — individual routes (blog posts, /blog/, /salary-hub/) set
// their own openGraph/twitter/alternates.canonical and override these per-page.
export const metadata = {
  metadataBase: new URL("https://www.analytixlabs.co.in"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/blog",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    siteName: "AnalytixLabs",
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/authorlogo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/authorlogo.png"],
  },
};

// Organization schema — the single identity every page's Article/WebPage/Blog
// schema links back to via `publisher`, so AI/search systems can attribute
// content to a consistent entity instead of re-deriving it per page.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.analytixlabs.co.in/#organization",
  name: "AnalytixLabs",
  url: "https://www.analytixlabs.co.in/",
  logo: {
    "@type": "ImageObject",
    url: "https://www.analytixlabs.co.in/blog/logo.svg",
  },
  // Matches FOOTER_DATA.socialLinks in lib/config.js — the site's actual,
  // verified social profiles (kept in sync manually; update both if these change).
  sameAs: [
    "https://www.linkedin.com/company/analytixlabs/",
    "https://twitter.com/AnalytixLabs",
    "https://www.facebook.com/analytixlabs",
    "https://www.youtube.com/@analytixlabs./videos",
    "https://instagram.com/analytixlabs?igshid=5outdkxzn8xq",
  ],
};

import Script from "next/script";

export default function RootLayout({ children }) {
  // §6 (SEO remediation): gate analytics to the real production deployment.
  // On Vercel BOTH production and preview builds have NODE_ENV=production, so
  // VERCEL_ENV is the only reliable discriminator. It's server-only, so we read
  // it here and pass the flag down to client components (TrackingScripts) as a
  // prop. Keeps GTM/GA4 free of preview-deploy and local-dev noise.
  const isProd = process.env.VERCEL_ENV === "production";
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${spaceGrotesk.variable} overflow-x-hidden`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD).replace(/</g, "\\u003c") }}
        />
        {/* Google Tag Manager — production only (gated so preview/dev deploys
            don't fire GTM→GA4 or trip GTM's "additional domains" warning) */}
        {isProd && (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(){"use strict";function l(e){for(var t=e,r=0,n=document.cookie.split(";");r<n.length;r++){var o=n[r].split("=");if(o[0].trim()===t)return o[1]}}function s(e){return localStorage.getItem(e)}function u(e){return window[e]}function A(e,t){e=document.querySelector(e);return t?null==e?void 0:e.getAttribute(t):null==e?void 0:e.textContent}var e=window,t=document,r="script",n="dataLayer",o="https://sgtmv1.analytixlabs.co.in",a="https://load.sgtmv1.analytixlabs.co.in",i="3x7ovfqaivmiy",c="aab=EA1QMT0sXCs3XiY8PTc%2FQA9UX1hYRxUIRAgDFwUYBQ8BBQwUGk8SCVcAAw%3D%3D",g="cookie",v="_user_id",E="",d=!1;try{var d=!!g&&(m=navigator.userAgent,!!(m=new RegExp("Version/([0-9._]+)(.*Mobile)?.*Safari.*").exec(m)))&&16.4<=parseFloat(m[1]),f="stapeUserId"===g,I=d&&!f?function(e,t,r){void 0===t&&(t="");var n={cookie:l,localStorage:s,jsVariable:u,cssSelector:A},t=Array.isArray(t)?t:[t];if(e&&n[e])for(var o=n[e],a=0,i=t;a<i.length;a++){var c=i[a],c=r?o(c,r):o(c);if(c)return c}else console.warn("invalid uid source",e)}(g,v,E):void 0;d=d&&(!!I||f)}catch(e){console.error(e)}var m=e,g=(m[n]=m[n]||[],m[n].push({"gtm.start":(new Date).getTime(),event:"gtm.js"}),t.getElementsByTagName(r)[0]),v=I?"&bi="+encodeURIComponent(I):"",E=t.createElement(r),f=(d&&(i=8<i.length?i.replace(/([a-z]{8}$)/,"kp$1"):"kp"+i),!d&&a?a:o);E.async=!0,E.src=f+"/"+i+".js?"+c+v,null!=(e=g.parentNode)&&e.insertBefore(E,g)}();`
          }}
        />
        )}
        {/* End Google Tag Manager */}
        {/* Preconnect to font/CDN origins so the deferred stylesheet requests resolve faster */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        {/* Non-blocking stylesheets: load with media="print" then promote to "all" */}
        {/* suppressHydrationWarning: the inline promoter below flips media="print"→"all"
            once the sheet loads, which would otherwise trip React's hydration check. */}
        <link
          data-lazy-css="1"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300..600,0..1,0&display=swap"
          rel="stylesheet"
          media="print"
          suppressHydrationWarning
        />
        <link
          data-lazy-css="1"
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          media="print"
          suppressHydrationWarning
        />
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300..600,0..1,0&display=swap"
            rel="stylesheet"
          />
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
          />
        </noscript>
        <meta name="generator" content="Elementor 3.35.4; features: e_font_icon_svg, additional_custom_breakpoints; settings: css_print_method-internal, google_font-enabled, font_display-swap" />
      </head>
      <body className="min-h-screen antialiased">
        {/* Google Tag Manager (noscript) — production only */}
        {isProd && (
        <noscript>
          <iframe
            src="https://load.sgtmv1.analytixlabs.co.in/ns.html?id=GTM-MN7KJTVN"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        )}
        {/* End Google Tag Manager (noscript) */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function() { try { var t = localStorage.getItem('theme'); if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) { document.documentElement.classList.add('dark'); } } catch (e) {} })();`,
          }}
        />
        <Script
          id="lazy-css-promoter"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('link[data-lazy-css]').forEach(function(l){var a=function(){l.media='all'};if(l.sheet){a()}else{l.addEventListener('load',a,{once:true})}});",
          }}
        />

        <ClientInit />
        <TrackingScripts enabled={isProd} />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
