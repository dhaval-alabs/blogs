/**
 * Clean leftover WordPress raw HTML in migrated MDX posts.
 *
 * The WP→MDX migration left ~237 raw <table> blocks across ~69 posts that
 * Turndown could not convert (no <th> header rows; code stored as 1-cell
 * tables with <br> + colored <span>s). They render as cramped, unstyled HTML
 * boxes instead of proper code blocks / Markdown tables — the "half-written
 * HTML" reported on the blog.
 *
 * This converts, in the body only (frontmatter untouched):
 *   • 1-column code tables (have <br>/color/code chars) → fenced code blocks
 *     (language auto-detected: python / r / sql)
 *   • 1-cell prose boxes                                → blockquotes
 *   • multi-column tables                               → GFM Markdown tables
 *     (links, bold, italics inside cells preserved; junk attributes dropped)
 *
 * <iframe> embeds and all other content are left as-is.
 *
 * Usage:
 *   node scripts/clean-wp-html.mjs            # rewrite files in place
 *   node scripts/clean-wp-html.mjs --dry-run  # report only, no writes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'content', 'blog');
const DRY = process.argv.includes('--dry-run');

const decodeText = (html) => cheerio.load(`<x>${html}</x>`)('x').text().replace(/ /g, ' ');

function detectLang(code) {
  if (/(^|\n)\s*(import |from\s+\w+\s+import|def |class \w+|print\(|pd\.|np\.|plt\.|df[\[.]|sklearn|tensorflow|keras)/.test(code)) return 'python';
  if (/<-|library\(|\bc\(|ls\(\)|data\.frame|print\(paste|install\.packages|<<-/.test(code)) return 'r';
  if (/\b(SELECT|FROM|WHERE|INSERT INTO|UPDATE\s|CREATE TABLE|GROUP BY|ORDER BY|INNER JOIN|LEFT JOIN)\b/i.test(code)) return 'sql';
  return '';
}

function cellToCode(innerHtml) {
  const h = innerHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '');
  return decodeText(h).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

// Inline Markdown for a table cell: preserve links / bold / italics / code, drop the rest.
function cellToInline(innerHtml) {
  let h = innerHtml
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => `[${decodeText(txt).trim()}](${href})`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${decodeText(t).trim()}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${decodeText(t).trim()}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${decodeText(t).trim()}\``);
  // strip any remaining tags, then decode
  const text = decodeText(h.replace(/<[^>]+>/g, ''));
  return text.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function convertTable(tableHtml) {
  const $ = cheerio.load(tableHtml, null, false);
  const rows = [];
  $('tr').each((_, tr) => {
    const cells = [];
    $(tr).find('td,th').each((__, td) => cells.push($(td).html() ?? ''));
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) return '';

  const ncol = Math.max(...rows.map((r) => r.length));
  const rawText = decodeText(tableHtml);
  const looksCode = /<br/i.test(tableHtml) || /color:\s*#/i.test(tableHtml) ||
    /[{}();=]|#\s|\bimport\b|\bdef\b|<-|>>/.test(rawText);

  if (ncol === 1) {
    const cellHtml = rows.map((r) => r[0]).join('<br>');
    if (looksCode) {
      const code = cellToCode(cellHtml);
      return `\n\`\`\`${detectLang(code)}\n${code}\n\`\`\`\n`;
    }
    return `\n> ${cellToInline(cellHtml)}\n`;
  }

  const norm = rows.map((r) => {
    const c = r.map(cellToInline);
    while (c.length < ncol) c.push('');
    return c;
  });
  const header = norm[0];
  let md = '\n| ' + header.join(' | ') + ' |\n';
  md += '| ' + header.map(() => '---').join(' | ') + ' |\n';
  for (let i = 1; i < norm.length; i++) md += '| ' + norm[i].join(' | ') + ' |\n';
  return md + '\n';
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mdx'));
let changed = 0, tablesConverted = 0, code = 0, tables = 0, quotes = 0;
const report = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
  // Split off the frontmatter block byte-for-byte; only the body is touched.
  const split = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);
  if (!split) continue;
  const fm = split[1];
  const body = split[2];
  if (!/<table[\s\S]*?<\/table>/i.test(body)) continue;

  let n = 0;
  const newBody = body.replace(/<table[\s\S]*?<\/table>/gi, (t) => {
    const out = convertTable(t);
    if (!out) return t;
    n++;
    if (out.includes('```')) code++; else if (out.startsWith('\n>')) quotes++; else tables++;
    return out;
  }).replace(/\n{3,}/g, '\n\n');

  if (newBody !== body) {
    changed++; tablesConverted += n;
    report.push(`${n}\t${f}`);
    if (!DRY) fs.writeFileSync(path.join(DIR, f), fm + newBody);
  }
}

console.log((DRY ? '[DRY RUN] ' : '') + `Files changed: ${changed} | tables converted: ${tablesConverted} (code blocks: ${code}, md tables: ${tables}, blockquotes: ${quotes})`);
console.log('\ncount\tfile');
console.log(report.sort((a, b) => parseInt(b) - parseInt(a)).join('\n'));
