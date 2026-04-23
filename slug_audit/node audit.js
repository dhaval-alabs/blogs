// audit.js — slug parity reconciliation
// Resolves redirect chains, applies pattern rules, matches against Next.js slug set,
// and outputs an action plan CSV.

const fs = require('fs');

// ---------- Config ----------

const INPUTS = {
    gsc: 'gsc_blog_urls.csv',
    posts: 'supabase_posts.csv',
    categories: 'supabase_categories.csv',
    authors: 'supabase_authors.csv',
    mdx: 'mdx_slugs.txt',
    yoast: 'yoast_blog_redirects.csv',
};

const OUTPUT = 'slug_parity_audit.csv';

// Traffic-based action thresholds (clicks in last 12 months)
const TRAFFIC_HIGH = 30;
const TRAFFIC_MEDIUM = 5;

// ---------- Helpers ----------

const norm = (url) => {
    if (!url) return '';
    url = url.replace(/^https?:\/\/[^/]+/, '');      // strip domain
    if (!url.startsWith('/')) url = '/' + url;        // leading slash
    url = url.toLowerCase();                          // lowercase for matching
    url = url.split('?')[0];                          // strip query string
    if (!url.endsWith('/') && !url.includes('.')) url += '/';  // trailing slash
    return url;
};

const extractSlug = (url) => {
    // /blog/foo/ → foo        /blog/category/foo/ → category/foo
    const m = url.match(/^\/blog\/(.+?)\/?$/);
    return m ? m[1] : null;
};

// Apply Cloudflare Redirect Rules (R1–R8) so our resolver sees what the user actually hits.
const applyPatternRules = (url) => {
    let u = url;
    u = u.replace(/^\/blog\/\d{4}\/\d{2}\/\d{2}\/(.+?)\/?$/, '/blog/$1/');   // R2 date URLs
    u = u.replace(/^\/blog\/blog\/(.+?)\/?$/, '/blog/$1/');                   // R6 double prefix
    u = u.replace(/^\/blog\/(.+?)\/page\/\d+\/?$/, '/blog/$1/');              // R3 pagination
    u = u.replace(/^\/blog\/(.+?)\/feed\/?$/, '/blog/$1/');                   // R7 feed
    u = u.replace(/^\/blog\/(.+?)\/amp\/?$/, '/blog/$1/');                    // R8 amp
    u = u.replace(/^\/blog\/(.+?)\/?\/1000\/?$/, '/blog/$1/');                // R4 double slash
    u = u.replace(/^\/blog\/(.+?)\/1000\/?$/, '/blog/$1/');                   // R5 single slash
    u = u.replace(/^\/blog\/(.+?)\/%3c.*$/, '/blog/$1/');                     // R1 PHP leak
    return u;
};

// Follow Yoast redirect chain until we hit a non-redirected URL (or loop).
const resolveYoastChain = (url, yoastMap, depth = 0) => {
    if (depth > 10) return { final: url, hops: depth, looped: true };
    const target = yoastMap.get(url);
    if (!target) return { final: url, hops: depth, looped: false };
    return resolveYoastChain(norm(target), yoastMap, depth + 1);
};

const parseCSV = (content, delimiter = ',') => {
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
        // Simple quoted-value parser
        const values = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === delimiter && !inQuotes) {
                values.push(current);
                current = '';
            } else current += char;
        }
        values.push(current);
        return Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').replace(/^"|"$/g, '').trim()]));
    });
};

// ---------- Load data ----------

console.log('Loading inputs...');

const gscRows = parseCSV(fs.readFileSync(INPUTS.gsc, 'utf8'));
const postRows = parseCSV(fs.readFileSync(INPUTS.posts, 'utf8'));
const categoryRows = parseCSV(fs.readFileSync(INPUTS.categories, 'utf8'));
const authorRows = parseCSV(fs.readFileSync(INPUTS.authors, 'utf8'));
const mdxSlugs = fs.readFileSync(INPUTS.mdx, 'utf8').trim().split(/\r?\n/).filter(Boolean);
const yoastRows = parseCSV(fs.readFileSync(INPUTS.yoast, 'utf8'));

// Build lookup sets
const nextjsPostSlugs = new Set([
    ...postRows.map((r) => r.slug?.toLowerCase()).filter(Boolean),
    ...mdxSlugs.map((s) => s.toLowerCase()),
]);
const nextjsCategorySlugs = new Set(
    categoryRows.map((r) => r.category_slug?.toLowerCase()).filter(Boolean)
);
const nextjsAuthorSlugs = new Set(authorRows.map((r) => r.slug?.toLowerCase()).filter(Boolean));

const yoastMap = new Map();
for (const row of yoastRows) {
    const origin = norm(row['Origin URL'] || row.origin || row.source);
    const target = norm(row['Target URL'] || row.target || row.destination);
    if (origin && target && origin !== target) yoastMap.set(origin, target);
}

console.log(`GSC URLs:                    ${gscRows.length}`);
console.log(`Next.js post slugs:          ${nextjsPostSlugs.size} (DB + MDX)`);
console.log(`Next.js category slugs:      ${nextjsCategorySlugs.size}`);
console.log(`Next.js author slugs:        ${nextjsAuthorSlugs.size}`);
console.log(`Yoast redirect entries:      ${yoastMap.size}`);

// ---------- Classify ----------

const results = [];

for (const row of gscRows) {
    const originalUrl = row['Top pages'] || row.URL || row.page || '';
    if (!originalUrl || !originalUrl.includes('/blog/')) continue;

    const clicks = parseInt(row.Clicks || '0', 10) || 0;
    const impressions = parseInt(row.Impressions || '0', 10) || 0;

    const normalized = norm(originalUrl);
    const afterPatternRules = applyPatternRules(normalized);
    const { final, hops, looped } = resolveYoastChain(afterPatternRules, yoastMap);

    const matchSlug = extractSlug(final);
    const notes = [];
    if (looped) notes.push('yoast_redirect_loop');

    let kind = 'post';
    let exists = false;
    let action = 'MANUAL';

    if (final === '/blog/' || final === '/blog') {
        kind = 'blog_index';
        exists = true;
        action = 'OK';
    } else if (matchSlug && matchSlug.startsWith('category/')) {
        kind = 'category';
        const catSlug = matchSlug.replace(/^category\//, '').replace(/\/$/, '');
        exists = nextjsCategorySlugs.has(catSlug);
        action = exists ? 'OK' : 'REDIRECT';
        if (!exists) notes.push(`no_matching_category:${catSlug}`);
    } else if (matchSlug && matchSlug.startsWith('author/')) {
        kind = 'author';
        const authSlug = matchSlug.replace(/^author\//, '').replace(/\/$/, '');
        exists = nextjsAuthorSlugs.has(authSlug);
        action = exists ? 'OK' : 'REDIRECT';
        if (!exists) notes.push(`no_matching_author:${authSlug}`);
    } else if (matchSlug && matchSlug.startsWith('tag/')) {
        kind = 'tag';
        action = 'GONE'; // existing policy: tag pages are noindex
        notes.push('tag_page_policy_noindex');
    } else if (matchSlug) {
        kind = 'post';
        exists = nextjsPostSlugs.has(matchSlug.replace(/\/$/, ''));
        action = exists ? 'OK' : 'REDIRECT';
        if (!exists) notes.push('slug_not_in_nextjs');
    } else {
        kind = 'unknown';
        notes.push('could_not_classify');
    }

    // Priority by traffic
    let priority = 'LOW';
    if (clicks >= TRAFFIC_HIGH) priority = 'HIGH';
    else if (clicks >= TRAFFIC_MEDIUM) priority = 'MEDIUM';

    // Zero-traffic, low-impression misses become GONE instead of REDIRECT
    if (action === 'REDIRECT' && clicks === 0 && impressions < 10) {
        action = 'GONE';
        notes.push('zero_traffic_low_impressions');
    }

    results.push({
        original_url: originalUrl,
        normalized,
        after_cf_rules: afterPatternRules,
        resolved_yoast: final,
        yoast_hops: hops,
        kind,
        slug: matchSlug || '',
        exists_in_nextjs: exists,
        clicks,
        impressions,
        priority,
        action,
        recommended_target: action === 'OK' ? final : '',
        notes: notes.join('; '),
    });
}

// ---------- Output ----------

const headers = Object.keys(results[0]);
const csv = [
    headers.join(','),
    ...results.map((r) =>
        headers
            .map((h) => {
                const v = String(r[h] ?? '');
                return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
            })
            .join(',')
    ),
].join('\n');

fs.writeFileSync(OUTPUT, csv, 'utf8');

// Summary
const summary = {
    total: results.length,
    ok: results.filter((r) => r.action === 'OK').length,
    redirect_needed: results.filter((r) => r.action === 'REDIRECT').length,
    gone: results.filter((r) => r.action === 'GONE').length,
    manual_review: results.filter((r) => r.action === 'MANUAL').length,
    high_priority_gaps: results.filter((r) => r.action !== 'OK' && r.priority === 'HIGH').length,
    medium_priority_gaps: results.filter((r) => r.action !== 'OK' && r.priority === 'MEDIUM').length,
    total_clicks: results.reduce((s, r) => s + r.clicks, 0),
    covered_clicks: results.filter((r) => r.action === 'OK').reduce((s, r) => s + r.clicks, 0),
};
summary.coverage_pct = ((summary.covered_clicks / summary.total_clicks) * 100).toFixed(1) + '%';

console.log('\n=== SUMMARY ===');
console.table(summary);
console.log(`\nFull audit written to: ${OUTPUT}`);
console.log('\nNext: open the CSV in a spreadsheet, sort by priority + clicks desc,');
console.log('      fill in `recommended_target` for every REDIRECT row.');