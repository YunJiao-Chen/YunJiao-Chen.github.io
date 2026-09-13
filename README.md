# 个人博客 · Personal Blog

一个用 **Astro 7 + Markdown** 构建的个人博客模板：主页个人介绍、固定分类、标签归档、**一文双发（网页 + 微信公众号）**、可切换的评论系统，一条命令部署到 **GitHub Pages**。

> 设计文档（先设计后实现）：[`docs/DESIGN.md`](docs/DESIGN.md)　公众号导出细节：[`docs/WECHAT.md`](docs/WECHAT.md)　评论接入：[`docs/COMMENTS.md`](docs/COMMENTS.md)

---

## 特性

| 能力 | 说明 |
| --- | --- |
| 主页 | PaperMod 结构：欢迎卡片 + 文章条目卡片 + 全部文章链接（无落地页式分区） |
| 视觉系统 | 单色系（一个强调色 + 中性灰阶）、细线分隔、统一字号/间距令牌；模板内联样式为 0 |
| 设计规范 | 视觉按 Hugo PaperMod（Lilian Weng 站）重做，流程按 [`design-taste-frontend`](https://github.com/Leonxlnx/taste-skill)；55 项可执行自检 |
| Markdown 写作 | GFM 表格、任务列表、脚注、删除线、Shiki 代码高亮（明暗双主题）、标题锚点、自动目录（TOC）、阅读时长 |
| 分类 + 标签 | 分类是固定栏目（导航骨架），标签横向串联；分类页 / 标签页 / 分页 / 时间线全部构建期生成 |
| 站内搜索 | 构建期生成 `search-index.json`，`⌘K` / `Ctrl+K` 打开，纯前端过滤，零服务端 |
| 公众号双路导出 | 文章页「复制到公众号」一键把排版内联后写进剪贴板；构建后另产出 `dist/wechat/<slug>.html` 独立预览页 |
| 评论 | Provider 抽象层：默认占位，配置 4 个字段即可启用 giscus（GitHub Discussions） |
| 部署 | GitHub Actions 一键发布到 GitHub Pages，自动处理 `site` / `base` 子路径 |
| SEO | 每页独立 title/description/canonical/OG/Twitter，文章输出 `BlogPosting` JSON-LD，自动 RSS + sitemap |
| 纯静态 | 产物零运行时框架，明暗主题跟随系统并可手动切换，移动端适配 |

---

## 设计规范

本站视觉按 `design-taste-frontend` 规范重做，安装在本仓库的 `.dsh/skills/design-taste-frontend/`。
关键约定（改动样式前请先读）：

- **拨盘**：`DESIGN_VARIANCE 6` / `MOTION_INTENSITY 4` / `VISUAL_DENSITY 5`（偏紧凑），定义在 `src/styles/global.css` 顶部注释里
- **无强调色**：按 PaperMod 的做法，链接就是近黑 `#1e1e1e`，hover 加 1px 下划线（深色模式 `#dadadb`）
- **字体**：系统字体栈（与参考站一致，不再自托管网络字体）
- **代码块**：恒为深底浅字（`--hljs-bg`，浅色模式下也是），公众号导出同步
- **配色与版式参考**：Lilian Weng 的 Lil'Log（Hugo PaperMod 主题，实测变量见 `docs/DESIGN.md` §14）；上一轮还比对过 Eugene Yan、Chip Huyen、Vicki Boykis、Simon Willison、Craig Mod、Robin Rendle、Julia Evans（§13）
- **形状一致性**：卡片与控件统一 `8px` 圆角（PaperMod 的 `--radius`）
- **页脚**：居中极简（社交图标 + 版权），导航只在顶栏
- **真实图片**：Hero 人像、文章封面、分类配图都是真实照片（`site.config.ts` 的 `images` 段可关掉远程占位）
- **文案红线**：禁止破折号（`——` 与 `–`）、每行最多一个中点、hero 最多 4 个文本元素、不写空泛动词
- **动效**：只用 `opacity` 与 `transform`，全部尊重 `prefers-reduced-motion`，禁止监听 scroll 事件

提交前跑一次门禁：

```bash
npm run build && npm run audit   # 55 项断言，全部通过才允许发布
```

## 快速开始

```bash
npm install
npm run dev          # http://localhost:4321/my-blog/
```

构建与本地预览生产产物：

```bash
npm run build        # 构建站点 + 生成公众号导出页（dist/）
npm run preview      # 预览 dist/
npm run check        # 类型检查（当前 0 error / 0 warning）
```

### 写作

```bash
npm run new -- "我的新文章" --category credit --tags 评分卡,风控
```

会在 `src/content/blog/` 生成带完整 frontmatter 的文件。正文标题从 `##` 开始（`<h1>` 由模板渲染）。

```yaml
---
title: 我的新文章
description: 一句话摘要：用于卡片、SEO 与公众号摘要
pubDate: 2026-09-13
updatedDate: 2026-09-20      # 可选
category: credit              # credit | bigdata | nlp | recsys | reading
tags: [Astro, 性能]
series: Astro 实战            # 可选
featured: false              # true 会进入主页「精选文章」
draft: false                 # true 时生产构建不输出
wechat:                      # 可选：公众号侧覆盖字段
  title: 公众号里更口语的标题
  digest: 公众号摘要
  author: 你的笔名
  enable: true               # false 表示这篇不需要公众号导出
---
```

---

## 个性化配置（改一处即可）

所有身份信息集中在 **`site.config.ts`**：

```ts
site: { title, subtitle, description, url, base, lang, postsPerPage, latestCount }
author: { name, photo, tagline, lead, status, bio[], jobTitle, company, location, email, focus[], socials[] }
nav: [...]                       // 导航
categories: [...]                // 分类（slug / 名称 / 描述）
comments: { provider, giscus }   // 评论
wechat: { showCopyButton, openingLine, signature, followText, accountName }
features: { darkMode, search, rss, readingTime, toc, postNav }
footer: { since, icp, note }
```

常见改动：

- **换成 GitHub Pages 项目站点**：`site.url = 'https://<user>.github.io'`、`site.base = '/<repo>'`（用户站点或自定义域名填 `'/'`）。
- **调整视觉风格**：颜色、字号阶、间距阶、版心全部是 `src/styles/global.css` 顶部的设计令牌；换配色只改 `--accent` 与中性灰阶即可，其余组件自动跟随。改完务必跑 `npm run audit` 确认对比度没掉。
- **换成自己的图片**：人像写 `author.photo = '/portrait.jpg'`，文章封面在 frontmatter 写 `cover: /images/xxx.jpg`（文件放 `public/images/`）。默认用的是 Lorem Picsum 占位照片，把 `images.remoteCovers` 设为 `false` 可完全关闭远程图片。
- **换照片**：照片放进 `public/` 并设置 `author.photo = '/portrait.jpg'`（文章封面用 frontmatter 的 `cover`）。默认用的是 Lorem Picsum 远程占位照片。
- **社交媒体分享图**：默认使用 `public/og-default.svg`。部分平台（微信/Twitter 等）对 SVG 支持有限，建议用 1200×630 的 PNG 替换，并在 `src/components/SEO.astro` 里把默认图路径改成该 PNG。
- **增删分类**：改 `categories` 数组即可，路由、主页卡片、页脚、统计数字会自动跟着变。
- **CI 覆盖地址**：设环境变量 `SITE_URL` / `BASE_PATH`，无需改代码（`deploy.yml` 已自动注入）。

---

## 目录结构

```
├─ site.config.ts            # 站点唯一配置源（身份/导航/分类/评论/公众号）
├─ astro.config.mjs          # 集成、Markdown 管线（Sätteri + 标题锚点插件）、base 路径
├─ src/
│  ├─ content.config.ts      # 内容集合 schema（zod 校验，字段写错直接构建失败）
│  ├─ content/blog/*.md      # 文章（文件名即 URL：/blog/<文件名>/）
│  ├─ layouts/               # BaseLayout / PostLayout / PageLayout
│  ├─ components/            # Hero 区块、卡片、TOC、搜索、评论、公众号导出按钮…
│  ├─ lib/                   # posts.ts（查询层）、utils.ts（日期/阅读时长/文案）
│  ├─ pages/                 # 路由：主页、博客、分类、标签、关于、RSS、搜索索引、404
│  ├─ scripts/               # wechat-runtime.js（浏览器端公众号导出运行时）
│  └─ styles/                # global.css / prose.css / wechat.css
├─ scripts/
│  ├─ taste-audit.mjs        # 设计规范自检（47 项：对比度 / 文案 / 结构）
│  ├─ export-wechat.mjs      # 构建期公众号导出（cheerio + juice）
│  ├─ new-post.mjs           # 新建文章脚手架
│  └─ wechat-smoke-test.mjs  # 导出运行时回归测试（jsdom）
├─ docs/                     # 设计文档与专题指南
└─ .github/workflows/deploy.yml
```

---

## 微信公众号导出

公众号编辑器**只保留元素上的 `style` 属性**，会丢弃 `<style>` 与 class，因此网页版 HTML 直接粘贴必然掉排版。本项目用两条通道解决：

**① 写作时一键复制（推荐）**

文章页右下角「复制到公众号」→ 浏览器克隆正文、逐个元素读取 `getComputedStyle`、按白名单写回行内样式、做兼容改造（`div→section`、复选框转 ✅/⬜、代码块换行保护、图片居中、去掉站内交互元素）→ 通过 `ClipboardItem` 写入 `text/html` → 到公众号后台编辑器直接粘贴。

**② 构建后独立导出页（备份/批量/离线）**

`npm run build` 会在 `dist/wechat/` 产出：

- `<slug>.html`：全内联样式的独立页面，顶部有「复制到公众号 / 下载 HTML / 全选正文」，**双击本地文件即可用**；
- `index.html`：全部导出文章的目录页。

**排版规范**（`src/styles/wechat.css` 与 `src/scripts/wechat-runtime.js` 的 `SPEC`，两处同步）：正文 16px / 行高 1.75 / 段间距 16px / 中性灰阶 + 单一强调色 / `##` 小标题用底部细线 / 代码块浅底（`#f6f8fa`）保留语法着色 / 图片 `max-width:100%` 居中 / 任务列表复选框转成 `[x]` 与 `[ ]` 文本标记。

**注意事项**：图片在公众号需重新上传（外链会被过滤）；公众号只允许跳转公众号文章，外链建议保留为纯文本；数学公式建议改为图片。详见 [`docs/WECHAT.md`](docs/WECHAT.md)。

---

## 评论

默认 `provider: 'none'`（只显示联系入口）。启用 giscus（本仓库已切到 `provider: 'giscus'` 并填好 `repoId`，只差 `categoryId`）：

1. 仓库 Settings → General → Features 勾选 **Discussions**，并新建分类（如 `Announcements`）；
2. 到 [giscus.app](https://giscus.app/zh-CN) 填入仓库，复制 `data-repo-id` 与 `data-category-id`；
3. 在 `site.config.ts` 里设置：

```ts
comments: {
  provider: 'giscus',
  giscus: { repo: 'you/repo', repoId: 'R_xxx', category: 'Announcements', categoryId: 'DIC_xxx', ... }
}
```

评论主题跟随站点明暗切换；想换 Waline/Twikoo 只需在 `src/components/Comments.astro` 增加一个分支，页面层不用改。详见 [`docs/COMMENTS.md`](docs/COMMENTS.md)。

---

## 部署到 GitHub Pages

1. 推送仓库到 GitHub（默认分支 `main`）。
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
3. 打开 `site.config.ts`，把 `site.url` / `site.base` 改成你的地址（或用 CI 环境变量覆盖，`deploy.yml` 已通过 `actions/configure-pages` 自动注入）。
4. push 到 `main`，`Deploy to GitHub Pages` 工作流会构建并发布。

产物包含 `.nojekyll`（避免 Jekyll 处理 `_astro` 目录）、`robots.txt`、`sitemap-index.xml`、`rss.xml`。

部署注意事项：

- **不要重跑历史运行**：每个运行构建的是它自己那个提交的代码，重跑旧运行会把旧代码重新发布上线。
  工作流里有一道 `Guard against stale runs` 守卫，会检查本次运行的提交是否为 `main` 最新提交，不是就直接失败并给出提示。
- 需要重新发布时，用 `main` 最新提交对应那次运行的 **Re-run all jobs**，或者推一个新提交。

---

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发（含草稿文章） |
| `npm run build` | 构建站点 + 公众号导出 |
| `npm run build:site` | 只构建站点 |
| `npm run build:clean` | 清缓存后完整构建（改过 Markdown 管线时用） |
| `npm run wechat` | 重新构建并导出公众号页面 |
| `npm run new -- "标题"` | 新建文章 |
| `npm run test:wechat` | 公众号导出运行时回归测试（18 项断言） |
| `npm run check` | Astro/TS 类型检查 |
| `npm run audit` | 设计规范自检（对比度 / 文案 / 结构共 55 项，接 CI 可当门禁） |
| `npm run preview` | 预览 `dist/` |

---

## 已知坑（已在本模板中处理）

1. **修改 Markdown 管线后必须清缓存**：渲染结果缓存在 `node_modules/.astro/data-store.json`，用 `npm run build:clean`。
2. **双扩展名端点文件只能写 JS 语法**：`src/pages/rss.xml.ts`、`src/pages/search-index.json.ts` 在 Astro 7 + Vite 8 下不做 TS 转换，写 `import type` 会构建失败，因此这两个文件带 `// @ts-nocheck` 并保持 JS 语法。
3. **Shiki 双主题需要 `!important`**：`html.dark .prose .astro-code span { color: var(--shiki-dark) !important }`，否则深色模式代码块仍是浅色 token。
4. **标题锚点的 `#` 用 CSS `::before` 绘制**：否则会污染文章目录的标题文案。
5. **中文标签保持原文作为路径**（`/tags/写作/`），不要手动 `encodeURIComponent` 成目录名，否则 GitHub Pages 会 404。

---

## 许可

代码可自由使用与修改；文章内容版权归作者所有（默认标注 CC BY-NC-SA 4.0，可在 `site.config.ts` 的 `footer.note` 中修改）。
