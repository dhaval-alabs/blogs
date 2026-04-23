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
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-label",
  weight: ["500", "700"],
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
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
