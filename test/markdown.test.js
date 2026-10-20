const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {}, URL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared.js'), 'utf8'), context);
const { renderMarkdown, imageSource } = context.window.blogUtils;

test('bundled logo renders as an accessible image', () => {
  const html = renderMarkdown('![t² logo](/images/t2-logo.png)');
  assert.match(html, /<img src="\/images\/t2-logo.png" alt="t² logo"/);
  assert.match(html, /loading="lazy"/);
  const bytes = fs.readFileSync(path.join(__dirname, '../public/images/t2-logo.png'));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
});

test('remote image URLs preserve query strings and parentheses', () => {
  assert.match(renderMarkdown('![Photo](https://example.com/a_(1).png?w=400&h=400)'), /src="https:\/\/example.com\/a_\(1\).png\?w=400&amp;h=400"/);
});

test('image descriptions cannot inject HTML or formatting into attributes', () => {
  const html = renderMarkdown('![" onerror="alert(1) <script> **bold**](/images/t2-logo.png)');
  assert.match(html, /alt="&quot; onerror=&quot;alert\(1\) &lt;script&gt; \*\*bold\*\*"/);
  assert.doesNotMatch(html, /<script>|<strong>/);
});

test('unsafe image sources are rejected', () => {
  for (const source of ['javascript:alert(1)', 'data:image/svg+xml,abc', '//example.com/a.png', '/\\example.com/a.png', 'file:///a.png', 'https://example.com/a.png"onerror="bad', 'https://example.com/a\nb.png']) {
    assert.equal(imageSource(source), null, source);
    assert.doesNotMatch(renderMarkdown(`![Image](${source})`), /<img/);
  }
});

test('image blocks close lists and preserve subsequent content', () => {
  const html = renderMarkdown('- First\n![Logo](/images/t2-logo.png)\n## Next\nText');
  assert.match(html, /<\/ul><figure/);
  assert.match(html, /<\/figure><h2>Next<\/h2><p>Text<\/p>/);
});

test('existing Markdown and HTML escaping still work', () => {
  const html = renderMarkdown('## Title\n**bold** *em* `code` [Link](https://example.com)\n> Quote\n- Item\n<script>alert(1)</script>');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/example.com"/);
  assert.match(html, /<blockquote>Quote<\/blockquote>/);
  assert.doesNotMatch(html, /<script>/);
});
