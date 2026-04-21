import { Suspense } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThankYouClient from "./ThankYouClient";

export const metadata = {
  title: "Thank You | AnalytixLabs",
  description: "Thanks for reaching out. Our team will contact you shortly.",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 min-h-[70vh] w-full max-w-3xl mx-auto px-6">
        <div className="rounded-3xl border border-outline-variant/20 dark:border-[#424754] bg-white dark:bg-[#0b1326] p-8 md:p-12 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="material-symbols-outlined text-4xl text-emerald-500"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Request received
            </span>
          </div>

          <h1 className="font-[family-name:var(--font-headline)] font-extrabold text-3xl md:text-4xl text-on-background dark:text-[#dae2fd] leading-tight mb-4">
            <Suspense fallback="Thank you for reaching out!">
              <ThankYouClient />
            </Suspense>
          </h1>

          <p className="text-on-surface-variant dark:text-[#c2c6d6] text-base leading-relaxed mb-8">
            Our course counsellors will call you shortly to walk you through
            curriculum, batch timings, and placement support. In the meantime,
            feel free to explore what we offer.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <Link
              href="https://www.analytixlabs.co.in/courses"
              className="group flex items-start gap-3 p-5 rounded-2xl border border-outline-variant/20 dark:border-[#424754] hover:border-primary/50 dark:hover:border-[#adc6ff]/50 transition-colors bg-surface-container-lowest dark:bg-[#131b2e]"
            >
              <span className="material-symbols-outlined text-primary dark:text-[#adc6ff]">
                school
              </span>
              <div>
                <div className="font-bold text-sm text-on-background dark:text-[#dae2fd] group-hover:text-primary dark:group-hover:text-[#adc6ff]">
                  Browse Courses
                </div>
                <div className="text-xs text-on-surface-variant dark:text-[#8c909f] mt-1">
                  Data Science, AI, Analytics programs
                </div>
              </div>
            </Link>

            <Link
              href="/blog"
              className="group flex items-start gap-3 p-5 rounded-2xl border border-outline-variant/20 dark:border-[#424754] hover:border-primary/50 dark:hover:border-[#adc6ff]/50 transition-colors bg-surface-container-lowest dark:bg-[#131b2e]"
            >
              <span className="material-symbols-outlined text-primary dark:text-[#adc6ff]">
                menu_book
              </span>
              <div>
                <div className="font-bold text-sm text-on-background dark:text-[#dae2fd] group-hover:text-primary dark:group-hover:text-[#adc6ff]">
                  Continue Reading
                </div>
                <div className="text-xs text-on-surface-variant dark:text-[#8c909f] mt-1">
                  Expert articles on Data & AI
                </div>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-outline-variant/10 dark:border-[#424754] text-sm text-on-surface-variant dark:text-[#c2c6d6]">
            <a
              href="tel:+919555219007"
              className="inline-flex items-center gap-2 hover:text-primary dark:hover:text-[#adc6ff]"
            >
              <span className="material-symbols-outlined text-base">call</span>
              +91 95552 19007
            </a>
            <span className="opacity-30">·</span>
            <span>Noida · Gurgaon · Bangalore</span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
