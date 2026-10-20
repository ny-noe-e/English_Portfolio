(function () {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  function inline(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function imageSource(value) {
    const source = String(value || '').trim();
    if (!source || /[\s<>"'\\]/.test(source)) return null;
    if (/^\/(?!\/)/.test(source)) return source;
    try {
      const url = new URL(source);
      return /^https?:$/.test(url.protocol) && url.hostname ? source : null;
    } catch { return null; }
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let html = '';
    let list = false;
    const closeList = () => { if (list) { html += '</ul>'; list = false; } };
    for (const raw of lines) {
      const line = raw.trim();
      const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
      if (!line) { closeList(); continue; }
      if (image && imageSource(image[2])) {
        closeList();
        html += `<figure class="post-image"><img src="${escapeHtml(imageSource(image[2]))}" alt="${escapeHtml(image[1])}" loading="lazy" decoding="async"></figure>`;
        continue;
      }
      if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
      else if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
      else if (line.startsWith('# ')) { closeList(); html += `<h2>${inline(line.slice(2))}</h2>`; }
      else if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; }
      else if (/^[-*] /.test(line)) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.slice(2))}</li>`; }
      else { closeList(); html += `<p>${inline(line)}</p>`; }
    }
    closeList();
    return html;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
  }

  window.blogUtils = { escapeHtml, renderMarkdown, formatDate, imageSource };
})();
