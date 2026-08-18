const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, validatePost } = require('../server');

test('slugify creates clean URL paths', () => {
  assert.equal(slugify('  My First Café Post!  '), 'my-first-cafe-post');
});

test('validatePost fills safe defaults', () => {
  const post = validatePost({ title: 'A valid title', body: 'This is enough body content for a valid post.', publishedAt: '2026-08-18' });
  assert.equal(post.slug, 'a-valid-title');
  assert.equal(post.status, 'published');
  assert.equal(post.category, 'Journal');
  assert.ok(post.readTime >= 1);
});

test('validatePost rejects incomplete content', () => {
  assert.throws(() => validatePost({ title: 'No', body: 'short' }), /Title must/);
});
