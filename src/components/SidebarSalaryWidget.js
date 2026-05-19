"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SALARY_PREVIEW_ROWS } from "@/lib/config";

/**
 * Sidebar salary teaser widget.
 *
 * Behavior:
 *   - Fetches /api/salary/preview on mount → 4 rows that rotate weekly,
 *     backed by the Gemini-grounded salary_estimates cache.
 *   - Falls back to the static SALARY_PREVIEW_ROWS in lib/config if the
 *     endpoint fails or hasn't responded yet on first paint.
 *   - Accepts a `config` prop to override title / cta / rows entirely (used
 *     by the studio preview pane).
 */
export default function SidebarSalaryWidget({ config }) {
  const title    = config?.title    || `India DS Salaries ${new Date().getFullYear()}`;
  const ctaLabel = config?.cta_label || "Full Salary Report + Calculator →";
  const ctaUrl   = config?.cta_url   || "/salary-hub";

  const overrideRows = config?.rows?.length ? config.rows : null;

  const [rows, setRows] = useState(overrideRows || SALARY_PREVIEW_ROWS);
  const [loading, setLoading] = useState(!overrideRows);

  useEffect(() => {
    if (overrideRows) return; // studio override path — no fetch.
    let cancelled = false;

    fetch("/api/salary/preview")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows);
        }
      })
      .catch(() => { /* keep fallback rows */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [overrideRows]);

  return (
    <div className="rounded-2xl border p-5 bg-white dark:bg-[#0b1326] border-outline-variant/10 dark:border-[#424754] shadow-sm">
      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-outline-variant/30 dark:border-[#424754] text-on-surface-variant dark:text-[#c2c6d6] mb-5">
        {title}
      </span>
      <div className="flex flex-col divide-y divide-outline-variant/10 dark:divide-[#424754]/40">
        {rows.map(({ role, range, meta, badge }) => (
          <div key={`${role}-${meta}`} className="flex items-center justify-between py-3">
            <div>
              <div className="text-[13px] font-bold text-on-background dark:text-[#dae2fd] flex items-center gap-2">
                {role}
                {badge && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide text-white"
                    style={{ background: "linear-gradient(135deg,#4C7FD2,#27416C)" }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-on-surface-variant dark:text-[#8c909f] mt-0.5">
                {meta}
              </div>
            </div>
            <span className={`text-[13px] font-bold ${loading ? "opacity-60" : ""}`} style={{ color: "#16a34a" }}>
              {range}
            </span>
          </div>
        ))}
      </div>
      <Link
        href={ctaUrl}
        className="block w-full mt-5 py-3 rounded-2xl text-sm font-bold text-center text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#4C7FD2 57%,#27416C 100%)" }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
