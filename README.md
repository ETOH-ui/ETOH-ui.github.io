# 迷茫的原因是你学了一堆拼图

jian 的个人博客。没有用现成的框架，构建脚本是自己写的：扫描 Markdown → 解析 frontmatter → 渲染 → 生成页面、搜索索引和 sitemap。

部署在 GitHub Pages：**https://ETOH-ui.github.io**

---

## 快速开始

```bash
npm install        # 装依赖（走 npmmirror 源，见 .npmrc）
npm run build      # 构建到 dist/
npm run dev        # 构建 + 起本地预览 http://localhost:4000
```

`npm run dev` 会一直盯着 `src/`、`config/`、`public/`，**改完文件保存就自动重新构建**，浏览器刷新即可，不用手动跑 build。

端口被占或想换一个：`PORT=5555 npm run dev`。

## 目录结构

```
blog/
├── .github/workflows/deploy.yml   # 推送到 main 自动构建 + 部署 Pages
├── config/
│   ├── site.config.js             # 站点标题、作者、头像、banner、统计
│   ├── nav.config.js               # 导航菜单
│   ├── theme.config.js             # 每页文章数、默认明暗、光标、粒子
│   └── friends.config.js           # 友链
├── public/                         # 原样拷贝到 dist，放 favicon / robots / 光标
│   └── images/
├── src/
│   ├── layouts/default.ejs         # 页面外壳
│   ├── components/                 # header / sidebar / footer / 卡片 / 分页
│   ├── pages/                      # 各页面的 EJS 模板 + about.md
│   ├── posts/                      # 文章
│   ├── styles/                     # 拆成 7 个 css，构建时合并成一个
│   ├── js/                         # main.js + search.js，构建时合并
│   └── utils/                      # 日期、字数、Markdown 渲染
├── scripts/
│   ├── build.js                    # 构建主脚本
│   ├── prepare-assets.mjs          # 图片 → webp（换图时手动跑）
│   └── gen-cursor.mjs              # 生成像素光标（换颜色时手动跑）
└── dist/                           # 构建产物，不入库
```

## 写一篇新文章

在 `src/posts/年/月/` 下新建文件，文件名带完整日期：

```
src/posts/2024/05/2024-05-12-hello.md
```

文件名去掉日期前缀就是文章 URL 的 slug，上面这篇会生成
`https://ETOH-ui.github.io/2024/05/hello/`。

frontmatter 写法：

```yaml
---
title: 文章标题
date: 2024-05-12 14:30        # 排序看这个，同日多篇靠时间区分
updated: 2024-05-13 09:00     # 可选
tags: [笔记, 折腾]             # 可选
categories: [随笔]             # 可选
cover: ./hello/cover.jpg      # 卡片封面，可选
summary: 首页卡片上显示的一句话，不写就自动截正文
draft: false                  # true 的话构建时跳过
---
```

### 文章里的图片

和 markdown 文件**同名的兄弟目录**里放图：

```
src/posts/2024/05/
├── 2024-05-12-hello.md
└── hello/
    ├── cover.jpg
    └── screenshot.png
```

正文里这样引用（注意前缀是 `./hello/`）：

```markdown
![截图](./hello/screenshot.png)
```

构建时会把 `hello/` 整个拷到输出目录，并自动抹掉路径里的 `hello/` 这一层，所以最终的相对路径刚好对得上。

建议图片先转成 webp：改 `scripts/prepare-assets.mjs` 里的路径后跑 `node scripts/prepare-assets.mjs`。

## 能改什么

| 想改的东西 | 改哪里 |
|---|---|
| 站点标题、副标题、作者、头像、banner | `config/site.config.js` |
| 导航项（增删页面） | `config/nav.config.js` |
| 每页文章数、默认明暗、点击粒子、光标 | `config/theme.config.js` |
| 友链 | `config/friends.config.js` |
| 主题色 | `src/styles/variables.css` 顶部的 `--blue-*` |
| 正文字体、行距 | 同上，`--font-serif` / `--font-sans` |
| 关于页内容 | `src/pages/about.md` |

配色是蓝色系，想换色的话改 `variables.css` 里那 7 个 `--blue-*` 就行，暗色模式对应的是 `[data-theme="dark"]` 里那一段。

## 访问统计

现在设的是 `provider: 'none'`，侧边栏和文章页统一显示 **0**，不加载任何第三方脚本——这样不会把本地和线上的数据混在一起。

真实统计就改 `config/site.config.js` 里的 `analytics.provider`：

- `'none'` —— 默认，全部显示 0
- `'busuanzi'` —— 零配置，数字由第三方脚本塞进去
- `'goatcounter'` —— 填 `goatcounterCode`
- `'umami'` —— 填 `umamiWebsiteId` 和 `umamiScriptUrl`

## 友链

在 `config/friends.config.js` 里手动加，一项一条：

```js
{
  name: 'Benson27',
  url: 'https://benson27.cn',
  avatar: '/images/friends/benson27.webp',  // 留空则用名字首字母生成占位
  desc: '一句话介绍'
}
```

头像建议下载下来转成 96×96 的 webp 放进 `public/images/friends/`，比直接外链对方站点稳，加载也快（Benson27 那张原图 287KB，压完 4KB）。

## 部署

仓库名是 `ETOH-ui.github.io`，所以站点在根路径，`config/site.config.js` 里的 `base` 保持 `'/'`。

首次部署：

1. 把整个目录推到 GitHub 仓库 `ETOH-ui/ETOH-ui.github.io` 的 `main` 分支
2. 打开仓库 **Settings → Pages**，Source 选 **GitHub Actions**
3. 之后每次 push 到 main，Actions 会自动构建并发布

> 如果以后换成 `my-blog` 这种非根路径的仓库，记得把 `base` 改成 `'/my-blog/'`，否则 CSS 和图片会 404。

## 几个实现上的说明

- **Markdown 扩展**：脚注、任务列表、表格对齐、标题锚点、内嵌 HTML、代码高亮全部支持。高亮在构建时完成，前端不加载高亮库。
- **文章目录**：构建时从 Markdown 的二级、三级标题里抽出来，显示在文章页侧边栏，滚动时自动高亮当前所在的小节。
- **搜索**：构建时生成 `search.json`，只含标题、标签、摘要，几十篇文章也就几十 KB。按 `/` 键唤起，支持上下键选择。
- **明暗切换**：三态循环（跟随系统 → 亮 → 暗），存在 localStorage，首屏有一小段内联脚本防止白闪。
- **光标**：`scripts/make-fish-cursor.mjs` 从 `other/fish-ref.webp` 抠出角色上半身（泛洪去白底），平滑缩放到 96×96，左上角叠一个矢量箭头做指向。三态分别是默认白箭头、hover 黄箭头、输入框蓝 I 形。换角色只改脚本顶部的 `CROP` 和 `SRC`。
- **点击特效**：点击空白处炸开一簇蓝色粒子，链接和按钮上不触发，移动端自动关闭。
