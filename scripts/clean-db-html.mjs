/**
 * Clean leftover WordPress / pasted raw HTML directly in the Supabase
 * `blog.posts` table — for posts whose content lives only in the DB (studio
 * posts with no clean MDX source). Converts messy <table> blocks to clean
 * tables / code blocks (same output as the MDX cleaner) and unwraps styled
 * <span>s, dropping junk attributes. Only `content` + `read_time` are changed.
 *
 * Connection: reads DIRECT_URL (preferred) or DATABASE_URL from the environment
 * or .env.local — e.g.
 *   DIRECT_URL="postgresql://postgres.<ref>:<pw>@<host>:5432/postgres"
 *
 * Usage:
 *   node scripts/clean-db-html.mjs            # dry run — report only
 *   node scripts/clean-db-html.mjs --apply    # write changes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as cheerio from 'cheerio';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// ── connection string from env or .env.local ───────────────────────
function loadEnv() {
  const f = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*(\w+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();
const CONN = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN) { console.error('Set DIRECT_URL or DATABASE_URL (env or .env.local).'); process.exit(1); }

const md2html = async (md) => (await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(md)).toString();
const decodeText = (h) => cheerio.load(`<x>${h}</x>`)('x').text().replace(/ /g, ' ');

function detectLang(code) {
  if (/(^|\n)\s*(import |from\s+\w+\s+import|def |class \w+|print\(|pd\.|np\.|plt\.|df[\[.])/.test(code)) return 'python';
  if (/<-|library\(|\bc\(|ls\(\)|data\.frame/.test(code)) return 'r';
  if (/\b(SELECT|FROM|WHERE|INSERT INTO|UPDATE\s|CREATE TABLE|GROUP BY)\b/i.test(code)) return 'sql';
  return '';
}
function cellToCode(h) { h = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '').replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, ''); return decodeText(h).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, ''); }
function cellToInline(h) {
  h = h.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>\s*<p[^>]*>/gi, ' ').replace(/<\/?p[^>]*>/gi, ' ')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, u, t) => `[${decodeText(t).trim()}](${u})`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${decodeText(t).trim()}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${decodeText(t).trim()}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${decodeText(t).trim()}\``);
  return decodeText(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}
function convertTable(th) {
  const $ = cheerio.load(th, null, false);
  const rows = [];
  $('tr').each((_, tr) => { const c = []; $(tr).find('td,th').each((__, td) => c.push($(td).html() ?? '')); if (c.length) rows.push(c); });
  if (!rows.length) return '';
  const ncol = Math.max(...rows.map((r) => r.length));
  const raw = decodeText(th);
  const looksCode = /<br/i.test(th) || /color:\s*#/i.test(th) || /[{}();=]|#\s|\bimport\b|\bdef\b|<-|>>/.test(raw);
  if (ncol === 1) { const cell = rows.map((r) => r[0]).join('<br>'); return looksCode ? `\n\`\`\`${detectLang(cellToCode(cell))}\n${cellToCode(cell)}\n\`\`\`\n` : `\n> ${cellToInline(cell)}\n`; }
  const norm = rows.map((r) => { const c = r.map(cellToInline); while (c.length < ncol) c.push(''); return c; });
  let md = '\n| ' + norm[0].join(' | ') + ' |\n| ' + norm[0].map(() => '---').join(' | ') + ' |\n';
  for (let i = 1; i < norm.length; i++) md += '| ' + norm[i].join(' | ') + ' |\n';
  return md + '\n';
}
function calcReadTime(html) {
  if (!html) return '';
  let s = html; const code = (s.match(/<pre[\s>][\s\S]*?<\/pre>/gi) || []).length;
  s = s.replace(/<pre[\s>][\s\S]*?<\/pre>/gi, ' ').replace(/<code[\s>][\s\S]*?<\/code>/gi, ' ');
  const imgs = (s.match(/<img\b[^>]*>/gi) || []).length, ifr = (s.match(/<iframe\b[\s\S]*?<\/iframe>/gi) || []).length;
  s = s.replace(/<img\b[^>]*>/gi, ' ').replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ').replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ');
  const w = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  let im = 0; for (let i = 0; i < imgs; i++) im += Math.max(3, 12 - i);
  const m = w / 238 + (code * 30 + ifr * 30 + im) / 60;
  return m > 0 ? `${Math.max(1, Math.round(m))} min read` : '';
}
async function cleanHtml(html) {
  const $ = cheerio.load(html, null, false);
  const tables = $('table').toArray();
  const frags = await Promise.all(tables.map(async (el) => { const md = convertTable($.html(el)); return md ? await md2html(md) : $.html(el); }));
  tables.forEach((el, i) => $(el).replaceWith(frags[i]));
  for (let p = 0; p < 10 && $('span[style]').length; p++) $('span[style]').each((_, el) => $(el).replaceWith($(el).contents()));
  $('[style]').removeAttr('style'); $('[data-sheets-value]').removeAttr('data-sheets-value'); $('[class]').removeAttr('class');
  return $.html();
}

const MESSY = `content ~ '<table[ ][^>]' OR content LIKE '%<span style=%' OR content LIKE '%data-sheets-value%'`;
const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(`SELECT slug, content FROM blog.posts WHERE ${MESSY}`);
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${rows.length} posts with messy HTML\n`);
let updated = 0;
for (const r of rows) {
  const cleaned = await cleanHtml(r.content);
  if (cleaned === r.content) continue;
  console.log(`  ${r.slug}`);
  if (APPLY) { await client.query('UPDATE blog.posts SET content=$1, read_time=$2 WHERE slug=$3', [cleaned, calcReadTime(cleaned), r.slug]); updated++; }
}
console.log(APPLY ? `\nUpdated ${updated} rows.` : `\n(dry run — re-run with --apply to write)`);
await client.end();
