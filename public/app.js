const { escapeHtml, renderMarkdown, formatDate } = window.blogUtils;
const app = document.querySelector('#app');
let posts = [];

document.querySelector('#year').textContent = new Date().getFullYear();

function creationTime(post) {
  const value = post.createdAt || `${post.publishedAt}T00:00:00.000Z`;
  return new Date(value).getTime() || 0;
}

function postRow(post, index) {
  const number = String(index + 1);
  return `
    <article class="post-row reveal" style="--delay:${index * 55}ms">
      <a href="/posts/${encodeURIComponent(post.slug)}" aria-label="Read ${escapeHtml(post.title)}">
        <span class="post-number">${number}</span>
        <div class="post-copy">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt)}</p>
        </div>
        <div class="post-details">
          <time datetime="${post.publishedAt}">${formatDate(post.publishedAt)}</time>
          <span>${post.readTime} min read</span>
        </div>
        <span class="post-arrow" aria-hidden="true">↗</span>
      </a>
    </article>`;
}

function renderPosts() {
  const list = document.querySelector('#post-list');
  list.innerHTML = posts.map(postRow).join('');
  document.querySelector('#empty-state').hidden = posts.length > 0;
  observeReveals();
}

function showArticle(post) {
  const template = document.querySelector('#article-template');
  const article = template.content.cloneNode(true);
  const index = posts.findIndex(item => item.id === post.id);
  article.querySelector('.article-meta').innerHTML = `<span>${String(index + 1)}</span><time datetime="${post.publishedAt}">${formatDate(post.publishedAt)}</time><span>${post.readTime} min read</span>`;
  article.querySelector('h1').textContent = post.title;
  article.querySelector('.article-deck').textContent = post.excerpt;
  article.querySelector('.article-body').innerHTML = renderMarkdown(post.body);
  app.innerHTML = '';
  app.append(article);
  document.title = `${post.title} — Field Notes`;
  window.scrollTo(0, 0);
}

function observeReveals() {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal:not(.visible)').forEach(element => observer.observe(element));
}

async function init() {
  try {
    const response = await fetch('/api/posts');
    if (!response.ok) throw new Error('Could not load posts');
    posts = (await response.json()).sort((a, b) => creationTime(b) - creationTime(a));

    const match = location.pathname.match(/^\/posts\/([^/]+)\/?$/);
    const legacySlug = new URLSearchParams(location.search).get('post');
    const slug = match ? decodeURIComponent(match[1]) : legacySlug;
    if (slug) {
      const post = posts.find(item => item.slug === slug);
      if (post) return showArticle(post);
    }

    renderPosts();
    observeReveals();
  } catch (error) {
    const list = document.querySelector('#post-list');
    if (list) list.innerHTML = '<p class="load-error">The archive could not be opened. Please try again in a moment.</p>';
  }
}

init();
