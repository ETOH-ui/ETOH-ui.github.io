/* ==========================================================================
   搜索：客户端本地检索（标题 / 标签 / 摘要）
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const panel = $('#search-panel');
  const input = $('#search-input');
  const resultsBox = $('#search-results');
  const pageInput = $('#search-page-input');
  const pageResults = $('#search-page-results');

  if (!panel && !pageInput) return;

  const base = (window.__SITE__ && window.__SITE__.base) || '/';
  const indexUrl = `${base.replace(/\/$/, '')}/search.json`;

  let cache = null;
  let loading = null;

  function loadIndex() {
    if (cache) return Promise.resolve(cache);
    if (loading) return loading;
    loading = fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        cache = Array.isArray(data) ? data : [];
        return cache;
      })
      .catch(() => {
        cache = [];
        return cache;
      });
    return loading;
  }

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function highlight(text, terms) {
    let html = escapeHtml(text);
    terms.forEach((term) => {
      const safe = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!safe) return;
      html = html.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
    });
    return html;
  }

  function search(query, data) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const out = [];

    data.forEach((item) => {
      const title = (item.t || '').toLowerCase();
      const tags = (item.g || []).join(' ').toLowerCase();
      const desc = (item.s || '').toLowerCase();

      let score = 0;
      let hit = 0;

      terms.forEach((term) => {
        let s = 0;
        if (title.includes(term)) s += 10;
        if (title.startsWith(term)) s += 6;
        if (tags.includes(term)) s += 5;
        if (desc.includes(term)) s += 2;
        if (s) hit += 1;
        score += s;
      });

      if (hit === terms.length && score > 0) {
        out.push({ ...item, score, terms });
      }
    });

    return out.sort((a, b) => b.score - a.score);
  }

  function render(container, list, terms, emptyText) {
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `<p class="search-hint">${emptyText || '没有找到匹配的文章'}</p>`;
      return;
    }

    container.innerHTML = list
      .slice(0, 30)
      .map(
        (item, i) => `
      <a class="search-item${i === 0 ? ' is-active' : ''}" href="${base.replace(/\/$/, '')}${item.u}" data-index="${i}">
        <span class="search-item-title">${highlight(item.t, terms)}</span>
        <span class="search-item-meta">
          <span>${escapeHtml(item.d || '')}</span>
          ${(item.g || []).slice(0, 3).map((t) => `<span># ${escapeHtml(t)}</span>`).join('')}
        </span>
        <span class="search-item-desc">${highlight(item.s || '', terms)}</span>
      </a>`
      )
      .join('');
  }

  /* ---------------- 弹层 ---------------- */

  let activeIndex = 0;
  let currentList = [];

  function openPanel() {
    if (!panel) return;
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    loadIndex().then(() => {
      if (input) {
        input.value = '';
        input.focus();
        resultsBox.innerHTML = '<p class="search-hint">输入关键词开始搜索</p>';
      }
    });
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.body.style.overflow = '';
    if (input) input.value = '';
    currentList = [];
  }

  window.__openSearch = openPanel;
  window.__closeSearch = closePanel;

  const openBtn = $('#search-open');
  const closeBtn = $('#search-close');
  if (openBtn) openBtn.addEventListener('click', openPanel);
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closePanel();
    });
  }

  function moveActive(delta) {
    const items = Array.from(resultsBox.querySelectorAll('.search-item'));
    if (!items.length) return;
    items[activeIndex]?.classList.remove('is-active');
    activeIndex = (activeIndex + delta + items.length) % items.length;
    items[activeIndex].classList.add('is-active');
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  if (input) {
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const data = await loadIndex();
        const q = input.value.trim();
        if (!q) {
          resultsBox.innerHTML = '<p class="search-hint">输入关键词开始搜索</p>';
          currentList = [];
          return;
        }
        currentList = search(q, data);
        activeIndex = 0;
        render(resultsBox, currentList, q.toLowerCase().split(/\s+/), '没有找到匹配的文章，换个词试试');
      }, 120);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Enter') {
        const items = resultsBox.querySelectorAll('.search-item');
        if (items[activeIndex]) {
          window.location.href = items[activeIndex].getAttribute('href');
        }
      }
    });
  }

  /* ---------------- 搜索页 ---------------- */

  if (pageInput) {
    let timer = null;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('q') || '';

    async function run(q) {
      const data = await loadIndex();
      if (!q.trim()) {
        pageResults.innerHTML =
          '<p class="search-hint">输入关键词开始搜索，也可以随时按 <kbd>/</kbd> 唤起搜索框。</p>';
        return;
      }
      const list = search(q, data);
      render(pageResults, list, q.toLowerCase().split(/\s+/), '没有找到匹配的文章，换个词试试');
    }

    pageInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(pageInput.value), 140);
    });

    if (initial) {
      pageInput.value = initial;
    }
    // 首屏就预加载索引，搜索页用起来更快
    loadIndex().then(() => {
      if (initial) run(initial);
    });
  }

  // 其他页面空闲时预取，让第一次按 / 就能立刻搜
  if (panel && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => loadIndex(), { timeout: 4000 });
  }
})();
