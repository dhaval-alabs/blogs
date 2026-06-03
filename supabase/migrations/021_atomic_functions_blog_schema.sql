-- Migration 021: Move atomic RPC functions into the `blog` schema
--
-- Root cause of "Could not find the function blog.increment_post_likes(...)
-- in the schema cache": the dual-schema migration moved the `posts`,
-- `comments`, and `post_versions` tables into the `blog` schema, but the
-- RPC functions (016/018/019) were created in `public`. The app's Supabase
-- client is configured with `db: { schema: 'blog' }`, so PostgREST resolves
-- RPC names against `blog.*` and never finds them. The orphaned `public`
-- copies were doubly broken: their bodies run with `search_path = public`,
-- where no `posts`/`comments` table exists post-migration.
--
-- Fix: recreate all four functions in `blog` with `search_path = blog` so
-- both lookup (PostgREST) and table resolution (function body) target the
-- blog schema. Idempotent — safe to re-run.

-- ── posts.likes ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION blog.increment_post_likes(p_slug text, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = blog
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
CREATE OR REPLACE FUNCTION blog.increment_comment_likes(p_id integer, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = blog
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

-- ── version snapshot ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION blog.snapshot_post_version(p_post_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = blog
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

-- ── atomic post update (+ version snapshot + slug-collision guard) ───
CREATE OR REPLACE FUNCTION blog.update_post_atomic(p_id integer, p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = blog
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
    -- timestamptz casts: empty string → NULL → fall back to existing value.
    published_at    = COALESCE(NULLIF(p_row->>'published_at', '')::timestamptz, published_at),
    updated_at      = COALESCE(NULLIF(p_row->>'updated_at',   '')::timestamptz, updated_at)
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_new_slug,
    'version', v_version,
    'previous_slug', v_current.slug
  );
END;
$$;

-- ── privileges ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION blog.increment_post_likes(text, integer)        FROM PUBLIC;
REVOKE ALL ON FUNCTION blog.increment_comment_likes(integer, integer)  FROM PUBLIC;
REVOKE ALL ON FUNCTION blog.snapshot_post_version(integer)             FROM PUBLIC;
REVOKE ALL ON FUNCTION blog.update_post_atomic(integer, jsonb)         FROM PUBLIC;

GRANT EXECUTE ON FUNCTION blog.increment_post_likes(text, integer)        TO service_role;
GRANT EXECUTE ON FUNCTION blog.increment_comment_likes(integer, integer)  TO service_role;
GRANT EXECUTE ON FUNCTION blog.snapshot_post_version(integer)             TO service_role;
GRANT EXECUTE ON FUNCTION blog.update_post_atomic(integer, jsonb)         TO service_role;

-- Force PostgREST to refresh its schema cache so the new RPCs are exposed.
NOTIFY pgrst, 'reload schema';
