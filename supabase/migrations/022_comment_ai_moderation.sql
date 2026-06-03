-- Migration 022: AI comment-moderation audit trail
--
-- Adds columns that record Gemini's automatic review of each incoming comment:
-- whether it was judged relevant (to data science / AI / analytics / courses /
-- the blog), the category it was binned into, and a one-line rationale. These
-- make the auto-approve + auto-reply pipeline auditable from the studio.
--
-- Relevant comments are auto-approved and receive a brand reply; non-relevant
-- ones keep status='pending' and fall back to human moderation.

ALTER TABLE blog.comments
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_relevant    boolean,
  ADD COLUMN IF NOT EXISTS ai_category    text,
  ADD COLUMN IF NOT EXISTS ai_reason      text;

-- Refresh PostgREST schema cache so the new columns are selectable via the API.
NOTIFY pgrst, 'reload schema';
