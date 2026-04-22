"use client";

import Link from "next/link";

const toSlug = (s) => encodeURIComponent((s || "").toLowerCase().trim().replace(/\s+/g, "-"));

const DEFAULT_CONFIG = {
  enabled: true,
  title: "Categories",
  mode: "auto",
  limit: 12,
  categories: [],
};

export default function SidebarCategories({ posts = [], config }) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  if (cfg.enabled === false) return null;

  const counts = new Map();
  for (const p of posts) {
    const cat = (p?.category || "").trim();
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  let categories;
  if (cfg.mode === "manual" && Array.isArray(cfg.categories) && cfg.categories.length > 0) {
    // Respect admin-chosen order; show 0 counts for categories with no posts.
    categories = cfg.categories.map((name) => [name, counts.get(name) || 0]);
  } else {
    categories = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, cfg.limit);
  }

  if (categories.length === 0) return null;

  return (
    <div className="rounded-2xl border p-5 bg-white dark:bg-surface-container border-outline-variant/20 dark:border-outline-variant/30 ambient-shadow">
      <h3 className="font-[family-name:var(--font-headline)] font-bold text-[16px] text-on-background dark:text-on-surface mb-4">
        {cfg.title}
      </h3>
      <ul className="flex flex-col gap-1">
        {categories.map(([name, count]) => (
          <li key={name}>
            <Link
              href={`/blog/${toSlug(name)}/`}
              className="flex items-center justify-between p-2 rounded-xl text-[14px] text-on-surface-variant dark:text-on-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-surface-container-low dark:hover:bg-surface-variant transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="material-symbols-outlined text-[16px] opacity-0 -ml-6 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300">
                  chevron_right
                </span>
                <span className="truncate font-medium">{name}</span>
              </div>
              <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[12px] font-semibold bg-surface-container-highest dark:bg-[#131b2e] text-on-surface-variant dark:text-[#8c909f] group-hover:bg-primary-fixed group-hover:text-primary dark:group-hover:bg-[rgba(173,198,255,0.15)] dark:group-hover:text-[#adc6ff] transition-colors duration-200 border border-transparent group-hover:border-primary/10 dark:group-hover:border-[#adc6ff]/20">
                {count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
