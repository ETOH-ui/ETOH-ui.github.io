/**
 * Markdown 渲染器
 * 支持的扩展：脚注、任务列表、表格对齐、标题锚点、代码高亮、内嵌 HTML
 */
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/core';

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, (c) => ESCAPE_MAP[c]);
}

/** 只注册实际用到的语言，构建更快 */
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import php from 'highlight.js/lib/languages/php';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import powershell from 'highlight.js/lib/languages/powershell';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import plaintext from 'highlight.js/lib/languages/plaintext';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import markdownLang from 'highlight.js/lib/languages/markdown';

const LANGS = {
  javascript, typescript, xml, css, bash, python, json, yaml, sql, java, php,
  go, rust, c, cpp, powershell, ini, diff, plaintext, dockerfile, nginx,
  markdown: markdownLang
};

const ALIASES = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  html: 'xml', vue: 'xml', svg: 'xml',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  py: 'python',
  yml: 'yaml',
  htm: 'xml',
  'c++': 'cpp', cs: 'c',
  ps1: 'powershell',
  md: 'markdown',
  text: 'plaintext', txt: 'plaintext'
};

Object.entries(LANGS).forEach(([name, def]) => hljs.registerLanguage(name, def));

function normalizeLang(lang) {
  const l = String(lang || '').toLowerCase();
  if (hljs.getLanguage(l)) return l;
  return ALIASES[l] && hljs.getLanguage(ALIASES[l]) ? ALIASES[l] : '';
}

/** 中文标题也能当锚点，只去掉会破坏 URL 的符号 */
function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: false,
  highlight(code, lang) {
    const language = normalizeLang(lang);
    if (!language) {
      return `<pre class="code-block"><code class="language-plaintext">${escapeHtml(code)}</code></pre>`;
    }
    try {
      const html = hljs.highlight(code, {
        language,
        ignoreIllegals: true
      }).value;
      return `<pre class="code-block"><code class="language-${language}" data-lang="${language}">${html}</code></pre>`;
    } catch {
      return `<pre class="code-block"><code class="language-plaintext">${escapeHtml(code)}</code></pre>`;
    }
  }
});

md.use(anchor, {
  level: [1, 2, 3, 4],
  slugify,
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '<span class="anchor-mark">#</span>',
    placement: 'before',
    ariaHidden: true
  })
});

md.use(footnote);
md.use(taskLists, { enabled: false, label: true });

// 外链新窗口打开
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// 图片：懒加载 + 可点击放大
const defaultImage =
  md.renderer.rules.image ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');
  token.attrSet('draggable', 'false');
  const src = token.attrGet('src') || '';
  const alt = token.content || '';
  const title = token.attrGet('title');
  const img = defaultImage(tokens, idx, options, env, self);
  return `<a class="md-image" href="${escapeHtml(src)}" data-lightbox data-alt="${escapeHtml(
    alt
  )}"${title ? ` data-caption="${escapeHtml(title)}"` : ''}>${img}</a>`;
};

// 表格外层包一个可横向滚动的容器，窄屏不溢出
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => '</table></div>';

export function renderMarkdown(raw) {
  const env = {};
  const tokens = md.parse(raw || '', env);

  // 顺手把二级、三级标题抽出来做目录
  const headings = [];
  tokens.forEach((token, i) => {
    if (token.type !== 'heading_open') return;
    const level = Number(token.tag.slice(1));
    if (level < 2 || level > 3) return;
    const inline = tokens[i + 1];
    const text = (inline && inline.content ? inline.content : '').trim();
    if (!text) return;
    headings.push({ level, text, id: token.attrGet('id') || '' });
  });

  return {
    html: md.renderer.render(tokens, md.options, env),
    headings
  };
}

export { md, slugify };
