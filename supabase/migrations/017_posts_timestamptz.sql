-- Migration 017: posts.published_at / updated_at → timestamptz
-- Idempotent: safe to re-run whether columns are still TEXT or already
-- converted to TIMESTAMPTZ from a partial earlier run.

DO $$
DECLARE
  v_published_type text;
  v_updated_type   text;
BEGIN
  SELECT data_type INTO v_published_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'posts'
     AND column_name  = 'published_at';

  SELECT data_type INTO v_updated_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'posts'
     AND column_name  = 'updated_at';

  -- ── published_at ────────────────────────────────────────────────
  IF v_published_type = 'text' THEN
    UPDATE posts SET published_at = NULL WHERE published_at = '';
    ALTER TABLE posts ALTER COLUMN published_at DROP DEFAULT;
    ALTER TABLE posts
      ALTER COLUMN published_at TYPE timestamptz
      USING NULLIF(published_at, '')::timestamptz;
  END IF;

  -- ── updated_at ─────────────────────────────────────────────────
  IF v_updated_type = 'text' THEN
    UPDATE posts SET updated_at = NULL WHERE updated_at = '';
    ALTER TABLE posts ALTER COLUMN updated_at DROP DEFAULT;
    ALTER TABLE posts
      ALTER COLUMN updated_at TYPE timestamptz
      USING NULLIF(updated_at, '')::timestamptz;
  END IF;
END $$;

-- ── Defaults (safe to set whether or not the type change just ran) ──
ALTER TABLE posts ALTER COLUMN updated_at SET DEFAULT now();
-- published_at intentionally has no default; application code sets it on
-- transition from Draft → Published / Scheduled.

-- ── Indexes for the queries that sort on these columns ─────────────
CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS posts_updated_at_idx   ON posts (updated_at   DESC NULLS LAST);
