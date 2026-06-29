/**
 * Generate plain SQL to import the WordPress-migrated MDX posts into the
 * Supabase `blog.posts` table — an alternative to import-mdx-to-supabase.mjs
 * for people who'd rather paste SQL into the Supabase SQL editor.
 *
 * Converts each content/blog/*.mdx (already cleaned) to HTML with the same
 * remark pipeline the app uses, then emits batched
 *   INSERT INTO blog.posts (...) VALUES (...) ON CONFLICT (slug) DO UPDATE ...
 * files under scripts/sql/. Re-running the SQL is safe (upsert by slug); it
 * refreshes content + dates for existing posts.
 *
 * Usage:  node scripts/generate-import-sql.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const OUT_DIR = path.join(__dirname, 'sql');
const BATCH = 50; // posts per .sql file (keeps each paste-able in the SQL editor)

const markdownToHtml = async (md) =>
  (await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(md)).toString();

function toISO(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Mirror of the read-time model used elsewhere in the app.
function calcReadTime(html) {
  if (!html) return '';
  let s = html;
  const code = (s.match(/<pre[\s>][\s\S]*?<\/pre>/gi) || []).length;
  s = s.replace(/<pre[\s>][\s\S]*?<\/pre>/gi, ' ').replace(/<code[\s>][\s\S]*?<\/code>/gi, ' ');
  const imgs = (s.match(/<img\b[^>]*>/gi) || []).length;
  const iframes = (s.match(/<iframe\b[\s\S]*?<\/iframe>/gi) || []).length;
  s = s.replace(/<img\b[^>]*>/gi, ' ').replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ')
       .replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const words = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  let imgSecs = 0; for (let i = 0; i < imgs; i++) imgSecs += Math.max(3, 12 - i);
  const mins = words / 238 + (code * 30 + iframes * 30 + imgSecs) / 60;
  return mins > 0 ? `${Math.max(1, Math.round(mins))} min read` : '';
}

// ── SQL literal helpers ─────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const tsz = (v) => (v ? `${q(v)}::timestamptz` : 'NULL');
const arr = (a) => (a && a.length ? `ARRAY[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const jsonb = (o) => `${q(JSON.stringify(o))}::jsonb`;

async function mdxToValues({ data, content }) {
  const html = await markdownToHtml(content);
  const cats = Array.isArray(data.categories) ? data.categories : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const slug = data.slug || (data.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return [
    q(data.title || 'Untitled'),
    q(slug),
    q(data.description || ''),
    q(html),
    q(cats[0] || 'Data Science'),
    arr(cats),
    q('Beginner'),
    q(calcReadTime(html)),
    q('al-editorial'),
    q(data.featuredImage || ''),
    q(data.title ? data.title.slice(0, 150) : ''),
    q('Published'),
    tsz(toISO(data.date)),
    tsz(toISO(data.modified || data.date)),
    jsonb({ canonicalUrl: data.canonical || '', noIndex: data.noindex === true, metaTitle: data.title || '', metaDesc: data.description || '' }),
    `'{}'::text[]`,           // course_mappings
    q(''),                    // course_cta
    jsonb({}),                // newsletter
    jsonb({}),                // quiz
    jsonb({ entityTags: [...cats, ...tags].filter(Boolean), enabled: true }), // ai_hints
    jsonb({}),                // trust
    jsonb({ qa: true, faqSchema: true, moderation: 'auto' }),                 // discussion
    jsonb({ showLeadGen: false, showNextSteps: false, showCourseCta: false, showRightSidebar: true }), // advanced
  ];
}

const COLS = ['title','slug','excerpt','content','category','domain_tags','skill_level','read_time','author_id','image','alt_text','status','published_at','updated_at','seo','course_mappings','course_cta','newsletter','quiz','ai_hints','trust','discussion','advanced'];
// On conflict, refresh content/metadata/dates but keep id/created_at.
const UPDATE_COLS = ['title','excerpt','content','category','domain_tags','read_time','image','alt_text','status','published_at','updated_at','seo','ai_hints','discussion','advanced'];

const AUTHOR_SQL = `-- Ensure the author referenced by these posts exists (satisfies the FK).
INSERT INTO blog.authors (slug, name, initials, color, bio)
VALUES ('al-editorial', 'AL Labs Editorial', 'AL', 'bg-primary', 'AnalytixLabs editorial team.')
ON CONFLICT (slug) DO NOTHING;
`;

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx')).sort();
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.sql')).forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));

const rows = [];
for (const f of files) {
  const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
  rows.push(await mdxToValues({ data, content }));
}

const onConflict = `ON CONFLICT (slug) DO UPDATE SET\n  ` +
  UPDATE_COLS.map((c) => `${c} = EXCLUDED.${c}`).join(',\n  ') + ';';

let fileNo = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  fileNo++;
  const batch = rows.slice(i, i + BATCH);
  let sql = `-- AnalytixLabs blog: import MDX posts ${i + 1}–${i + batch.length} of ${rows.length}\n`;
  sql += `-- Run in the Supabase SQL editor. Safe to re-run (upsert by slug).\n\n`;
  if (fileNo === 1) sql += AUTHOR_SQL + '\n';
  sql += `INSERT INTO blog.posts (${COLS.join(', ')}) VALUES\n`;
  sql += batch.map((vals) => `(${vals.join(', ')})`).join(',\n');
  sql += '\n' + onConflict + '\n';
  const name = `import-posts-${String(fileNo).padStart(3, '0')}.sql`;
  fs.writeFileSync(path.join(OUT_DIR, name), sql);
}

const total = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.sql'));
console.log(`Wrote ${total.length} SQL file(s) for ${rows.length} posts → ${path.relative(ROOT, OUT_DIR)}/`);
total.sort().forEach((f) => {
  const kb = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
  console.log(`  ${f}  (${kb} KB)`);
});
