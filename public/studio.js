const { escapeHtml, renderMarkdown, formatDate } = window.blogUtils;
const loginScreen = document.querySelector('#login-screen');
const studioShell = document.querySelector('#studio-shell');
const form = document.querySelector('#post-form');
let studioKey = sessionStorage.getItem('studioKey') || '';
let posts = [];
let activeId = null;
let previewOpen = false;

const field = id => document.querySelector(`#${id}`);
const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-key': studioKey });

function toast(message) {
  const element = field('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function today() { return new Date().toISOString().slice(0, 10); }

function resetForm() {
  activeId = null;
  form.reset();
  field('post-id').value = '';
  field('published-at').value = today();
  field('read-time').value = 3;
  field('editor-mode').textContent = 'New note';
  field('save-post').textContent = 'Publish note';
  field('delete-post').hidden = true;
  field('editor-error').textContent = '';
  renderPostList();
  updatePreview();
  field('title').focus();
}

function collectForm() {
  return {
    title: field('title').value,
    excerpt: field('excerpt').value,
    body: field('body').value,
    category: 'Journal',
    publishedAt: field('published-at').value,
    readTime: Number(field('read-time').value),
    featured: false,
    status: field('is-draft').checked ? 'draft' : 'published'
  };
}

function loadPost(post) {
  activeId = post.id;
  field('post-id').value = post.id;
  field('title').value = post.title;
  field('excerpt').value = post.excerpt;
  field('body').value = post.body;
  field('published-at').value = post.publishedAt;
  field('read-time').value = post.readTime;
  field('is-draft').checked = post.status === 'draft';
  field('editor-mode').textContent = `Editing · ${post.status}`;
  field('save-post').textContent = post.status === 'draft' ? 'Save draft' : 'Update note';
  field('delete-post').hidden = false;
  field('editor-error').textContent = '';
  renderPostList();
  updatePreview();
  window.scrollTo(0, 0);
}

function renderPostList() {
  field('post-count').textContent = posts.length;
  field('post-list').innerHTML = posts.map(post => `
    <button class="post-list-item ${post.id === activeId ? 'active' : ''}" data-id="${escapeHtml(post.id)}">
      <b>${escapeHtml(post.title)}</b><span><em>${formatDate(post.publishedAt)}</em>${post.status === 'draft' ? '<i>Draft</i>' : '<i>Published</i>'}</span>
    </button>`).join('') || '<p style="padding:10px;color:#84958b;font-size:11px">Your notes will appear here.</p>';
}

function updatePreview() {
  if (!previewOpen) return;
  const data = collectForm();
  field('preview-content').innerHTML = `<h1>${escapeHtml(data.title || 'Untitled note')}</h1><p class="preview-deck">${escapeHtml(data.excerpt || 'Your introduction will appear here.')}</p><div class="preview-body">${renderMarkdown(data.body || 'Start writing to see a live preview.')}</div>`;
}

async function refreshPosts(selectId) {
  posts = await request('/api/posts?all=1');
  renderPostList();
  if (selectId) {
    const selected = posts.find(post => post.id === selectId);
    if (selected) loadPost(selected);
  }
}

async function unlock(key) {
  studioKey = key;
  await request('/api/login', { method: 'POST' });
  sessionStorage.setItem('studioKey', studioKey);
  loginScreen.hidden = true;
  studioShell.hidden = false;
  await refreshPosts();
  resetForm();
}

field('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  field('login-error').textContent = '';
  try { await unlock(field('studio-key').value); }
  catch (error) { field('login-error').textContent = error.message; studioKey = ''; }
});

field('new-post').addEventListener('click', resetForm);
field('post-list').addEventListener('click', event => {
  const button = event.target.closest('[data-id]');
  if (button) loadPost(posts.find(post => post.id === button.dataset.id));
});
field('toggle-preview').addEventListener('click', () => {
  previewOpen = !previewOpen;
  field('preview-pane').hidden = !previewOpen;
  document.querySelector('.editor-layout').classList.toggle('previewing', previewOpen);
  field('toggle-preview').textContent = previewOpen ? 'Close preview' : 'Preview';
  updatePreview();
});
form.addEventListener('input', () => { field('save-state').textContent = 'Unsaved changes'; updatePreview(); });

field('save-post').addEventListener('click', async () => {
  if (!form.reportValidity()) return;
  field('editor-error').textContent = '';
  const button = field('save-post');
  button.disabled = true;
  try {
    const data = collectForm();
    const wasEditing = Boolean(activeId);
    const saved = await request(activeId ? `/api/posts/${activeId}` : '/api/posts', { method: activeId ? 'PUT' : 'POST', body: JSON.stringify(data) });
    await refreshPosts(saved.id);
    field('save-state').textContent = 'Saved just now';
    toast(saved.status === 'draft' ? 'Draft saved' : wasEditing ? 'Note updated' : 'Note published');
  } catch (error) { field('editor-error').textContent = error.message; }
  finally { button.disabled = false; }
});

field('delete-post').addEventListener('click', async () => {
  const post = posts.find(item => item.id === activeId);
  if (!post || !confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
  try { await request(`/api/posts/${activeId}`, { method: 'DELETE' }); await refreshPosts(); resetForm(); toast('Note deleted'); }
  catch (error) { field('editor-error').textContent = error.message; }
});

field('lock-studio').addEventListener('click', () => { sessionStorage.removeItem('studioKey'); location.reload(); });

if (studioKey) unlock(studioKey).catch(() => { sessionStorage.removeItem('studioKey'); studioKey = ''; });
else field('published-at').value = today();
