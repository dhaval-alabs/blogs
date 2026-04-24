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

export const metadata = {
  metadataBase: new URL("https://www.analytixlabs.co.in"),
  title: "AnalytixLabs Editorial | Data Science & AI Insights",
  description:
    "Deep, authoritative insights into Data Science, Machine Learning, AI, and Analytics from industry experts at AnalytixLabs.",
  alternates: {
    canonical: "/blog",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${spaceGrotesk.variable} overflow-x-hidden`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() { try { var t = localStorage.getItem('theme'); if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) { document.documentElement.classList.add('dark'); } } catch (e) {} })();`,
          }}
        />
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
        {/* Promote deferred stylesheets to active once the browser has them parsed */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('link[data-lazy-css]').forEach(function(l){var a=function(){l.media='all'};if(l.sheet){a()}else{l.addEventListener('load',a,{once:true})}});",
          }}
        />
        <meta name="generator" content="Elementor 3.35.4; features: e_font_icon_svg, additional_custom_breakpoints; settings: css_print_method-internal, google_font-enabled, font_display-swap" />
      </head>
      <body className="min-h-screen antialiased">
        {/* GTM noscript fallback */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MN7KJTVN"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <ClientInit />
        <TrackingScripts />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
