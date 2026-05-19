import { NextResponse } from 'next/server';
import { getSalaryEstimate } from '@/lib/salary-estimator.server';

export const runtime = 'nodejs';
// Cache the route itself for 1h on the edge so repeat hits don't even reach
// the cache table. The estimator's own TTL is 7d.
export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const location = searchParams.get('location');
  const experience = searchParams.get('experience');

  if (!role || !location || !experience) {
    return NextResponse.json({ error: 'Missing role, location, or experience.' }, { status: 400 });
  }

  const result = await getSalaryEstimate(role, location, experience);

  if (!result.ok) {
    // Caller still gets the deterministic fallback so the UI never breaks.
    return NextResponse.json({
      ok: false,
      error: result.error,
      fallback: result.fallback,
    }, { status: 200 });
  }

  const { estimate, source } = result;
  return NextResponse.json({
    ok: true,
    source, // 'cache' | 'cache_stale' | 'fresh'
    estimate: {
      min: Number(estimate.min_lpa).toFixed(1),
      median: Number(estimate.median_lpa).toFixed(1),
      max: Number(estimate.max_lpa).toFixed(1),
      yoy_delta_pct: estimate.yoy_delta_pct,
      commentary: estimate.commentary || '',
      sources: estimate.sources || [],
      refreshed_at: estimate.refreshed_at,
    },
  });
}
