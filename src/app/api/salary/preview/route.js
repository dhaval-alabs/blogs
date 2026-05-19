import { NextResponse } from 'next/server';
import { getSalaryEstimate } from '@/lib/salary-estimator.server';
import { SALARY_PREVIEW_POOL } from '@/lib/config';

export const runtime = 'nodejs';
// Re-evaluated hourly so the Monday rollover to a new lineup picks up promptly.
// The underlying salary numbers refresh weekly via the /api/salary TTL.
export const revalidate = 3600;

function isoWeekIndex(date = new Date()) {
  // ISO-8601 week number. Same week for everyone on the same UTC day.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function pickEntries(pool, count, weekIndex) {
  const startIdx = (weekIndex * count) % pool.length;
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool[(startIdx + i) % pool.length]);
  return out;
}

function formatRow(entry, est) {
  // est shape: { min_lpa, median_lpa, max_lpa, yoy_delta_pct, ... } when ok,
  // or {min, max, median} (strings) when fallback.
  const min = est.min_lpa ?? est.min;
  const max = est.max_lpa ?? est.max;
  const yoy = est.yoy_delta_pct ?? null;
  return {
    role: entry.display,
    range: `₹${Number(min).toFixed(0)}–${Number(max).toFixed(0)} LPA`,
    meta: `${entry.location} · ${entry.experience} yrs`,
    yoy,
    refreshed_at: est.refreshed_at || null,
  };
}

export async function GET() {
  const weekIndex = isoWeekIndex();
  const picks = pickEntries(SALARY_PREVIEW_POOL, 4, weekIndex);

  // Resolve all 4 in parallel. Each call hits the 7-day cache table first,
  // so the typical request fans out into 4 trivial Supabase reads.
  const results = await Promise.all(picks.map((p) =>
    getSalaryEstimate(p.role, p.location, p.experience)
      .then((r) => ({ entry: p, result: r }))
      .catch(() => ({ entry: p, result: null }))
  ));

  const rows = results.map(({ entry, result }) => {
    if (result?.ok && result.estimate) return formatRow(entry, result.estimate);
    if (result?.fallback) return formatRow(entry, result.fallback);
    return null;
  }).filter(Boolean);

  // Badge the row with the strongest positive YoY delta (if any).
  let badgeIdx = -1;
  let badgeYoy = -Infinity;
  rows.forEach((r, i) => {
    if (r.yoy != null && r.yoy > badgeYoy) {
      badgeYoy = r.yoy;
      badgeIdx = i;
    }
  });
  if (badgeIdx >= 0 && badgeYoy > 0) rows[badgeIdx].badge = 'Hot';

  return NextResponse.json({
    ok: rows.length > 0,
    week: weekIndex,
    rows,
  });
}
