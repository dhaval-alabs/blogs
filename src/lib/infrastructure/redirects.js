// Edge-Config-backed redirect cache.
//
// Why: middleware.js previously queried Supabase on every request for the
// `redirects` table, adding 50-100ms of latency and DB load on every page hit.
// Edge Config reads are <1ms at the edge and free for our access pattern.
//
// Strategy: Supabase remains the source of truth (CMS writes go there). After
// every redirect mutation we push the *entire active-redirect map* into a
// single Edge Config key (`redirects`). The middleware reads only that key.
//
// Env vars (all optional in dev):
//   EDGE_CONFIG       — read connection string (auto-injected by Vercel
//                        when an Edge Config store is attached to the project)
//   EDGE_CONFIG_ID    — store ID, required for writes (sync)
//   VERCEL_API_TOKEN  — personal/team token with Edge Config write scope
//   VERCEL_TEAM_ID    — optional, only if the store is team-scoped
//
// If EDGE_CONFIG is unset the reader falls back to Supabase so local dev
// works without provisioning anything.

import { getServiceClient } from '@/lib/supabase';

const REDIRECTS_KEY = 'redirects';

// ── READ ────────────────────────────────────────────────────────
// Returns the active redirect for `pathname` or null.
// Shape of the cached value: { "<source>": { destination, type } }
export async function lookupRedirect(pathname) {
  const map = await getRedirectMap();
  if (!map) return null;
  // Try exact, then the trailing-slash variant. Sources saved before
  // normalization landed (or imported from elsewhere) may still carry a
  // trailing slash; the proxy strips it before calling here, so without this
  // fallback those rules would never fire.
  if (map[pathname]) return map[pathname];
  if (pathname !== '/' && map[pathname + '/']) return map[pathname + '/'];
  return null;
}

async function getRedirectMap() {
  const conn = process.env.EDGE_CONFIG;
  if (conn) {
    try {
      const [base, query] = conn.split('?');
      const url = `${base}/item/${REDIRECTS_KEY}${query ? `?${query}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
      if (res.status !== 404) {
        console.warn('[redirects] Edge Config read failed:', res.status);
      }
    } catch (err) {
      console.warn('[redirects] Edge Config read threw:', err?.message);
    }
  }
  // Fallback: read from Supabase. Only hit in local dev or when Edge Config
  // is misconfigured. Production should never reach this path.
  return await readFromSupabase();
}

async function readFromSupabase() {
  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from('redirects')
      .select('source, destination, type')
      .eq('active', true);
    if (error) throw error;
    const map = {};
    for (const r of data || []) {
      map[r.source] = { destination: r.destination, type: r.type || 301 };
    }
    return map;
  } catch (err) {
    console.error('[redirects] Supabase fallback failed:', err?.message);
    return {};
  }
}

// ── WRITE ───────────────────────────────────────────────────────
// Called by siteConfigService after every redirect mutation.
// Fetches the canonical state from Supabase and overwrites the Edge Config
// key. Idempotent — safe to call from create/update/delete code paths.
//
// Failures are logged but not thrown: a sync failure must NOT break the
// admin's save operation. The next successful mutation will repair the cache.
export async function syncRedirectsToEdgeConfig() {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[redirects] sync skipped: EDGE_CONFIG_ID or VERCEL_API_TOKEN missing');
    }
    return { synced: false, reason: 'edge-config-not-configured' };
  }

  const map = await readFromSupabase();
  const teamQuery = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
  const url = `https://api.vercel.com/v1/edge-config/${id}/items${teamQuery}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ operation: 'upsert', key: REDIRECTS_KEY, value: map }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[redirects] Edge Config sync failed:', res.status, body);
      return { synced: false, reason: `vercel-api-${res.status}` };
    }
    return { synced: true, count: Object.keys(map).length };
  } catch (err) {
    console.error('[redirects] Edge Config sync threw:', err?.message);
    return { synced: false, reason: 'fetch-error' };
  }
}
