-- Migration 020: Salary estimate cache
-- Stores Gemini-generated salary estimates keyed by (role, location, experience).
-- The /api/salary route returns cached rows when refreshed_at is within the
-- TTL configured server-side, otherwise refreshes from Gemini with Google
-- Search grounding and upserts back here.

CREATE TABLE IF NOT EXISTS salary_estimates (
  id            bigserial PRIMARY KEY,
  role          text        NOT NULL,
  location      text        NOT NULL,
  experience    text        NOT NULL,
  min_lpa       numeric(6,1) NOT NULL,
  median_lpa    numeric(6,1) NOT NULL,
  max_lpa       numeric(6,1) NOT NULL,
  commentary    text        DEFAULT '',
  sources       jsonb       DEFAULT '[]'::jsonb,
  yoy_delta_pct numeric(5,1),
  refreshed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, location, experience)
);

CREATE INDEX IF NOT EXISTS salary_estimates_refreshed_at_idx
  ON salary_estimates (refreshed_at DESC);

-- Public read access via service role only; the route handler uses the
-- service client, so we leave RLS off for this table (no client-side reads).
