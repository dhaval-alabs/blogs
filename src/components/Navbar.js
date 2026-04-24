"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { withBasePath } from "@/utils/basePath";
import { NAV_CATEGORIES } from "@/lib/config";


export default function Navbar({ activeCategory = "Data Science" }) {
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fontScale, setFontScale] = useState(16);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }

    const storedFont = localStorage.getItem("font-scale");
    if (storedFont) {
      const parsed = Number(storedFont);
      setFontScale(parsed);
      document.documentElement.style.fontSize = `${parsed}px`;
    }
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function adjustFont(amount) {
    setFontScale((prev) => {
      const next = Math.max(14, Math.min(prev + amount, 20)); // clamp between 14px and 20px
      document.documentElement.style.fontSize = `${next}px`;
      localStorage.setItem("font-scale", next);
      return next;
    });
  }

  return (
    <>
      <nav className={`fixed top-0 w-full z-50 glass-nav ${scrolled ? "glass-nav--scrolled shadow-md" : "shadow-sm"}`} id="main-nav">
        <div className="relative flex items-center max-w-7xl mx-auto px-6 h-16 gap-2">
          {/* LEFT — hamburger on mobile/tablet, logo + "Blog" link on desktop */}
          <div className="flex items-center gap-3 flex-1 md:flex-none">
            {/* Mobile hamburger (left-aligned) */}
            <button
              className="md:hidden p-2 hover:bg-slate-100/50 dark:hover:bg-[#2d3449]/50 rounded-lg transition-all"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined text-[#434653] dark:text-[#c2c6d6]">
                {menuOpen ? "close" : "menu"}
              </span>
            </button>

            {/* Desktop logo */}
            <Link href="https://www.analytixlabs.co.in/" className="hidden md:flex items-center">
              <Image src={withBasePath("/logo.svg")} alt="AnalytixLabs" width={140} height={32} priority className="object-contain dark:hidden" />
              <Image src={withBasePath("/white.svg")} alt="AnalytixLabs" width={140} height={32} priority className="object-contain hidden dark:block" />
            </Link>
            <div className="w-[1px] h-6 bg-slate-300 dark:bg-[#424754] hidden md:block" />
            <Link
              href="/blog"
              className="hidden md:block font-[family-name:var(--font-headline)] font-bold text-sm text-slate-500 hover:text-[#003b93] dark:text-[#8c909f] dark:hover:text-[#adc6ff] transition-colors"
            >
              Blog
            </Link>
          </div>

          {/* CENTER (mobile/tablet only) — logo centered via absolute positioning so
              the right controls stay flush right and balance is independent of left width */}
          <Link
            href="https://www.analytixlabs.co.in/"
            className="md:hidden absolute left-20 top-1/2 -translate-y-1/2 flex items-center"
            aria-label="AnalytixLabs"
          >
            <Image src={withBasePath("/logo.svg")} alt="AnalytixLabs" width={110} height={26} priority className="object-contain dark:hidden" />
            <Image src={withBasePath("/white.svg")} alt="AnalytixLabs" width={110} height={26} priority className="object-contain hidden dark:block" />
          </Link>

          {/* Right Controls */}
          <div className="flex items-center space-x-3 flex-1 md:flex-none justify-end md:ml-auto">
            {/* Desktop Nav — right-aligned as buttons */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              {NAV_CATEGORIES.map((cat) => {
                const isActive = cat.label === activeCategory;
                return (
                  <Link
                    key={cat.label}
                    href={cat.href}
                    className={`font-[family-name:var(--font-headline)] font-bold text-sm tracking-tight px-4 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? "bg-[#003b93] text-white border-[#003b93] dark:bg-[#adc6ff] dark:text-[#001b3f] dark:border-[#adc6ff]"
                        : "bg-white/60 text-[#003b93] border-[#003b93]/30 hover:bg-[#003b93] hover:text-white dark:bg-[#adc6ff]/10 dark:text-[#adc6ff] dark:border-[#adc6ff]/30 dark:hover:bg-[#adc6ff] dark:hover:text-[#001b3f]"
                    }`}
                  >
                    {cat.label}
                  </Link>
                );
              })}
            </div>

            {/* Font scaling */}
            <div className="hidden md:flex items-center bg-surface-container-low dark:bg-[#131b2e] rounded-lg border border-outline-variant/30 dark:border-[#424754]">
              <button
                className="px-2 py-1 text-xs font-bold font-[family-name:var(--font-headline)] text-[#434653] dark:text-[#c2c6d6] hover:text-primary dark:hover:text-[#adc6ff] transition-colors"
                onClick={() => adjustFont(-1)}
                aria-label="Decrease font size"
              >
                A-
              </button>
              <div className="w-[1px] h-4 bg-outline-variant/30 dark:bg-[#424754]" />
              <button
                className="px-2 py-1 text-sm font-bold font-[family-name:var(--font-headline)] text-[#434653] dark:text-[#c2c6d6] hover:text-primary dark:hover:text-[#adc6ff] transition-colors"
                onClick={() => adjustFont(1)}
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Dark mode toggle */}
            <button
              className="p-2 hover:bg-slate-100/50 dark:hover:bg-[#2d3449]/50 rounded-lg transition-all"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              id="dark-mode-toggle"
            >
              <span className="material-symbols-outlined text-[#434653] dark:text-[#c2c6d6]">
                {isDark ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Home Icon */}
            <Link 
              href="/blog" 
              className="p-2 hover:bg-slate-100/50 dark:hover:bg-[#2d3449]/50 rounded-lg transition-all"
              title="Go to blog homepage"
            >
              <span className="material-symbols-outlined text-[#434653] dark:text-[#c2c6d6]">
                home
              </span>
            </Link>

            {/* User avatar */}
            <button className="w-8 h-8 rounded-full bg-primary/10 dark:bg-[#adc6ff]/15 flex items-center justify-center border border-outline-variant/30 dark:border-[#424754] hover:bg-primary/20 dark:hover:bg-[#adc6ff]/25 transition-colors">
              <span className="material-symbols-outlined text-primary dark:text-[#adc6ff] text-lg">
                account_circle
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[4px] z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 z-[46] bg-white dark:bg-[#131b2e] transform transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden overflow-y-auto px-8 pb-8 pt-24`}
      >
        <nav className="flex flex-col gap-4">
          {NAV_CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href={cat.href}
              className={`font-[family-name:var(--font-headline)] font-bold text-sm ${
                cat.label === activeCategory
                  ? "text-[#003b93] dark:text-[#adc6ff]"
                  : "text-[#434653] dark:text-[#c2c6d6]"
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {cat.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 pt-8 border-t border-outline-variant/20 dark:border-[#424754]/30">
          <p className="text-sm font-bold font-[family-name:var(--font-label)] uppercase tracking-wider text-secondary dark:text-[#8c909f] mb-4">
            Accessibility
          </p>
          <div className="flex items-center gap-4 bg-surface-container-low dark:bg-[#060e20] p-1 rounded-lg border border-outline-variant/30 dark:border-[#424754] w-fit">
            <button
              className="px-4 py-2 text-sm font-bold font-[family-name:var(--font-headline)] text-[#434653] dark:text-[#c2c6d6] hover:text-primary dark:hover:text-[#adc6ff] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
              onClick={() => adjustFont(-1)}
              aria-label="Decrease font size"
            >
              A-
            </button>
            <div className="w-[1px] h-6 bg-outline-variant/30 dark:bg-[#424754]" />
            <button
              className="px-4 py-2 text-lg font-bold font-[family-name:var(--font-headline)] text-[#434653] dark:text-[#c2c6d6] hover:text-primary dark:hover:text-[#adc6ff] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
              onClick={() => adjustFont(1)}
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
