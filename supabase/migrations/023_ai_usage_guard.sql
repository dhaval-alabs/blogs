-- Migration 023: durable rate limiting + usage logging for the public AI endpoints
--
-- /api/ask-ai and /api/ask-ai/followups are PUBLIC, unauthenticated POSTs that
-- each spend a Gemini call. Their only protection was:
--
--   const rateLimitMap = new Map();   // per-instance, in-memory
--   const RATE_LIMIT_MAX = 15;        // per minute per IP
--
-- which does not work on serverless: the Map is empty on every cold start and
-- is not shared between the concurrent instances Vercel runs, so the real
-- ceiling is far above 15/min. Nothing logged the calls either, so abuse left
-- no trace anywhere — when the Gemini project was flagged for suspicious
-- activity in Aug 2026 there was no way to tell how much of the traffic came
-- through this endpoint.
--
-- This adds the two things that were missing:
--   1. counters in Postgres, so the limit is shared across every instance
--   2. a usage log, so the traffic is visible after the fact
--
-- Plus a GLOBAL daily cap, which is the control that actually protects the
-- bill: a per-IP limit does nothing against a distributed caller, and it was a
-- per-IP limit that let thousands of requests through.
--
-- Additive + idempotent.

-- ── Counters ────────────────────────────────────────────────────────────────
-- One row per (scope, bucket, window). Rows are disposable: they exist only for
-- the length of their window and are pruned below.
create table if not exists blog.ai_rate_counters (
  scope        text        not null,          -- 'ip' | 'global'
  bucket       text        not null,          -- hashed IP, or 'all' for global
  window_start timestamptz not null,          -- floor(now / window), so windows are fixed not sliding
  count        integer     not null default 0,
  primary key (scope, bucket, window_start)
);

comment on table blog.ai_rate_counters is
  'Shared rate-limit counters for the public AI endpoints. Fixed windows, not sliding — a fixed window is cheap and its worst case (2x the limit across a boundary) is acceptable here.';

-- ── Usage log ───────────────────────────────────────────────────────────────
-- The point is answering "how much did this endpoint actually serve, and to
-- whom?" months later. The IP is stored HASHED: enough to group and rate-limit
-- a caller, not enough to be a plain record of visitors' addresses.
create table if not exists blog.ai_usage (
  id             bigserial   primary key,
  route          text        not null,        -- 'ask-ai' | 'ask-ai/followups'
  ip_hash        text,
  model          text,
  outcome        text        not null,        -- 'served' | 'blocked_ip' | 'blocked_global' | 'error'
  question_chars integer,
  detail         text,
  created_at     timestamptz not null default now()
);

comment on table blog.ai_usage is
  'One row per request to a public AI endpoint. ip_hash is a salted hash, never a raw address.';

-- "How much did we serve today, and is anything hammering us" — the two reads
-- this table exists for.
create index if not exists ai_usage_created_idx on blog.ai_usage (created_at desc);
create index if not exists ai_usage_ip_idx      on blog.ai_usage (ip_hash, created_at desc);

-- ── The guard ───────────────────────────────────────────────────────────────
-- One round trip that increments and decides, so two concurrent requests cannot
-- both read "14 used" and both proceed.
--
-- Order matters: the per-IP counter is checked FIRST and the global counter is
-- only touched if that passes. Incrementing the global counter for a request
-- already rejected per-IP would let one hammering caller exhaust the global cap
-- and lock everyone else out — turning a rate limit into a denial of service.
create or replace function blog.ai_guard(
  p_ip_hash             text,
  p_ip_limit            integer,
  p_ip_window_seconds   integer,
  p_global_limit        integer,
  p_global_window_seconds integer
)
returns table (allowed boolean, reason text, ip_used integer, global_used integer)
language plpgsql
as $$
declare
  v_ip_window timestamptz;
  v_g_window  timestamptz;
  v_ip        integer;
  v_g         integer;
begin
  v_ip_window := to_timestamp(floor(extract(epoch from now()) / p_ip_window_seconds) * p_ip_window_seconds);
  v_g_window  := to_timestamp(floor(extract(epoch from now()) / p_global_window_seconds) * p_global_window_seconds);

  insert into blog.ai_rate_counters as c (scope, bucket, window_start, count)
  values ('ip', p_ip_hash, v_ip_window, 1)
  on conflict (scope, bucket, window_start) do update set count = c.count + 1
  returning c.count into v_ip;

  if v_ip > p_ip_limit then
    return query select false, 'blocked_ip'::text, v_ip, 0;
    return;
  end if;

  insert into blog.ai_rate_counters as c (scope, bucket, window_start, count)
  values ('global', 'all', v_g_window, 1)
  on conflict (scope, bucket, window_start) do update set count = c.count + 1
  returning c.count into v_g;

  if v_g > p_global_limit then
    return query select false, 'blocked_global'::text, v_ip, v_g;
    return;
  end if;

  return query select true, null::text, v_ip, v_g;
end
$$;

comment on function blog.ai_guard(text, integer, integer, integer, integer) is
  'Atomically increments the per-IP and global counters and returns whether this request may proceed. Per-IP is evaluated first so a single hammering caller cannot consume the global cap.';

-- Housekeeping: counters are worthless once their window has passed, and the
-- table would otherwise grow forever. Cheap enough to call inline.
create or replace function blog.ai_guard_prune(p_keep_hours integer default 48)
returns integer
language sql
as $$
  with gone as (
    delete from blog.ai_rate_counters
     where window_start < now() - (p_keep_hours || ' hours')::interval
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- RLS: the app writes with the service role, which bypasses RLS, so this
-- changes no app behaviour. It makes both tables deny-by-default for the public
-- anon key — these hold usage telemetry and must not be readable from a browser.
alter table blog.ai_rate_counters enable row level security;
alter table blog.ai_usage         enable row level security;

-- Refresh PostgREST schema cache so the new function/tables are callable.
NOTIFY pgrst, 'reload schema';
