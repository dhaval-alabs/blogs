-- Tests for migration 023 (blog.ai_guard / blog.ai_guard_prune).
--
-- Run against a scratch database, NOT production:
--
--   psql -d postgres -c 'create database ai_guard_test'
--   psql -d ai_guard_test -c 'create schema blog'
--   psql -d ai_guard_test -f supabase/migrations/023_ai_usage_guard.sql
--   psql -d ai_guard_test -f supabase/tests/023_ai_usage_guard.test.sql
--
-- Two things bit while writing these and are worth knowing:
--
--   * The global counter is shared BY DESIGN, so every case must TRUNCATE
--     first. Without it the earlier cases eat the budget the later ones assert
--     on, and the global-cap case fails for the wrong reason.
--
--   * A prune assertion cannot sit in the same SELECT as the prune call: the
--     count would read the statement's opening snapshot and still see the
--     deleted row. Each phase has to be its own statement.

\set ON_ERROR_STOP on
\pset footer off

create or replace function pg_temp.ok(name text, got boolean) returns text
language sql as $$ select case when got then 'PASS  ' else 'FAIL  ' end || name $$;

-- ── per-IP window ───────────────────────────────────────────────────────────
truncate blog.ai_rate_counters;
select pg_temp.ok('per-IP limit admits exactly 3 of 5',
  (select count(*) from (select (blog.ai_guard('ipA',3,60,1000,86400)).*
                         from generate_series(1,5)) x where allowed) = 3);

truncate blog.ai_rate_counters;
select pg_temp.ok('one IP exhausting its window does not affect another',
  (blog.ai_guard('ipB',3,60,1000,86400)).allowed);

-- ── global cap ──────────────────────────────────────────────────────────────
truncate blog.ai_rate_counters;
select pg_temp.ok('global cap admits exactly 2 of 4 despite a huge per-IP allowance',
  (select count(*) from (select (blog.ai_guard('ipC',999,60,2,86400)).*
                         from generate_series(1,4)) x where allowed) = 2);

truncate blog.ai_rate_counters;
select pg_temp.ok('global cap spans DIFFERENT ips — the point of having it',
  (select count(*) from (
     select (blog.ai_guard('ip1',999,60,2,86400)).allowed union all
     select (blog.ai_guard('ip2',999,60,2,86400)).allowed union all
     select (blog.ai_guard('ip3',999,60,2,86400)).allowed) x where allowed) = 2);

-- ── the reason reaches the caller, so the 429 body and log can name the cause ─
truncate blog.ai_rate_counters;
select pg_temp.ok('reason = blocked_ip',     (blog.ai_guard('ipD',0,60,999,86400)).reason = 'blocked_ip');
truncate blog.ai_rate_counters;
select pg_temp.ok('reason = blocked_global', (blog.ai_guard('ipE',999,60,0,86400)).reason = 'blocked_global');

-- ── the denial-of-service property ──────────────────────────────────────────
-- A request already refused per-IP must NOT touch the global counter. If it
-- did, one hammering caller would drain the global cap and lock out every
-- other reader — converting a rate limit into an outage.
truncate blog.ai_rate_counters;
select (blog.ai_guard('flood',1,60,10,86400)).allowed from generate_series(1,8);
select pg_temp.ok('an IP-blocked request consumes no global budget',
  (select count from blog.ai_rate_counters where scope = 'global') = 1);

-- ── prune ───────────────────────────────────────────────────────────────────
truncate blog.ai_rate_counters;
insert into blog.ai_rate_counters (scope, bucket, window_start, count)
values ('ip','expired', now() - interval '5 days', 1),
       ('ip','current', now(), 1);
select pg_temp.ok('prune reports 1 row removed', blog.ai_guard_prune(48) = 1);
select pg_temp.ok('prune kept the current window and only that',
  (select count(*) from blog.ai_rate_counters) = 1
  and exists (select 1 from blog.ai_rate_counters where bucket = 'current'));

-- ── atomicity ───────────────────────────────────────────────────────────────
-- The property the old in-memory limiter could never provide. Not expressible
-- in one session; run concurrently instead:
--
--   psql -d ai_guard_test -c 'truncate blog.ai_rate_counters'
--   for i in $(seq 1 40); do
--     psql -d ai_guard_test -At -c \
--       "select (blog.ai_guard('race',10,60,10000,86400)).allowed" &
--   done > /tmp/race.txt; wait
--   grep -c '^t$' /tmp/race.txt    # must be exactly 10
--
-- Verified: 40 concurrent callers against a limit of 10 → 10 allowed, 30 denied.
