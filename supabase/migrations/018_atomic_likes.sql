-- Migration 018: Atomic like counters
-- Replaces the JS read-modify-write pattern (which loses updates under
-- concurrency) with a single-statement UPDATE + RETURNING under Postgres'
-- row-level lock.

-- ── posts.likes ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_post_likes(p_slug text, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  UPDATE posts
     SET likes = GREATEST(0, COALESCE(likes, 0) + p_delta)
   WHERE slug = p_slug
  RETURNING likes INTO v_new;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post not found: %', p_slug USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new;
END;
$$;

-- ── comments.likes ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_comment_likes(p_id integer, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  UPDATE comments
     SET likes = GREATEST(0, COALESCE(likes, 0) + p_delta)
   WHERE id = p_id
  RETURNING likes INTO v_new;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'comment not found: %', p_id USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION increment_post_likes(text, integer)    FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_comment_likes(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_post_likes(text, integer)    TO service_role;
GRANT EXECUTE ON FUNCTION increment_comment_likes(integer, integer) TO service_role;
