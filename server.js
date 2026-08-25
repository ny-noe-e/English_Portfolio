const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || (process.env.VERCEL ? '' : 'portfolio');
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const BLOB_PATH = 'field-notes/posts.json';
const MAX_BODY = 1_000_000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function send(res, status, payload, contentType = 'application/json; charset=utf-8') {
  const body = contentType.startsWith('application/json') ? JSON.stringify(payload) : payload;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(body);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80);
}

function validatePost(input, existing = {}) {
  const title = String(input.title ?? existing.title ?? '').trim().slice(0, 120);
  const body = String(input.body ?? existing.body ?? '').trim().slice(0, 50000);
  if (title.length < 3) throw new Error('Title must be at least 3 characters.');
  if (body.length < 20) throw new Error('Post content must be at least 20 characters.');

  return {
    ...existing,
    title,
    slug: slugify(input.slug || title) || crypto.randomUUID(),
    excerpt: String(input.excerpt ?? existing.excerpt ?? body.replace(/[#*_>`\[\]]/g, '')).trim().slice(0, 220),
    body,
    category: String(input.category ?? existing.category ?? 'Journal').trim().slice(0, 40) || 'Journal',
    readTime: Math.max(1, Math.min(60, Number(input.readTime ?? existing.readTime) || Math.ceil(body.split(/\s+/).length / 220))),
    publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(input.publishedAt) ? input.publishedAt : (existing.publishedAt || new Date().toISOString().slice(0, 10)),
    status: input.status === 'draft' ? 'draft' : 'published',
    featured: Boolean(input.featured),
    updatedAt: new Date().toISOString()
  };
}

function blobStorageAvailable() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

async function readLocalPosts() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readPosts() {
  if (!blobStorageAvailable()) return readLocalPosts();

  const { get } = await import('@vercel/blob');
  const result = await get(BLOB_PATH, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return readLocalPosts();
  return JSON.parse(await new Response(result.stream).text());
}

async function writePosts(posts) {
  if (blobStorageAvailable()) {
    const { put } = await import('@vercel/blob');
    await put(BLOB_PATH, JSON.stringify(posts, null, 2), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60
    });
    return;
  }

  if (process.env.VERCEL) {
    throw new Error('Post storage is not configured. Connect a private Vercel Blob store to this project.');
  }

  const temp = `${DATA_FILE}.tmp`;
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(posts, null, 2));
  await fs.rename(temp, DATA_FILE);
}

function authorized(req) {
  return crypto.timingSafeEqual(
    Buffer.from(String(req.headers['x-admin-key'] || '').padEnd(128).slice(0, 128)),
    Buffer.from(String(ADMIN_KEY).padEnd(128).slice(0, 128))
  );
}

async function parseBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('Request body is too large.');
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw new Error('Invalid JSON request.'); }
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;
  const posts = await readPosts();

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!authorized(req)) return send(res, 401, { error: 'That studio key is not correct.' });
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/posts') {
    const includeDrafts = url.searchParams.get('all') === '1' && authorized(req);
    const visible = includeDrafts ? posts : posts.filter(post => post.status === 'published');
    return send(res, 200, visible.sort((a, b) => {
      const aCreated = a.createdAt || `${a.publishedAt}T00:00:00.000Z`;
      const bCreated = b.createdAt || `${b.publishedAt}T00:00:00.000Z`;
      return bCreated.localeCompare(aCreated);
    }));
  }

  if (req.method === 'GET' && id) {
    const post = posts.find(item => item.id === id || item.slug === id);
    if (!post || (post.status !== 'published' && !authorized(req))) return send(res, 404, { error: 'Post not found.' });
    return send(res, 200, post);
  }

  if (!authorized(req)) return send(res, 401, { error: 'Studio key required.' });

  if (req.method === 'POST' && url.pathname === '/api/posts') {
    const data = validatePost(await parseBody(req));
    const duplicate = posts.some(post => post.slug === data.slug);
    if (duplicate) data.slug = `${data.slug}-${Date.now().toString().slice(-5)}`;
    data.id = crypto.randomUUID();
    data.createdAt = data.updatedAt;
    if (data.featured) posts.forEach(post => { post.featured = false; });
    posts.push(data);
    await writePosts(posts);
    return send(res, 201, data);
  }

  const index = posts.findIndex(post => post.id === id);
  if (index < 0) return send(res, 404, { error: 'Post not found.' });

  if (req.method === 'PUT') {
    const data = validatePost(await parseBody(req), posts[index]);
    if (posts.some((post, i) => i !== index && post.slug === data.slug)) {
      return send(res, 409, { error: 'Another post already uses that URL.' });
    }
    if (data.featured) posts.forEach(post => { post.featured = false; });
    posts[index] = data;
    await writePosts(posts);
    return send(res, 200, data);
  }

  if (req.method === 'DELETE') {
    const [deleted] = posts.splice(index, 1);
    await writePosts(posts);
    return send(res, 200, deleted);
  }

  send(res, 405, { error: 'Method not allowed.' });
}

async function serveStatic(res, pathname) {
  const route = pathname === '/studio' ? '/studio.html' : pathname.startsWith('/posts/') ? '/index.html' : pathname;
  const relative = route === '/' ? 'index.html' : route.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, mimeTypes[path.extname(filePath)] || 'application/octet-stream');
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, 'Page not found', 'text/plain; charset=utf-8');
    throw error;
  }
}

const requestHandler = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    send(res, error.message?.includes('must be') || error.message?.includes('Invalid') ? 400 : 500, { error: error.message || 'Something went wrong.' });
  }
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Field Notes is running at http://localhost:${PORT}`);
    if (ADMIN_KEY === 'portfolio') console.log('Studio key: portfolio (set ADMIN_KEY to change it)');
  });
}

module.exports = { server, requestHandler, validatePost, slugify };
