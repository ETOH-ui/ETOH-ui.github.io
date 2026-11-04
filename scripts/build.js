/**
 * 静态站点构建脚本
 *
 * 用法：
 *   node scripts/build.js          构建到 dist/
 *   node scripts/build.js --serve  构建后起本地预览服务（默认 4000 端口）
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import ejs from 'ejs';
import matter from 'gray-matter';

import site from '../config/site.config.js';
import theme from '../config/theme.config.js';
import navList from '../config/nav.config.js';
import friends from '../config/friends.config.js';

import { renderMarkdown, slugify } from '../src/utils/markdown.js';
import { toDate, formatDate, getYear } from '../src/utils/date.js';
import { countText, readingTime, formatCount, excerpt } from '../src/utils/readingTime.js';
import * as fsu from '../src/utils/fs.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(SRC, 'posts');
const PUBLIC_DIR = path.join(ROOT, 'public');

const OPTIONS = { rmWhitespace: false, root: SRC, views: [SRC, path.join(SRC, 'components')] };

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

/** 拼接站内绝对路径，自动处理 base */
function url(p = '/') {
  const base = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base;
  const clean = p.startsWith('/') ? p : `/${p}`;
  return `${base}${clean}` || '/';
}

/** 完整的对外链接，用于 og / sitemap */
function absUrl(p = '/') {
  return site.url.replace(/\/$/, '') + url(p);
}

/** 把文章里的相对资源路径解析成站点绝对路径 */
function resolveAsset(src, postUrl = '') {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;

  let p = src.replace(/^\.\//, '');
  if (p.startsWith('/')) return url(p);

  // 源文件里图片放在与文章同名的目录下（./hello-world/a.png），
  // 但输出目录本身就是 /2024/01/hello-world/，所以要把这层名字去掉
  const slug = postUrl.split('/').filter(Boolean).pop();
  if (slug && p.startsWith(`${slug}/`)) {
    p = p.slice(slug.length + 1);
  }

  return url(postUrl + p);
}

/** 标签 → URL 片段（保留中文，浏览器请求时会自动编码） */
function tagSlug(tag) {
  return slugify(tag) || tag;
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 正文开头如果重复了 frontmatter 的标题，就去掉（banner 已经显示过一次） */
function stripDuplicateTitle(html, title) {
  const m = html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/);
  if (!m) return html;
  // 标题里可能有锚点符号（#），剥掉标签和开头的 # 再比较
  const text = m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s*/, '')
    .trim();
  return text === String(title).trim() ? html.slice(m[0].length) : html;
}

const log = {
  info: (msg) => console.log(`  ${msg}`),
  ok: (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`),
  dim: (msg) => console.log(`  \x1b[2m${msg}\x1b[0m`)
};

/* ------------------------------------------------------------------ */
/* 加载文章                                                            */
/* ------------------------------------------------------------------ */

async function loadPosts() {
  const files = await fsu.walk(POSTS_DIR);
  const posts = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = matter(raw);

    if (data.draft === true) continue;

    const dir = path.dirname(file);
    const base = path.basename(file, '.md');
    // slug 去掉文件名里的日期前缀：2024-01-01-hello-world → hello-world
    const slug =
      data.slug || base.replace(/^\d{4}[-_]?\d{2}[-_]?\d{2}[-_]?/, '') || base;

    const date = toDate(data.date || (await fs.stat(file)).mtime);
    const year = String(getYear(date)).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const postUrl = `/${year}/${month}/${slug}/`;

    // 同名的兄弟目录当作这篇的图片目录
    const assetDir = path.join(dir, slug);
    const hasAssets = await fsu.exists(assetDir);

    // 源文件里写 ./hello-world/a.png，输出目录是 /2024/01/hello-world/，所以要抹掉这层前缀
    let body = content;
    const strip = (s) =>
      s
        .replaceAll(`(./${slug}/`, '(./')
        .replaceAll(`("./${slug}/`, '("./')
        .replaceAll(`('./${slug}/`, "('./")
        .replaceAll(`](${slug}/`, '](./');
    body = strip(body);

    const rendered = renderMarkdown(body);
    const html = stripDuplicateTitle(rendered.html, data.title || base);
    const stats = countText(content);

    const tags = (data.tags || []).map((t) => String(t).trim()).filter(Boolean);
    const categories = (data.categories || data.category || [])
      .map((c) => String(c).trim())
      .filter(Boolean);

    const title = data.title || base;
    const summary = data.summary || excerpt(content, theme.excerptLength);
    const cover = data.cover ? resolveAsset(data.cover.split(' ')[0], postUrl) : '';

    posts.push({
      title,
      slug,
      url: postUrl,
      file,
      date,
      updated: data.updated ? toDate(data.updated) : null,
      dateStr: formatDate(date),
      year,
      month,
      tags,
      categories,
      summary,
      cover,
      coverRaw: data.cover || '',
      html,
      headings: rendered.headings,
      stats,
      words: formatCount(stats.total),
      minutes: readingTime(content),
      hasAssets,
      assetDir,
      outDir: path.join(DIST, year, month, slug),
      sticky: data.sticky === true,
      top: Number(data.top) || 0,
      raw: content
    });
  }

  // 置顶优先，然后按时间倒序
  posts.sort((a, b) => {
    if (a.sticky !== b.sticky) return a.sticky ? -1 : 1;
    return b.date - a.date;
  });

  return posts;
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */

const tmpl = (name) => path.join(SRC, name);

/** 先渲染页面内容，再套进 default 布局 */
async function renderPage(pageFile, data) {
  const body = await ejs.renderFile(tmpl(pageFile), data, OPTIONS);
  return ejs.renderFile(tmpl('layouts/default.ejs'), { ...data, body }, OPTIONS);
}

/** 所有页面共享的数据 */
function baseData(posts) {
  const allTags = new Map();
  posts.forEach((p) => {
    p.tags.forEach((t) => allTags.set(t, (allTags.get(t) || 0) + 1));
  });

  const totalWords = posts.reduce((sum, p) => sum + p.stats.total, 0);

  return {
    site,
    theme,
    nav: navList,
    friends,
    posts,
    // 非文章页统一给个 null，避免模板里引用未定义变量
    post: null,
    allTags: [...allTags.entries()]
      .map(([name, count]) => ({ name, count, slug: tagSlug(name), url: `/tags/${tagSlug(name)}/` }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh')),
    totalPosts: posts.length,
    totalTags: allTags.size,
    totalWords: formatCount(totalWords),
    url,
    absUrl,
    resolveAsset,
    formatDate,
    tagSlug,
    buildYear: new Date().getFullYear()
  };
}

/* ------------------------------------------------------------------ */
/* 各类页面                                                            */
/* ------------------------------------------------------------------ */

async function buildHome(posts, data) {
  const perPage = theme.postsPerPage || 8;
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));

  for (let i = 1; i <= totalPages; i += 1) {
    const slice = posts.slice((i - 1) * perPage, i * perPage);
    const pageUrl = i === 1 ? '/' : `/page/${i}/`;

    // 卡片左右交替
    const list = slice.map((post, idx) => ({
      ...post,
      side: idx % 2 === 0 ? 'left' : 'right',
      index: (i - 1) * perPage + idx
    }));

    const html = await renderPage('pages/index.ejs', {
      ...data,
      page: {
        title: i === 1 ? null : `第 ${i} 页`,
        url: pageUrl,
        current: i,
        total: totalPages,
        posts: list
      }
    });

    const outDir = i === 1 ? DIST : path.join(DIST, 'page', String(i));
    await fsu.writeFile(path.join(outDir, 'index.html'), html);
  }

  return totalPages;
}

async function buildPost(post, data) {
  const html = await renderPage('pages/post.ejs', {
    ...data,
    post,
    page: { title: post.title, url: post.url, type: 'post' },
    prev: data.posts[data.posts.indexOf(post) + 1] || null,
    next: data.posts[data.posts.indexOf(post) - 1] || null
  });

  await fsu.writeFile(path.join(post.outDir, 'index.html'), html);

  // 拷贝同名图片目录
  if (post.hasAssets) {
    await fsu.copyDir(post.assetDir, post.outDir);
  }
}

async function buildArchives(posts, data) {
  const byYear = new Map();
  posts.forEach((p) => {
    const y = p.year;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  });

  const years = [...byYear.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, list]) => ({ year, posts: list }));

  const html = await renderPage('pages/archives.ejs', {
    ...data,
    years,
    page: { title: '归档', url: '/archives/', type: 'archives' }
  });

  await fsu.writeFile(path.join(DIST, 'archives', 'index.html'), html);
}

async function buildTags(data) {
  const { allTags, posts } = data;

  // 标签总览
  const indexHtml = await renderPage('pages/tags.ejs', {
    ...data,
    page: { title: '标签', url: '/tags/', type: 'tags' }
  });
  await fsu.writeFile(path.join(DIST, 'tags', 'index.html'), indexHtml);

  // 每个标签的详情页
  for (const tag of allTags) {
    const list = posts
      .filter((p) => p.tags.includes(tag.name))
      .map((post, idx) => ({ ...post, side: idx % 2 === 0 ? 'left' : 'right' }));

    const html = await renderPage('pages/tag.ejs', {
      ...data,
      tag,
      list,
      page: { title: `标签：${tag.name}`, url: tag.url, type: 'tag' }
    });

    await fsu.writeFile(path.join(DIST, 'tags', tag.slug, 'index.html'), html);
  }
}

async function buildStaticPages(data) {
  // 关于页：内容来自 src/pages/about.md
  const aboutFile = path.join(SRC, 'pages', 'about.md');
  let aboutHtml = '';
  if (await fsu.exists(aboutFile)) {
    const raw = await fs.readFile(aboutFile, 'utf8');
    const { content } = matter(raw);
    aboutHtml = renderMarkdown(content).html;
  }
  const about = await renderPage('pages/about.ejs', {
    ...data,
    aboutHtml,
    page: { title: '关于', url: '/about/', type: 'about' }
  });
  await fsu.writeFile(path.join(DIST, 'about', 'index.html'), about);

  // 友链页
  const friendsHtml = await renderPage('pages/friends.ejs', {
    ...data,
    page: { title: '友链', url: '/friends/', type: 'friends' }
  });
  await fsu.writeFile(path.join(DIST, 'friends', 'index.html'), friendsHtml);

  // 搜索页（结果由前端渲染，服务端只给壳）
  const searchHtml = await renderPage('pages/search.ejs', {
    ...data,
    page: { title: '搜索', url: '/search/', type: 'search' }
  });
  await fsu.writeFile(path.join(DIST, 'search', 'index.html'), searchHtml);

  // 404
  const notFound = await renderPage('pages/404.ejs', {
    ...data,
    page: { title: '页面不存在', url: '/404.html', type: '404' }
  });
  await fsu.writeFile(path.join(DIST, '404.html'), notFound);
}

/* ------------------------------------------------------------------ */
/* 数据文件                                                            */
/* ------------------------------------------------------------------ */

async function buildDataFiles(posts) {
  // 搜索索引：只放标题、标签、摘要，控制体积
  const searchIndex = posts.map((p) => ({
    t: p.title,
    u: p.url,
    g: p.tags,
    s: p.summary,
    d: p.dateStr
  }));
  await fsu.writeFile(
    path.join(DIST, 'search.json'),
    JSON.stringify(searchIndex)
  );

  // 文章元数据，留给以后做客户端分页或小工具用
  const postsJson = posts.map((p) => ({
    title: p.title,
    url: p.url,
    date: p.dateStr,
    tags: p.tags,
    categories: p.categories,
    summary: p.summary,
    cover: p.cover,
    words: p.stats.total,
    minutes: p.minutes
  }));
  await fsu.writeFile(path.join(DIST, 'posts.json'), JSON.stringify(postsJson, null, 2));

  // sitemap
  const staticPages = ['/', '/archives/', '/tags/', '/about/', '/friends/', '/search/'];
  const urls = [
    ...staticPages.map((u) => ({ loc: absUrl(u), lastmod: formatDate(new Date()) })),
    ...posts.map((p) => ({ loc: absUrl(p.url), lastmod: p.dateStr }))
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
  )
  .join('\n')}
</urlset>
`;
  await fsu.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);

  return { searchIndex };
}

/* ------------------------------------------------------------------ */
/* 静态资源                                                            */
/* ------------------------------------------------------------------ */

/** 按顺序合并 CSS / JS，减少请求数 */
const CSS_ORDER = [
  'variables.css',
  'icons.css',
  'base.css',
  'layout.css',
  'components.css',
  'markdown.css',
  'highlight.css'
];

const JS_ORDER = ['main.js', 'search.js'];

async function buildAssets() {
  // CSS 合并
  const cssParts = [];
  for (const name of CSS_ORDER) {
    const file = path.join(SRC, 'styles', name);
    if (await fsu.exists(file)) {
      cssParts.push(`/* ${name} */\n${await fs.readFile(file, 'utf8')}`);
    }
  }
  await fsu.writeFile(path.join(DIST, 'css', 'style.css'), cssParts.join('\n\n'));

  // JS 合并
  const jsParts = [];
  for (const name of JS_ORDER) {
    const file = path.join(SRC, 'js', name);
    if (await fsu.exists(file)) {
      jsParts.push(`/* ${name} */\n${await fs.readFile(file, 'utf8')}`);
    }
  }
  await fsu.writeFile(path.join(DIST, 'js', 'main.js'), jsParts.join('\n\n'));

  // public 原样拷贝
  const publicCount = await fsu.copyDir(PUBLIC_DIR, DIST);

  // 其他资源目录
  const assetCount = await fsu.copyDir(
    path.join(SRC, 'assets'),
    path.join(DIST, 'assets')
  );

  // GitHub Pages 必须，防止 Jekyll 忽略下划线开头的文件
  await fsu.writeFile(path.join(DIST, '.nojekyll'), '');

  return { publicCount, assetCount };
}

/* ------------------------------------------------------------------ */
/* 本地预览                                                            */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(port = 4000) {
  const server = http.createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const base = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base;
    if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length) || '/';

    let file = path.join(DIST, pathname);
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(DIST, '404.html');
      const body = await fs.readFile(file).catch(() => 'Not Found');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(body);
    }

    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('Not Found');
    }
  });

  const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => {
    console.log(`\n  预览地址：\x1b[36mhttp://${host}:${port}${site.base}\x1b[0m`);
    console.log('  Ctrl+C 结束\n');
  });
}

/* ------------------------------------------------------------------ */
/* 增量清理                                                            */
/* ------------------------------------------------------------------ */

const MANIFEST = path.join(ROOT, '.build-manifest.json');

/**
 * 记录本次生成的文件，构建结束后把上次有、这次没有的删掉。
 * 不用整目录清空，是为了避免一次删除太多文件（也会误伤手动放进去的东西）。
 */
function trackOutputs() {
  const emitted = new Set();
  fsu.onWrite((abs) => {
    const rel = path.relative(DIST, abs);
    if (rel.startsWith('..')) return;
    emitted.add(rel.split(path.sep).join('/'));
  });
  return emitted;
}

async function cleanStale(emitted) {
  let prev = [];
  try {
    const raw = await fs.readFile(MANIFEST, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) prev = parsed;
  } catch {
    // 第一次构建没有清单，跳过
  }

  const stale = prev.filter((rel) => !emitted.has(rel));
  for (const rel of stale) {
    await fs.rm(path.join(DIST, rel), { force: true });
  }
  if (stale.length) log.dim(`清理 ${stale.length} 个过期文件`);

  await fs.writeFile(MANIFEST, JSON.stringify([...emitted].sort(), null, 2), 'utf8');
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

async function build() {
  const started = Date.now();
  console.log('\n\x1b[1m构建开始\x1b[0m');

  await fsu.ensureDir(DIST);
  const emitted = trackOutputs();

  const posts = await loadPosts();
  log.ok(`读取到 ${posts.length} 篇文章`);

  const data = baseData(posts);

  const pages = await buildHome(posts, data);
  log.ok(`首页 ${pages} 页`);

  for (const post of posts) {
    await buildPost(post, data);
  }
  log.ok(`文章页 ${posts.length} 个`);

  await buildArchives(posts, data);
  await buildTags(data);
  await buildStaticPages(data);
  log.ok('归档 / 标签 / 关于 / 友链 / 搜索 / 404');

  await buildDataFiles(posts);
  log.ok('search.json / posts.json / sitemap.xml');

  const assets = await buildAssets();
  log.ok(`静态资源（public ${assets.publicCount} 个文件）`);

  await cleanStale(emitted);

  const size = await fsu.dirSize(DIST);
  log.dim(`输出体积 ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\n\x1b[32m\x1b[1m完成\x1b[0m 用时 ${Date.now() - started} ms\n`);

  return { posts, pages };
}

/* ------------------------------------------------------------------ */
/* 监听源码变化，自动重新构建                                            */
/* ------------------------------------------------------------------ */

function watchAndRebuild() {
  const targets = [SRC, path.join(ROOT, 'config'), path.join(ROOT, 'public')];
  let timer = null;
  let building = false;
  let queued = false;

  const trigger = (eventType, filename) => {
    // 构建产物和临时文件不算
    if (!filename) return;
    if (filename.includes('node_modules') || filename.endsWith('~')) return;

    // 工具模块是构建脚本自己引用的，Node 已经缓存，改了必须重启进程
    if (/^utils[\\/]/.test(filename) || /^scripts[\\/]/.test(filename)) {
      console.log(
        '  \x1b[33m⚠ 改的是构建脚本自身依赖的模块，需要重启服务才会生效\x1b[0m'
      );
    }

    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (building) {
        queued = true;
        return;
      }
      building = true;
      try {
        await build();
      } catch (err) {
        console.error('\n\x1b[31m重新构建失败\x1b[0m\n', err.message || err);
      }
      building = false;
      if (queued) {
        queued = false;
        trigger('change', 'retry');
      }
    }, 220);
  };

  targets.forEach((dir) => {
    try {
      fsSync.watch(dir, { recursive: true }, trigger);
    } catch (err) {
      console.warn(`  监听 ${dir} 失败：${err.message}`);
    }
  });

  console.log('  \x1b[2m已开启监听，改完文件保存后会自动重新构建\x1b[0m\n');
}

async function main() {
  await build();

  if (process.argv.includes('--serve')) {
    const port = Number(process.env.PORT) || 4000;
    serve(port);
    watchAndRebuild();
  }
}

main().catch((err) => {
  console.error('\n\x1b[31m构建失败\x1b[0m\n', err);
  process.exit(1);
});
