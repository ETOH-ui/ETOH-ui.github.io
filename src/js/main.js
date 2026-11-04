/* ==========================================================================
   通用交互
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // 标记 JS 可用，用于启用渐进式动画
  root.classList.add('js-ready');

  /* ------------------------------------------------------------------ */
  /* 1. 首屏加载动画                                                     */
  /* ------------------------------------------------------------------ */

  const loader = $('#loader');

  function hideLoader() {
    if (!loader || loader.classList.contains('is-done')) return;
    loader.classList.add('is-done');
    setTimeout(() => {
      if (loader && loader.parentNode) loader.remove();
    }, 900);
  }

  if (document.readyState === 'complete') {
    setTimeout(hideLoader, 260);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 260));
    // 兜底：图片卡住也不会一直挡着
    setTimeout(hideLoader, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* 2. 主题切换：auto → light → dark                                     */
  /* ------------------------------------------------------------------ */

  const MODES = ['auto', 'light', 'dark'];
  const modeBtn = $('#mode-toggle');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function applyMode(mode) {
    const isDark = mode === 'dark' || (mode === 'auto' && mql.matches);
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      localStorage.setItem('color-mode', mode);
    } catch (e) {}
    if (modeBtn) {
      modeBtn.setAttribute('aria-label', `当前：${labelOf(mode)}模式，点击切换`);
      modeBtn.setAttribute('title', `主题：${labelOf(mode)}`);
    }
  }

  function labelOf(mode) {
    return mode === 'auto' ? '跟随系统' : mode === 'dark' ? '暗色' : '亮色';
  }

  function currentMode() {
    return root.getAttribute('data-mode') || 'auto';
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      const next = MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length];
      applyMode(next);
    });
  }

  mql.addEventListener('change', () => {
    if (currentMode() === 'auto') applyMode('auto');
  });

  applyMode(currentMode());

  /* ------------------------------------------------------------------ */
  /* 3. 顶栏滚动行为 + 回到顶部                                           */
  /* ------------------------------------------------------------------ */

  const nav = $('#header-nav');
  const backTop = $('#back-to-top');
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;

    if (nav) {
      nav.classList.toggle('is-scrolled', y > 10);

      // 向下滚隐藏，向上滚露出；在顶部附近始终显示
      if (y > 200 && y > lastY + 4) {
        nav.classList.add('is-hidden');
      } else if (y < lastY - 4 || y < 200) {
        nav.classList.remove('is-hidden');
      }
    }

    if (backTop) {
      backTop.classList.toggle('is-visible', y > 600);
    }

    updateProgress();
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );

  if (backTop) {
    backTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4. 阅读进度                                                         */
  /* ------------------------------------------------------------------ */

  const progressBar = $('#read-progress span');
  const article = $('#article-content');

  function updateProgress() {
    if (!progressBar || !article) return;
    const rect = article.getBoundingClientRect();
    const total = rect.height - window.innerHeight + 200;
    const passed = -rect.top + 100;
    const ratio = total <= 0 ? 1 : Math.min(1, Math.max(0, passed / total));
    progressBar.style.width = `${ratio * 100}%`;
  }

  updateProgress();

  /* ------------------------------------------------------------------ */
  /* 5. 文章目录高亮                                                     */
  /* ------------------------------------------------------------------ */

  const tocNav = document.getElementById('toc');

  if (tocNav) {
    const tocItems = Array.from(tocNav.querySelectorAll('.toc-link'))
      .map((link) => ({
        link,
        el: document.getElementById(link.dataset.tocTarget || '')
      }))
      .filter((item) => item.el);

    let activeId = '';

    const updateToc = () => {
      if (!tocItems.length) return;
      const line = window.innerHeight * 0.3;
      let current = tocItems[0];

      for (const item of tocItems) {
        if (item.el.getBoundingClientRect().top <= line) current = item;
        else break;
      }

      const id = current.link.dataset.tocTarget;
      if (id === activeId) return;
      activeId = id;
      tocItems.forEach((item) => item.link.classList.toggle('is-active', item === current));
    };

    window.addEventListener('scroll', updateToc, { passive: true });
    updateToc();
  }

  /* 目录 / 导航 两个面板的切换 */
  const sideSwitch = document.getElementById('side-switch');

  if (sideSwitch) {
    const switchBtns = Array.prototype.slice.call(sideSwitch.querySelectorAll('.switch-btn'));
    const sidePanels = Array.prototype.slice.call(document.querySelectorAll('.side-panel'));

    switchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.panel;

        switchBtns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        sidePanels.forEach((panel) => {
          panel.hidden = panel.dataset.panel !== target;
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 6. 移动端抽屉                                                       */
  /* ------------------------------------------------------------------ */

  const drawer = $('#drawer');
  const drawerMask = $('#drawer-mask');
  const menuToggle = $('#menu-toggle');
  const drawerClose = $('#drawer-close');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (drawerMask) {
      drawerMask.hidden = false;
    }
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (drawerMask) drawerMask.hidden = true;
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle) menuToggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerMask) drawerMask.addEventListener('click', closeDrawer);

  /* ------------------------------------------------------------------ */
  /* 6. 卡片进场动画                                                     */
  /* ------------------------------------------------------------------ */

  const cards = $$('.post-card');
  if (cards.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target;
              const index = Number(el.dataset.index || 0);
              el.style.setProperty('--stagger', `${Math.min(index, 5) * 70}ms`);
              el.classList.add('is-visible');
              io.unobserve(el);
            }
          });
        },
        { rootMargin: '0px 0px -40px 0px', threshold: 0.06 }
      );
      cards.forEach((el, i) => {
        el.dataset.index = String(i);
        io.observe(el);
      });
    } else {
      cards.forEach((el) => el.classList.add('is-visible'));
    }
  }

  /* ------------------------------------------------------------------ */
  /* 7. 代码块：语言标签 + 复制                                           */
  /* ------------------------------------------------------------------ */

  $$('.markdown-body pre.code-block').forEach((pre) => {
    const code = pre.querySelector('code');
    const lang = (code && code.dataset.lang) || '';

    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `<span class="code-lang">${lang || 'text'}</span>`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-copy"></use></svg><span>复制</span>';
    btn.addEventListener('click', async () => {
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch (err) {}
        document.body.removeChild(ta);
      }
      btn.classList.add('is-copied');
      btn.querySelector('span').textContent = '已复制';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.querySelector('span').textContent = '复制';
      }, 1800);
    });

    header.appendChild(btn);
    wrap.appendChild(header);
    wrap.appendChild(pre);
  });

  /* ------------------------------------------------------------------ */
  /* 8. 图片灯箱                                                         */
  /* ------------------------------------------------------------------ */

  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightbox-img');
  const lightboxCaption = $('#lightbox-caption');

  function openLightbox(src, alt, caption) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    if (lightboxCaption) lightboxCaption.textContent = caption || alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  $$('.md-image').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(
        link.getAttribute('href'),
        link.dataset.alt,
        link.dataset.caption
      );
    });
  });

  const lbClose = $('#lightbox-close');
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  /* ------------------------------------------------------------------ */
  /* 9. 点击粒子特效                                                     */
  /* ------------------------------------------------------------------ */

  const supportsHover = window.matchMedia('(hover: hover)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#3d8bff', '#66a3ff', '#a3c7ff', '#4a9eff', '#cfe2ff'];

  function burst(x, y) {
    const count = 16;

    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'click-particle';
      dot.style.background = COLORS[i % COLORS.length];

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const radius = 18 + Math.random() * 34;
      const size = 3 + Math.random() * 4;

      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      document.body.appendChild(dot);

      const anim = dot.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.9 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * radius}px), calc(-50% + ${
              Math.sin(angle) * radius
            }px)) scale(0.2)`,
            opacity: 0
          }
        ],
        {
          duration: 700 + Math.random() * 500,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        }
      );

      anim.onfinish = () => dot.remove();
    }

    // 一圈扩散的圆环
    const ring = document.createElement('span');
    ring.className = 'click-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);

    const ringAnim = ring.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.55, borderWidth: '3px' },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0, borderWidth: '1px' }
      ],
      { duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
    ringAnim.onfinish = () => ring.remove();
  }

  if (supportsHover && !reduceMotion) {
    document.addEventListener('click', (e) => {
      // 链接、按钮上不炸，避免干扰点击
      if (e.target.closest('a, button, input, textarea, label, [role="button"]')) return;
      burst(e.clientX, e.clientY);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 10. 键盘快捷键                                                      */
  /* ------------------------------------------------------------------ */

  // 双击图片/链接时，有些系统的划词、截图工具会弹出悬浮菜单。
  // 这里直接在捕获阶段吞掉，避免一次操作触发两次甚至三次响应。
  document.addEventListener(
    'dblclick',
    (e) => {
      if (e.target.closest('img, .md-image, a, button')) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      closeDrawer();
      if (lightbox && !lightbox.hidden) closeLightbox();
      if (window.__closeSearch) window.__closeSearch();
      return;
    }

    if (e.key === '/' && !typing) {
      e.preventDefault();
      if (window.__openSearch) window.__openSearch();
    }
  });

  /* ------------------------------------------------------------------ */
  /* 11. 访问量：不蒜子 / 其他统计适配                                     */
  /* ------------------------------------------------------------------ */

  // 不蒜子的值是异步塞进 span 的，短暂延迟后没有值就显示成 0，避免一直挂着 "—"
  const viewSpans = $$('#busuanzi_value_site_pv, #busuanzi_value_page_pv');
  if (viewSpans.length) {
    setTimeout(() => {
      viewSpans.forEach((el) => {
        if (!el.textContent || el.textContent === '—') {
          el.textContent = el.id === 'busuanzi_value_site_pv' ? '—' : '—';
          el.setAttribute('data-empty', 'true');
        }
      });
    }, 4000);
  }
})();
