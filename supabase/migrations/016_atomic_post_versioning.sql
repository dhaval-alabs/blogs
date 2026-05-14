-- Migration 016: Atomic post versioning
-- Eliminates the read-modify-write race in snapshotVersion and
-- guarantees snapshot + update happen in a single transaction.

-- ── Defensive uniqueness on (post_id, version_number) ───────────
-- Backfills first: dedupe any existing collisions (keeps the earliest row).
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY post_id, version_number ORDER BY id) AS rn
  FROM post_versions
)
DELETE FROM post_versions
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

ALTER TABLE post_versions
  DROP CONSTRAINT IF EXISTS post_versions_post_version_unique;

ALTER TABLE post_versions
  ADD CONSTRAINT post_versions_post_version_unique
  UNIQUE (post_id, version_number);

-- ── Atomic snapshot RPC ─────────────────────────────────────────
-- Locks the source post row (FOR UPDATE) so concurrent callers serialize
-- on the same row, then computes the next version_number under that lock.
-- Returns the new version_number, or NULL if the post does not exist.
CREATE OR REPLACE FUNCTION snapshot_post_version(p_post_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current posts%ROWTYPE;
  v_next    integer;
BEGIN
  SELECT * INTO v_current FROM posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next
    FROM post_versions
    WHERE post_id = p_post_id;

  INSERT INTO post_versions (
    post_id, title, content, excerpt, category, domain_tags, skill_level,
    image, alt_text, seo, course_mappings, course_cta, newsletter, ai_hints,
    trust, discussion, advanced, updated_by, version_number
  ) VALUES (
    p_post_id,
    v_current.title,
    v_current.content,
    v_current.excerpt,
    v_current.category,
    v_current.domain_tags,
    v_current.skill_level,
    v_current.image,
    COALESCE(v_current.alt_text, ''),
    v_current.seo,
    v_current.course_mappings,
    v_current.course_cta,
    v_current.newsletter,
    v_current.ai_hints,
    v_current.trust,
    v_current.discussion,
    v_current.advanced,
    COALESCE(v_current.author_id, 'al-editorial'),
    v_next
  );

  RETURN v_next;
END;
$$;

-- ── Atomic update-with-snapshot RPC ─────────────────────────────
-- Performs (in one transaction, under a row lock on the target post):
--   1. Slug collision check against other posts
--   2. Snapshot of current state into post_versions
--   3. UPDATE of the post with the supplied JSONB row
--
-- Returns a JSONB envelope: { ok, error?, slug?, version? }.
-- This eliminates the "snapshot succeeded but update failed" window.
CREATE OR REPLACE FUNCTION update_post_atomic(
  p_id  integer,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current     posts%ROWTYPE;
  v_new_slug    text;
  v_collision   record;
  v_version     integer;
BEGIN
  SELECT * INTO v_current FROM posts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Post not found');
  END IF;

  v_new_slug := COALESCE(p_row->>'slug', v_current.slug);

  SELECT id, title INTO v_collision
    FROM posts
   WHERE slug = v_new_slug AND id <> p_id
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('URL Conflict: slug "%s" is already used by "%s".', v_new_slug, v_collision.title)
    );
  END IF;

  -- Inline snapshot (same logic as snapshot_post_version but reuses the lock).
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version
    FROM post_versions
    WHERE post_id = p_id;

  INSERT INTO post_versions (
    post_id, title, content, excerpt, category, domain_tags, skill_level,
    image, alt_text, seo, course_mappings, course_cta, newsletter, ai_hints,
    trust, discussion, advanced, updated_by, version_number
  ) VALUES (
    p_id,
    v_current.title, v_current.content, v_current.excerpt, v_current.category,
    v_current.domain_tags, v_current.skill_level, v_current.image,
    COALESCE(v_current.alt_text, ''), v_current.seo, v_current.course_mappings,
    v_current.course_cta, v_current.newsletter, v_current.ai_hints,
    v_current.trust, v_current.discussion, v_current.advanced,
    COALESCE(v_current.author_id, 'al-editorial'),
    v_version
  );

  -- Apply update. COALESCE keeps existing values for fields not present in p_row.
  UPDATE posts SET
    title           = COALESCE(p_row->>'title',                       title),
    slug            = v_new_slug,
    excerpt         = COALESCE(p_row->>'excerpt',                     excerpt),
    content         = COALESCE(p_row->>'content',                     content),
    category        = COALESCE(p_row->>'category',                    category),
    domain_tags     = COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(p_row->'domain_tags')), domain_tags),
    skill_level     = COALESCE(p_row->>'skill_level',                 skill_level),
    read_time       = COALESCE(p_row->>'read_time',                   read_time),
    author_id       = COALESCE(p_row->>'author_id',                   author_id),
    image           = COALESCE(p_row->>'image',                       image),
    alt_text        = COALESCE(p_row->>'alt_text',                    alt_text),
    seo             = COALESCE(p_row->'seo',                          seo),
    course_mappings = COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(p_row->'course_mappings')), course_mappings),
    course_cta      = COALESCE(p_row->>'course_cta',                  course_cta),
    newsletter      = COALESCE(p_row->'newsletter',                   newsletter),
    ai_hints        = COALESCE(p_row->'ai_hints',                     ai_hints),
    trust           = COALESCE(p_row->'trust',                        trust),
    discussion      = COALESCE(p_row->'discussion',                   discussion),
    advanced        = COALESCE(p_row->'advanced',                     advanced),
    status          = COALESCE(p_row->>'status',                      status),
    published_at    = COALESCE(p_row->>'published_at',                published_at),
    updated_at      = COALESCE(p_row->>'updated_at',                  updated_at)
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_new_slug,
    'version', v_version,
    'previous_slug', v_current.slug
  );
END;
$$;

-- Service role calls these; revoke from anon/auth to avoid public exposure.
REVOKE ALL ON FUNCTION snapshot_post_version(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_post_atomic(integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snapshot_post_version(integer) TO service_role;
GRANT EXECUTE ON FUNCTION update_post_atomic(integer, jsonb) TO service_role;
