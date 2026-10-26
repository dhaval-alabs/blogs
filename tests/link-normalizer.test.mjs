// Run with: npm test   (node --test, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeInternalHref as n,
  normalizeArticleHtml,
  buildRedirectLookup,
} from '../src/lib/domain/posts/link-normalizer.js';

const O = 'https://www.analytixlabs.co.in';

test('adds a trailing slash to internal paths', () => {
  assert.equal(n('/blog/generative-ai-learning-path'), '/blog/generative-ai-learning-path/');
  assert.equal(n(`${O}/data-science-specialization-course`), `${O}/data-science-specialization-course/`);
  assert.equal(n('/blog/already-fine/'), '/blog/already-fine/');
});

test('preserves query string and hash exactly', () => {
  assert.equal(n('/blog/x?utm_source=a&utm_medium=b'), '/blog/x/?utm_source=a&utm_medium=b');
  assert.equal(n('/blog/x#section-2'), '/blog/x/#section-2');
  assert.equal(n(`${O}/blog/x?utm_source=a#top`), `${O}/blog/x/?utm_source=a#top`);
  assert.equal(n('/blog/x?a=1&amp;b=2'), '/blog/x/?a=1&amp;b=2');
});

test('leaves external and non-path links untouched', () => {
  for (const h of [
    'https://example.com/page',
    '//cdn.example.com/lib.js',
    'https://blog.analytixlabs.co.in/blog/x',
    'mailto:info@analytixlabs.co.in',
    'tel:+911234',
    '#faq',
    'relative/path',
    '',
  ]) assert.equal(n(h), h);
});

test('does not add a slash to files or infrastructure paths', () => {
  assert.equal(n('/files/guide.pdf'), '/files/guide.pdf');
  assert.equal(n(`${O}/wp-content/uploads/2024/08/a.jpg`), `${O}/wp-content/uploads/2024/08/a.jpg`);
  assert.equal(n('/wp-content/uploads/2024/08/a'), '/wp-content/uploads/2024/08/a');
  assert.equal(n('/cdn-cgi/l/email-protection'), '/cdn-cgi/l/email-protection');
  assert.equal(n('/api/posts'), '/api/posts');
});

test('forces https and canonical host', () => {
  assert.equal(n('http://www.analytixlabs.co.in/'), `${O}/`);
  assert.equal(n('http://www.analytixlabs.co.in/blog/x/'), `${O}/blog/x/`);
  assert.equal(n('//www.analytixlabs.co.in/blog/x'), `${O}/blog/x/`);
  assert.equal(n('https://analytixlabs.co.in/blog/x/'), `${O}/blog/x/`);
  assert.equal(n('https://www.analytixlabs.co.in'), `${O}/`);
});

test('collapses doubled slashes in the path', () => {
  assert.equal(n(`${O}//blog/what-is-data-science/`), `${O}/blog/what-is-data-science/`);
  assert.equal(n('/blog//x'), '/blog/x/');
});

test('resolves known redirects with or without a trailing slash', () => {
  assert.equal(n('/pg-in-data-science'), '/data-science-specialization-course/');
  assert.equal(n('/pg-in-data-science/'), '/data-science-specialization-course/');
  assert.equal(n(`${O}/blog/data-warehouse`), `${O}/blog/what-is-data-warehouse/`);
  assert.equal(n(`http://www.analytixlabs.co.in/blog/data-warehouse/?utm_source=x`), `${O}/blog/what-is-data-warehouse/?utm_source=x`);
  assert.equal(n('/blog/factor-analysis-vs-pca/'), '/blog/pca-vs-factor-analysis/');
});

test('held URLs get the trailing-slash rule only', () => {
  assert.equal(n('/data-science-r-analytics-training'), '/data-science-r-analytics-training/');
  assert.equal(n('/agentic-ai-course'), '/agentic-ai-course/');
});

test('table rows are used, static map wins, chains and odd destinations are handled', () => {
  const lookup = buildRedirectLookup({
    '/blog/old-a': '/blog/old-b/',
    '/blog/old-b': '/blog/final/',
    '/blog/data-warehouse/': '/blog/somewhere-else/',
    '/blog/no-slash-dest': 'blog/fixed-dest/',
    '/blog/elsewhere': 'https://example.com/x',
    '/blog/own-abs': 'https://blog.analytixlabs.co.in/blog/ai-applications',
  });
  assert.equal(n('/blog/old-a', lookup), '/blog/final/');
  assert.equal(n('/blog/data-warehouse', lookup), '/blog/what-is-data-warehouse/');
  assert.equal(n('/blog/no-slash-dest', lookup), '/blog/fixed-dest/');
  assert.equal(n('/blog/elsewhere?q=1', lookup), 'https://example.com/x?q=1');
  assert.equal(n('/blog/own-abs', lookup), 'https://blog.analytixlabs.co.in/blog/ai-applications');
});

test('a redirect loop in table rows cannot hang', () => {
  const lookup = buildRedirectLookup({ '/blog/loop-a': '/blog/loop-b/', '/blog/loop-b': '/blog/loop-a/' });
  assert.match(n('/blog/loop-a', lookup), /^\/blog\/loop-[ab]\/$/);
});

test('HTML: only <a href> changes; src, srcset and text are untouched', () => {
  const html =
    '<p>See <a href="/blog/data-warehouse" class="x">/blog/data-warehouse</a> and ' +
    "<a target='_blank' href='http://www.analytixlabs.co.in/pg-in-data-science'>course</a>.</p>" +
    '<img src="/blog/data-warehouse" srcset="/a 1x, /b 2x"><a href="https://example.com/y">ext</a>' +
    '<link href="/blog/data-warehouse">';
  const out = normalizeArticleHtml(html);
  assert.equal(
    out,
    '<p>See <a href="/blog/what-is-data-warehouse/" class="x">/blog/data-warehouse</a> and ' +
      `<a target='_blank' href='${O}/data-science-specialization-course/'>course</a>.</p>` +
      '<img src="/blog/data-warehouse" srcset="/a 1x, /b 2x"><a href="https://example.com/y">ext</a>' +
      '<link href="/blog/data-warehouse">'
  );
});

test('HTML: in-body <h1> becomes <h2>, other headings untouched', () => {
  assert.equal(
    normalizeArticleHtml('<h1 id="intro">Introduction</h1><h2>A</h2><H1>FAQs:</H1><h3>B</h3>'),
    '<h2 id="intro">Introduction</h2><h2>A</h2><h2>FAQs:</h2><h3>B</h3>'
  );
});

test('HTML: non-strings and empty content pass through', () => {
  assert.equal(normalizeArticleHtml(''), '');
  assert.equal(normalizeArticleHtml(undefined), undefined);
});
