# 个人博客：主页内容与架构设计

> 版本 v1.0 ｜ 技术栈：Astro 7（静态生成）＋ Markdown/MDX ｜ 部署：GitHub Pages
>
> 本文是**先设计后实现**的产物：先定义主页讲什么、站点怎么组织、数据怎么流动，再落到代码。

---

## 1. 定位与设计目标

| 维度 | 决策 | 理由 |
| --- | --- | --- |
| 站点类型 | 个人技术博客 ＋ 轻量作品集 | 既能沉淀长文，也能让访客快速认识"人" |
| 渲染方式 | 纯静态生成（SSG），零后端 | 秒开、免运维、SEO 友好、GitHub Pages 免费托管 |
| 写作格式 | Markdown（`.md`）为主，MDX（`.mdx`）可选 | 写作零成本；需要交互组件时无缝升级 |
| 内容分发 | 站内网页 ＋ **微信公众号**双通道 | 一文双发：网页版保排版，公众号版保触达 |
| 互动 | 评论 Provider 抽象层（默认 giscus 就绪，可一键开启） | 静态站点无需服务端即可拥有评论 |
| 个性化 | 所有身份信息集中在 `site.config.ts` | 换名字/换域名只改一处 |

**非目标**：不做富文本后台、不做多用户、不引入数据库与登录体系。

---

## 2. 主页内容设计

> 注：本节是 v1 的主页规划，**已被 §14 取代**。现在的主页是 PaperMod 的
> 「一张欢迎卡片 + 若干条目卡片」，顶栏菜单是 Posts / Archive / Search / Tags / FAQ。
> 保留原文以便对照演进过程。

主页是"三秒钟让人知道你是谁、你在写什么、下一步点哪里"。从上到下 7 个区块，每个区块都有明确任务：

```
┌──────────────────────────────────────────────────────────┐
│ [1] 顶栏 Header                                           │
│     站名 · 首页 文章 分类 标签 关于 · RSS · 搜索 · 主题切换   │
├──────────────────────────────────────────────────────────┤
│ [2] Hero 个人介绍（非对称 7:5，左文右图）                   │
│     身份行（算法工程师）· 姓名标题 · 引导语一句话            │
│     右侧真实照片（4:5，带尺寸防抖动）                        │
│     CTA：看文章（实心按钮） ｜ 关于我（文字链接）            │
├──────────────────────────────────────────────────────────┤
│ [3] 精选文章 Featured（1 篇主推，可配 featured）            │
├──────────────────────────────────────────────────────────┤
│ [4] 博客分类 Categories（Bento，5 格 = 5 个分类）           │
│     1 格带真实配图 + 4 格文字（名称 / 篇数 / 简介 / 最近）  │
├──────────────────────────────────────────────────────────┤
│ [5] 最新文章 Latest（双栏索引，超过 5 条不用单列长列表）    │
│     日期 │ 标题 + 摘要 │ 阅读时长            → 查看全部      │
├──────────────────────────────────────────────────────────┤
│ [6] 标签云 Tags ＋ 页脚（品牌行 + 3 行横向排列）             │
└──────────────────────────────────────────────────────────┘
```

### 各区块内容规格

**[1] Header（全局）**：粘性吸顶 + 细分隔线。导航为纯文字（当前页用下划线标记，不用胶囊底色），由 `site.config.nav` 驱动；移动端折叠为下拉面板。右侧为 RSS、全文搜索（构建期索引 JSON，纯前端过滤）与明暗主题切换（记忆到 localStorage）。

**[2] Hero 个人介绍**：字段全部来自 `site.config.author`（`status` 作身份行，`lead` 作引导语，`photo` 作右侧图）：
- `name` / `photo`（真实照片）/ `tagline`（一句话签名）
- `bio`：2~3 行自我介绍（我是谁、做什么、关心什么）
- `location` / `jobTitle` / `company`
- `status`：当前状态徽章，如"正在写 Astro 系列"
- `socials[]`：GitHub、微信公众号、邮箱、X、RSS

**[4] Featured 精选**：`featured: true` 的文章；无标记时自动取最新 3 篇。1 张主推卡（标题更大）+ 2 张普通卡，只用细边框与留白区分，不使用封面图与色块。

**[5] Categories 分类**：**这是主页的核心发现入口**。分类是人工维护的固定集合（见 §4.3），每类固定语义，避免标签式噪音。以**行式列表**呈现（不用彩色卡片）：名称 + 篇数、简介、最近一篇文章标题，点击进入分类归档页。

**[6] Latest 最新文章**：默认 6 篇，行式列表呈现。每条含：发布日期、标题、`description` 摘要、阅读时长。不再叠加分类/公众号/标签徽章，分类与标签在各自主页出现即可。

**[6] 标签云 / Footer**：标签是纯文字 + hairline 的标签场（频次以等宽数字标注，不做字号加权）；页脚为品牌行 + 3 行横向排列（关于 / 导航 / 分类）+ 版权行，不含构建时间戳与版本号。

> 站点不设统计信息条与订阅区：主页只保留内容入口，页脚承担导航与联系。

---

## 3. 信息架构：站点地图与路由

```
/                         主页（§2 的 7 个区块）
/posts/                   全部文章列表（分页 + 分类筛选 + 搜索）
/posts/<slug>/            文章详情
/posts/page/2/            列表分页
/categories/              分类总览（含每类文章数）
/categories/<category>/   单分类归档
/tags/                    标签总览（按频次）
/tags/<tag>/              单标签归档
/about/                   关于我（长版介绍、经历时间线、联系方式、公众号）
/search/?q=               搜索页（复用构建期索引）
/404                      未找到
/rss.xml                  RSS 订阅
/sitemap-index.xml        Sitemap（@astrojs/sitemap 生成）
```

**URL 约定**：全小写、连字符分隔；分类与标签使用英文 slug（`信贷模型 → credit`），中文标题只出现在页面文案里。文章 slug 由文件名决定（`credit-scorecard-pipeline.md → /posts/credit-scorecard-pipeline/`），保证 URL 稳定不被标题改名影响。

**导航层级**：任何页面到主页 ≤1 次点击，到文章 ≤2 次点击（分类作为主干，标签作为横向切片）。

---

## 4. 内容数据模型

### 4.1 文章 Frontmatter（`src/content/blog/*.md`）

```yaml
---
title: 用 Astro 搭一个能一键同步公众号的博客   # 必填
description: 一句话摘要，用于卡片/SEO/公众号 digest  # 必填
pubDate: 2025-01-12                            # 必填
updatedDate: 2025-02-03                        # 选填
category: credit                               # 必填，必须是 site.config 里定义的 slug
tags: [Astro, 静态站点, 公众号]                  # 选填
cover: /images/cover-a.svg                     # 选填；缺省不加封面（保持单色克制）
draft: false                                   # 选填，true 不进生产构建
featured: false                                # 选填，true 上主页精选
series: Astro 实战                              # 选填，系列名
wechat:                                        # 选填，公众号覆盖字段
  title: 我把博客改成了 Astro，顺手做了公众号一键同步
  digest: 静态博客双通道分发的完整实践
  author: 你的笔名
  enable: true                                 # 是否允许导出（默认 true）
---
正文 Markdown…
```

`cover` 为可选项：列表与卡片默认不显示封面。需要封面时用普通图片（不做渐变遮罩等装饰）。

### 4.2 站点配置 `site.config.ts`（单一事实来源）

```
site      : 标题、描述、url、base、语言、时区、分页大小
author    : 姓名、头像、签名、bio、职位、公司、地点、状态、社交链接
nav       : 导航数组
categories: 分类定义数组（slug/name/description）
comments  : provider 选择与 giscus 配置
wechat    : 导出模板开关（页脚引导、作者行、代码块风格）
features  : 搜索/暗色模式/RSS/阅读时长/TOC 开关
```

### 4.3 分类定义（固定 5 类，可增删）

| slug | 名称 | 内容定位 |
| --- | --- | --- |
| `credit` | 信贷模型 | 评分卡、风控建模、KS 与 AUC、贷后监控 |
| `bigdata` | 大数据 | Spark、Flink、特征平台、数据质量 |
| `nlp` | NLP | 文本建模、信息抽取、大模型落地 |
| `recsys` | 推荐算法 | 召回排序、冷启动、实验设计 |
| `reading` | 读书笔记 | 算法与工程书籍的摘录与批注 |

新增分类只需在 `site.config.ts` 的数组里加一项并建一篇对应文章，路由与主页卡片自动生成。

---

## 5. 技术架构

### 5.1 渲染与构建流程

```
作者写 src/content/blog/*.md
        │
        ▼  Astro Content Layer（构建期类型校验）
   ① schema 校验（zod）：缺字段或分类不存在 → 构建失败并报错
        │
        ▼
   ② Markdown 管线（Astro 7 默认处理器 Sätteri）：
      内置：GFM（表格/任务列表/删除线/脚注）+ 智能标点 + Shiki 双主题代码高亮
      自研 hast 插件 heading-anchors：生成标题 id 并给 h2~h4 追加 # 锚点
        │
        ▼
   ③ SSG 生成静态 HTML（主页/列表/分类/标签/详情/RSS/Sitemap/搜索索引）
        │
        ▼
   ④ scripts/export-wechat.mjs 后处理
      dist/posts/<slug>/index.html → 抽取正文 → juice 内联样式 → dist/wechat/<slug>.html
        │
        ▼  部署到 GitHub Pages（Actions）
```

### 5.2 目录结构

```
personal_web/
├─ site.config.ts               # 站点唯一配置源
├─ astro.config.mjs             # 集成、markdown 管线、base 路径
├─ src/
│  ├─ content.config.ts         # 内容集合 schema
│  ├─ content/blog/*.md|mdx     # 文章
│  ├─ layouts/                  # BaseLayout / PostLayout / PageLayout
│  ├─ components/               # Hero、PostCard、CategoryCard、TOC、Search、Comments、WeChatExport…
│  ├─ lib/                      # posts.ts（查询）、toc.ts、reading-time.ts、search-index.ts、wechat.ts
│  ├─ pages/                    # 路由（文件即路由）
│  ├─ styles/                   # papermod/（上游原样）+ papermod.css + site.css + wechat.css
│  └─ scripts/wechat-copy.ts    # 浏览器端公众号复制（客户端插件）
├─ scripts/                     # export-wechat.mjs（构建期导出）
│                               # new-post.mjs（新建文章脚手架）
│                               # wechat-smoke-test.mjs（导出运行时回归测试）
├─ public/                      # favicon、静态资源、.nojekyll
├─ docs/                        # 本设计文档、公众号指南
└─ .github/workflows/deploy.yml # GitHub Pages 自动部署
```

### 5.3 关键设计取舍

1. **纯静态**：评论与公众号导出都不需要服务端 → 无运维成本，访问速度取决于 CDN。
2. **分类固定、标签自由**：分类承担"栏目"职责（导航骨架），标签承担"关键词"职责（横向关联），避免两套体系互相污染。
3. **公众号导出做两条路**：
   - **写作时**：文章页右上角"复制到公众号"按钮 → 浏览器内把正文计算样式内联 → 写入剪贴板 `text/html` → 直接粘进公众号编辑器，排版即所见。
   - **构建后**：`npm run build` 自动产出 `dist/wechat/<slug>.html`，可直接全选复制或导入第三方编辑器。
4. **评论 Provider 抽象**：`Comments.astro` 只读 `site.config.comments`，`provider: 'none' | 'giscus'`，切换不改页面代码。

---

## 6. Markdown 能力矩阵

| 能力 | 语法 | 站内 | 公众号导出 |
| --- | --- | --- | --- |
| 标题 1~6 | `#`~`######` | ✅ 锚点+TOC | ✅ 内联字号/加粗 |
| 粗体/斜体/删除线 | `**b**` `*i*` `~~d~~` | ✅ | ✅（删除线降级为灰字） |
| 有序/无序/嵌套列表 | `-` `1.` | ✅ | ✅（`section` 还原） |
| 引用块 | `>` | ✅ | ✅ |
| 表格（GFM） | `\| a \|` | ✅ | ⚠️ 转为内联样式表格，公众号编辑器支持 |
| 任务列表 | `- [x]` | ✅ | ✅（转 ✅/⬜ 文本） |
| 围栏代码块 | ` ```ts ` | ✅ Shiki 高亮 | ✅ 预格式化 + 内联色，保留换行 |
| 行内代码 | `` `x` `` | ✅ | ✅ |
| 图片 | `![alt](url)` | ✅ 懒加载 | ✅ `max-width:100%`（外链需公众号自传图） |
| 链接 | `[t](url)` | ✅ | ⚠️ 公众号仅允许公众号文章链接 |
| 脚注 | `[^1]` | ✅ | ✅ 转文末注释 |
| 数学公式 | `$x$` | 可选接入 KaTeX | ❌ 建议降级为图片 |
| MDX 组件 | import 组件 | ✅ | ⚠️ 导出为 HTML 静态部分 |

---

## 7. 微信公众号导出设计

### 7.1 为什么不能直接复制网页

公众号编辑器是一个受限的内联样式环境：它**丢弃 `<style>` 与 class**，只认元素上的 `style` 属性；且对 `div` 支持差，偏好 `section`。因此网页版 HTML 直接粘贴会掉排版。

### 7.2 浏览器端一键复制（写作时）

`src/scripts/wechat-copy.ts`：克隆正文 DOM → 逐元素读取 `getComputedStyle` → 按白名单（字体、字号、行高、颜色、背景、边距、边框、圆角、对齐…）写回 `style` → 做公众号兼容改造（`div→section`、`pre` 换行保护、`h1~h6` 重设字号、图片居中、表格补边框、去掉锚点链接）→ 通过 `ClipboardItem` 同时写入 `text/html` 与 `text/plain` → 提示"已复制，去公众号粘贴"。降级方案：`execCommand('copy')` 与"下载 HTML"。

### 7.3 构建期导出（备份/批量）

`scripts/export-wechat.mjs`：读取 `dist/posts/*/index.html` → 用 `cheerio` 抽出 `[data-wechat-article]` 正文并做公众号化改造（`div→section`、打 `wx-*` 类、复选框转文本、代码 token 取浅色值）→ `juice` 把 `src/styles/wechat.css` 内联成行内样式 → 套用导出模板（建议标题/摘要、一键复制、下载 HTML、全选正文）→ 输出 `dist/wechat/<slug>.html` 与目录页 `dist/wechat/index.html`。导出页内联了与站内按钮同一份运行时，因此**双击本地文件也能一键复制**。

### 7.4 排版规范（公众号侧）

正文 16px / 行高 1.75 / 段间距 16px / 中性灰阶 + **唯一强调色**（与站点同色，用于链接）；`##` 小标题用底部细线而非彩色竖条；代码块浅底保留语法着色；引用块左侧细灰线、无底色。规范集中在 `src/styles/wechat.css`（导出）与 `src/scripts/wechat-runtime.js` 的 `SPEC`（一键复制），两份参数保持同步。

---

## 8. 评论方案（Provider 抽象）

```ts
// site.config.ts
comments: {
  provider: 'none',        // 'none' | 'giscus'（预留 waline / twikoo）
  giscus: { repo, repoId, category, categoryId, mapping: 'pathname', theme, lang }
}
```

- `provider: 'none'`：渲染占位卡片，提示"评论功能已预留，去 config 开启"，并给出接入文档链接。
- `provider: 'giscus'`：`Comments.astro` 动态注入 giscus script，宿主为 GitHub Discussions → 与 GitHub Pages 同一账号体系，零成本零后端，主题跟随站点明暗切换。
- 抽象方式：`Comments.astro` 内 `switch(provider)` 分发到 `GiscusComments.astro` / 未来 `WalineComments.astro`；页面层不感知实现。

---

## 9. GitHub Pages 部署

1. 仓库 `yourname/my-blog`，Settings → Pages → Source 选 **GitHub Actions**。
2. `.github/workflows/deploy.yml`：Node 22 → `npm ci` → `npm run build` → `npm run verify:theme && npm run audit && npm run test:wechat` → `upload-pages-artifact`（含 `dist/wechat`）→ `deploy-pages`。
3. **站点地址由仓库名决定，代码改不了它**：

   | 仓库名 | Pages 地址 | `site.base` |
   | --- | --- | --- |
   | `<user>.github.io`（用户站点） | `https://<user>.github.io/` | `'/'` |
   | 普通名字（如 `blog`） | `https://<user>.github.io/<repo>/` | `'/<repo>'` |
   | 任意仓库 + 自定义域名 | `https://你的域名/` | `'/'` |

   本项目已按第一条落地：仓库从 `blog` 改名为 `YunJiao-Chen.github.io`，
   主页因此挂在 `https://yunjiao-chen.github.io/`。改名时同步了 `site.config.ts` 里
   giscus 的 `repo`（`repoId` 是数字 ID 不变，历史评论不丢）；旧的项目站点地址
   `https://yunjiao-chen.github.io/blog/` 不再由本仓库提供。

4. 所有内链走 `withBase()` 或 `import.meta.env.BASE_URL`，CI 里由 `actions/configure-pages` 注入真实的 `BASE_PATH`，换仓库 / 换域名 / 改名都自动适配。`site.config.ts` 的 `base` 默认值只是本地构建用的，目标状态是根地址因此默认 `'/'`；本地想复现线上项目站点就设 `BASE_PATH=/blog`。自检会从构建产物里反推 base，再断言 sitemap / RSS 的绝对地址与它一致（能抓住漏 base 与残留旧 base 两种情况）。
5. `public/.nojekyll` 防止下划线目录被 Jekyll 忽略；Astro 产物无需 Jekyll。
6. 站点 `url`/`base` 支持环境变量覆盖（`SITE_URL`、`BASE_PATH`），CI 中可直接注入，无需改代码。
7. 可选：自定义域名 `public/CNAME`；RSS 与 sitemap 使用绝对地址需与 `site` 一致。

---

## 10. SEO / 性能 / 可访问性

- **SEO**：每页独立 `<title>`/`description`/canonical/OG/Twitter 卡片；文章输出 `BlogPosting` JSON-LD（含 `datePublished`、`author`、`keywords`）；RSS + sitemap 自动生成。
- **性能**：零框架 JS（仅搜索、主题切换、复制按钮为极小脚本）；图片懒加载；CSS 单文件内联关键部分；字体使用系统栈（中文站点避免 Web Font 体积）。
- **可访问性**：语义标签（`header/main/article/nav/footer`）、跳转到正文链接、键盘可达、`prefers-color-scheme` 与手动切换兼顾、对比度 ≥ 4.5:1。
- **搜索**：构建期生成 `search-index.json`（标题/摘要/分类/标签/纯文本前 N 字），客户端输入即过滤，避免引入全文搜索库。

---

## 11. 视觉设计系统（v2：从"装饰驱动"改为"排版驱动"）

初版视觉用了多套装饰（分类渐变卡片、彩色图标块、渐变封面、绿色公众号徽章、渐变标题文字），
落地后反馈"排版太乱"。v2 的取舍是把**秩序交给排版与留白**：

| 维度 | v1（已废弃） | v2（当前） |
| --- | --- | --- |
| 颜色 | 强调色 + 5 个分类色 + 公众号绿 + 渐变 | **单一强调色**（`--accent`），其余全部中性灰阶 |
| 分类 | 5 张彩色卡片（渐变图标块 + 顶部彩条） | 行式列表：名称 + 篇数 + 简介 + 最近更新 |
| 封面 | 按分类生成的渐变封面块 | 默认无封面，可选普通图片 |
| 徽章 | 分类徽章 + 公众号徽章 + 标签片叠加 | **每处最多一个中性标签**，元信息用「文字 + ·」 |
| 区块分隔 | 背景交替条纹（`--bg-soft` + border） | 统一白底 + 顶部细线（`.section`） |
| 标题装饰 | 左侧渐变竖条 + 下划线双重装饰 | 只用一条下划线（或什么都不加） |
| 字距/字号 | 各处手写（0.72~3rem 混用） | 统一字号阶 `--fs-xs … --fs-3xl` |
| 间距 | 手写 0.7/1.1/1.35/1.75/2/3.5/4.5rem | 统一间距阶 `--sp-1 … --sp-9`（8px 基准） |
| 圆角/投影 | 4 档圆角 + 3 档投影 | 3 档圆角 + 仅 hover 一档极轻投影 |
| 模板内联样式 | 散落各处 | **0 处**（改用具名工具类 `.mt-5` / `.is-muted` 等） |

> 注：本节记录的是 v2 当时的做法。v5 起令牌由主题提供
> （`src/styles/papermod/core/theme-vars.css`），自定义只在 `src/styles/site.css`，
> 见 §14。下面保留原文以便看清演进过程。
改配色只需替换 `--accent` 与中性阶；改版心只需改 `--page-max` / `--prose-max`。

---

## 12. 视觉设计系统 v3：用 design-taste-frontend 重做

v2 解决了"颜色与装饰太多"的问题，但把它做成了纯文字页面：没有真实图片，没有动效，
布局族重复，hero 塞了 6 个文本元素。v3 引入
[`design-taste-frontend`](https://github.com/Leonxlnx/taste-skill) 规范
（本地安装在 `.dsh/skills/design-taste-frontend/`），按它的流程重做了一遍。

### 12.A 设计读法与拨盘（skill §0.B / §1）

```
Reading this as: 个人技术博客 + 作品集，面向同行工程师与面试官，
                 编辑技术风格（有秩序、无装饰），
                 原生 CSS + 自托管 Geist + 系统 CJK，Astro 静态站点。
DESIGN_VARIANCE 6 · MOTION_INTENSITY 4 · VISUAL_DENSITY 5
```

拨盘不是直接取默认值：改造前实测是 4 / 2 / 3，按 skill §1.A 的
"redesign overhaul = VARIANCE +2、MOTION +2"得到 6 / 4 / 3，
正好落在它给出的 Editorial / Blog 预设上。
随后按用户反馈"内容紧凑一些"做了一次对话式覆盖（skill §1.A 明确允许）：
`VISUAL_DENSITY` 由 3 提到 5，区块纵向间距从 5rem 收到 2.5rem，
hero 标题从 40 到 60px 收到 36 到 48px，其余间距阶同比例下调。

**技术栈偏差（诚实说明）**：skill 的默认栈是 React / Next.js + Tailwind v4 + Motion。
本项目是 Astro 静态站点，要满足 GitHub Pages 部署、Markdown 内容集合、公众号导出与零 JS 预算，
因此只移植它的**设计规则**（§4 设计工程指令、§9 反 AI 味清单、§14 交付前自检），实现仍用原生 CSS。
这正是 skill §2.B 允许的路径：当需求是一种"审美方向"而不是某个设计系统时用原生 CSS 构建，
并在注释里写清哪些是借来的灵感。

### 12.B 主页布局族（每族只出现一次，skill §4.7 Section-Layout-Repetition Ban）

| 顺序 | 区块 | 布局族 | 说明 |
| --- | --- | --- | --- |
| 1 | Hero | 非对称分栏 7:5 | 左文右图，图是真实照片，文本元素严格 4 个 |
| 2 | 精选 | 图文分栏（方向与 hero 相反） | 标签在图片下方，不压在图上 |
| 3 | 最新文章 | 双栏媒体行 | 6 条，每条带 4:3 缩略图，避免单列 hairline 长列表 |
| 4 | 分类 | Bento 5 格（浅色区块） | 1 个带真实配图的大格 + 4 个文字格；同主题浅色底制造节奏 |
| 5 | 标签 | 相对两栏 | 左标题右标签场，填补横向空白 |
| 6 | 页脚 | 品牌行 + 3 行横向排列 | 关于 / 导航 / 分类各占一行，行内横向排布 |

### 12.C 与 v2 的关键差异

| 维度 | v2 | v3 |
| --- | --- | --- |
| 图片 | 完全无图（纯文字） | Hero 人像 + 每篇文章封面 + 分类配图，构建产物中共 75 处真实照片引用 |
| 字体 | 系统字体栈 | 自托管 Geist Variable + Geist Mono（82 KB，latin 子集），CJK 回落系统字体 |
| 图标 | 18 条手写 SVG 路径 | Tabler Icons 官方图标库，线宽统一 1.75 |
| 强调色 | 靛蓝 #3559d9（饱和度偏高） | 电蓝 #1d4ed8，HSL 饱和 76%，对白底 6.54:1 |
| 动效 | 仅 hover | 入场动效（IntersectionObserver + CSS 过渡）与触觉反馈，全部尊重 reduced motion |
| 交互态 | 只有成功态 | 搜索弹层补齐加载骨架、空状态、错误重试三态 |
| 无障碍 | text-subtle 3.1:1（不达标） | 全 token 逐对校验，最低 4.66:1，正文 18:1 |
| 文案 | 破折号 35 处、中点成串、hero 6 个文本元素 | 破折号 0、每行最多 1 个中点、hero 4 个文本元素 |

### 12.D 交付前自检（已脚本化）

> 注：本节记录 v3 当时的口径。v5 移植 PaperMod 后规则已重写，当前是 **51 项**
> （见 §14.D 的说明）。下面保留原文以便看清演进过程。

`npm run audit` 把 skill §14 的 Pre-Flight Check 变成可执行断言：

- **A 对比度**：逐 token 计算 WCAG，浅色与深色各若干对，外加纯黑禁令
- **B 文案**：破折号零容忍、中点配额、CTA 意图唯一、版本号页脚、地区时间条、滚动提示、emoji
- **C 结构**：真实图片、hero 元素数、圆角来源、z-index、内联样式、手绘 SVG、reduced motion、scroll 监听、字体栈、页内锚点有效性、base 与 sitemap/RSS 一致性、顶栏可达性

当前状态：**54 / 54 通过**。任何一项失败脚本都会以非零码退出，可以直接接进 CI 当门禁。

---

## 13. 参考研究与改版（v4：对着真实站点做取舍）

v3 的问题不是"乱"，而是"平"：纯白背景、饱和度 54% 的松绿、首屏一张大竖图配四行字，
整页信息密度低。这一版先抓真实站点量数据，再按共性改，不凭感觉配色。

### 13.A 实测数据（抓取各站 CSS 统计而来）

| 站点 | 背景 | 正文色 | 唯一强调色 | 字体 | 阅读栏宽 |
| --- | --- | --- | --- | --- | --- |
| Eugene Yan（ML/推荐系统） | 白 | CSS 变量 | `#007bff` 蓝 | Merriweather 衬线 + Raleway | 960 / 1140px |
| Chip Huyen（ML 系统） | `#fdfdfd` | `#111` | `#d14` 绯红 | 系统 | 800px |
| Vicki Boykis（数据/ML） | `#fff` | `#444` | `#3273dc` 蓝 | Verdana | — |
| Simon Willison | 白 | 变量 | `#4dbb7a` 绿 + `#2d2640` | Georgia 衬线 + Helvetica | 940 / 800px |
| Craig Mod（长文） | 暖纸 `--paper` | `--ink` | `#3a7ac7` 蓝 | 衬线 + 无衬线变量 | 768px |
| Robin Rendle | `#fcfcfd` | `#111113` | 中性 token | 无衬线变量 | 带侧栏 |
| Julia Evans | 白 | `#000` | `#ff7e3e` 橙 | Montserrat | 531 / 865px |
| Lilian Weng（ML 研究） | theme 变量 | — | `#286ee0` 蓝 | 系统 | academic 主题 |

提炼出的四条共性：

1. **背景是近白偏灰，不是纯白**（`#fdfdfd` / `#fcfcfd` / 暖纸），白色留给卡片形成层次。
2. **只有一个高饱和强调色**：8 个站点里 4 个用蓝，其余用绯红 / 橙 / 绿，饱和度普遍在 75% 以上。
3. **正文比标题浅一档**（标题 `#111`，正文 `#444`），长文阅读更柔和。
4. **版式列表主导、装饰极少**：阅读栏 600 到 800px，首屏尽快进入文章，而不是摆一张大图。

### 13.B 这一版改了什么

| 维度 | v3 | v4 |
| --- | --- | --- |
| 背景 | 纯白 `#ffffff` | 近白偏灰 `#fcfcfd`，卡片保持纯白形成层次 |
| 强调色 | 松绿 `#30685a`（HSL 54%） | 电蓝 `#1d4ed8`（HSL 76%，对底 6.54:1；深色 `#8ab0ff` 8.96:1） |
| 正文色 | 与标题同色 `#14171c` | 新增 `--text-body` `#2f333b`（比标题浅一档，12.4:1） |
| 首屏 | 8:4 分栏 + 1:1 大图 | **紧凑身份带**：4.5rem 圆形头像 + 身份 + 名称 ｜ 引导语 + 按钮，首屏即见文章 |
| 分类区 | 白底 | 同主题浅色底（`--surface`），形成白 / 浅 / 白节奏 |
| 自检项 | 50 项 | 54 项（新增 `--text-body` 两组对比度；饱和度改用 CSS 标准的 HSL 定义） |

**技术侧的两处修正**：原来"饱和度 < 80%"用的是 HSV 算法，会误杀参考站那种合规的电蓝；
已改为 CSS 标准的 HSL 定义（`#1d4ed8` = 76%）。favicon 与 OG 分享图同步换成新强调色。

> 注：v5 取消了强调色，favicon 已改成 ☕️（见 §14.E）；`public/og-default.svg` 仍是
> 这一版的蓝色渐变，尚未同步。

### 13.C 没有跟着改的地方（以及原因）

- **没有换衬线正文**：参考站里 5 个用衬线（Merriweather / Georgia / 变量 serif），观感更编辑化；
  但中文正文用衬线要依赖 Songti SC / SimSun 等系统字体，Windows 上易退化成点阵宋体，
  风险大于收益。英数用 Geist、中文回落系统无衬线的组合保持不变；
  若要做，需自托管思源宋体子集（约 3 到 6 MB）。
- **没有引入侧栏**：Robin Rendle 与 academic 主题用侧栏，但本站是"内容 + 目录"结构，
  文章页已有右侧目录栏，再加身份侧栏会让窄屏更挤。
- **没有照抄任何单站**：只取共性（近白底、单一鲜艳强调色、正文浅一档、列表主导），
  不复制具体站点的布局或品牌元素。


---

## 14. PaperMod 移植（v5：从"照着抄"到"用真主题"）

参考对象：**Lilian Weng 的 Lil'Log**（<https://lilianweng.github.io/>），确认她用的是
**Hugo PaperMod**（`stylesheet.min.<hash>.css` + integrity 属性）。

中间走过一段弯路：v5 的前半程是"对着截图手抄 CSS"，结果是"像但不到位"。
真正解决问题的是换思路：**不要模仿，直接移植**。本版把 PaperMod 的样式表整份搬进
`src/styles/papermod/`，组件按主题的 class 契约重写，只保留主题没有的功能件。

### 14.A 移植范围与来源

| 项 | 值 |
| --- | --- |
| 上游 | <https://github.com/adityatelange/hugo-PaperMod>（MIT，13.9k stars） |
| 版本 | `d3768854`（2026-08-02），`assets/css/` 下的 18 个文件 |
| 落地位置 | `src/styles/papermod/**`，引入顺序见 `src/styles/papermod.css` |
| 一致性 | 逐字节相同，`src/styles/papermod/MANIFEST.json` 存 sha256 |
| 校验 | `npm run verify:theme`（离线查哈希，`--upstream` 额外抓上游比对），已进 CI |
| 署名 | 每个 CSS 产物的开头都带 `core/license.css` 的 MIT 声明；另见 `docs/THIRD-PARTY.md` |

引入顺序完全照主题的 `head.html`：
`license → theme-vars → reset → common/* → chroma-styles → chroma-mod → zmedia → extended`。
本站自己的样式在 `src/styles/site.css`，**放在主题之后**加载。

**规矩：不给 `src/styles/papermod/` 里的文件做任何就地修改。**
要改外观，只能在 `site.css` 里追加覆盖，否则下次同步上游就会悄悄丢掉改动。
`verify:theme` 就是这条规矩的执行者。

### 14.B 标记契约（这一版真正对齐的东西）

"像不像"不取决于配色，取决于 class 是否落在主题选择器上。本版按主题模板逐一对齐：

| 页面 / 区块 | PaperMod 结构 |
| --- | --- |
| 骨架 | `body#top[.list]` · `header.header > nav.header-nav` · `main.main` · `footer.footer` |
| 主题切换 | `.logo-switches > button#theme-toggle.theme-toggle > svg.moon / svg.sun`，状态在 `html[data-theme]` + `localStorage["pref-theme"]` |
| 首页 | `article.first-entry.home-info`（`h1` + `.entry-content.md-content` + `.entry-footer > .social-icons`） |
| 条目卡片 | `article.post-entry`（`.entry-cover` + `.entry-header > h2` + `.entry-content > p` + `.entry-footer` + `a.entry-link` 遮罩） |
| 顶栏 | `.logo > a`（站名取 `site.label`）+ `.logo-switches > #theme-toggle + span.nav-sep`（`|`）+ `ul#menu > li > a > span[.active]`，搜索项是 `li > button.menu-search` |
| 列表头 | `header.page-header > h1 + .post-description`（`body.list`） |
| 内容页 | 关于 / FAQ / 404 走 `article.post-single > header.post-header > h1.post-title`，`body` 不带 `.list` |
| 归档页 | `.archive-year > h2.archive-year-header > a.archive-header-link + sup.archive-count`，月分组 `.archive-month > h3.archive-month-header + .archive-posts > .archive-entry` |
| 文章页 | `article.post-single`（`header.post-header` + `h1.post-title` + `.post-meta` + `details.toc` + `.post-content.md-content` + `footer.post-footer`） |
| 目录 | `details.toc > summary > span.title` + `.inner > ul` |
| 标签 | `ul.post-tags > li > a`；标签总览用 `ul.terms-tags` |
| 上下篇 | `nav.paginav > a.prev / a.next`（`span.title` + `span`） |
| 列表分页 | `footer.page-footer > nav.pagination > a.prev / a.next` |
| 返回顶部 | `a#top-link.top-link.hidden`，居中页脚 |

`a.entry-link` 是主题的关键设计：绝对定位覆盖整张卡片，
所以卡片里不需要嵌套链接，整卡可点、点击区域明确。

### 14.C 主题变量（取自 `core/theme-vars.css`，不是抄来的近似值）

| Token | 浅色 | 深色 |
| --- | --- | --- |
| `--theme`（页面底） | `rgb(255 255 255)` | `rgb(29 30 32)` |
| `--entry`（卡片底） | `rgb(255 255 255)` | `rgb(46 46 51)` |
| `--primary`（标题 / 交互） | `rgb(30 30 30)` | `rgb(218 218 219)` |
| `--secondary`（元信息） | `rgb(108 108 108)` | `rgb(155 156 157)` |
| `--tertiary`（强边框） | `rgb(214 214 214)` | `rgb(65 66 68)` |
| `--content`（正文） | `rgb(31 31 31)` | `rgb(196 196 197)` |
| `--code-bg` | `rgb(245 245 245)` | `rgb(55 56 62)` |
| `--code-block-bg` | `rgb(28 29 33)` | `rgb(46 46 51)` |
| `--border` | `rgb(238 238 238)` | `rgb(51 51 51)` |
| 尺寸 | `--main-width 720px` · `--nav-width 1024px` · `--gap 24px` · `--radius 8px` | 同左 |

两个定义性特征，这一版是**结构性地**成立，而不是模仿出来的：

1. **全站没有强调色。** 链接就是正文色，hover 靠 `box-shadow: 0 1px` / 1px 下划线，
   不变色。v4 的电蓝 `#1d4ed8` 因此彻底移除（自检里有一条专门确认 `site.css` 不再出现 `--accent`）。
2. **列表页底色是 `--code-bg`，卡片是 `--entry`。** 靠 `body.list` 切换；
   深色模式下 `.list` 退回 `--theme`。这就是"卡片浮在浅灰底上"的观感来源。

### 14.D 相对 v4 的变化

| 维度 | v4 | v5（真 PaperMod） |
| --- | --- | --- |
| 样式来源 | 手写 `global.css` + `prose.css` | 上游 CSS 整份移植 + 一层 `site.css` |
| 强调色 | 电蓝 `#1d4ed8` | 无强调色，hover 走下划线 |
| 字体 | 自托管 Geist | 主题的系统字体栈（`-apple-system, BlinkMacSystemFont, …`） |
| 版心 | 导航 75rem · 内容 45rem | 导航 **1024px** · 内容 **720px**，居中 |
| 首页 | 身份带 + 精选 + 索引 + Bento + 标签 5 段 | **欢迎卡片 + 6 张条目卡片 + 全部文章** |
| 文章页目录 | 右侧粘性栏 | 正文上方**可折叠 `<details>`** |
| 文章封面 | 每篇随机占位图 | 默认无图（`images.remoteCovers: false`） |
| 卡片点击 | 标题链接 | 整卡遮罩 `a.entry-link` |
| 自检项 | 55 项（含强调色饱和度、圆角 / z-index token 等） | **52 项**，规则改为面向真主题 |

自检项从 55 降到 47 是**规则重写**而不是删检查：删掉的三类是"手写设计系统"才需要的
约束（强调色饱和度、自建圆角 token 档位、自建 z-index 层级），它们对一份 MIT 主题
没有意义；补上的六类是移植才需要的约束（圆角只来自主题、站内不新增 token、
代码块底色恒为深色、无强调色 token、产物内含第三方许可声明、`verify:theme` 哈希一致）。

### 14.E 保留与偏离（诚实记录）

保留的（都是功能需求，不是装饰）：分类 / 标签页、站内搜索、公众号导出按钮、
giscus 评论、深色模式、`body.list` 之外的页面一律窄栏。

主动偏离的十一处：

| 偏离 | 原因 |
| --- | --- |
| 页脚写「由 Astro 构建，主题 PaperMod」而不是「Powered by Hugo & PaperMod」 | 本站是 Astro，写 Hugo 是假话；PaperMod 的 MIT 要求保留署名，所以照留并给出链接 |
| 搜索入口做成菜单里的一项（`button.menu-search`） | 主题没有站内搜索，但搜索是需求；放进菜单而不是顶栏新增按钮，位置最不突兀 |
| 文章页多了「复制到公众号 / 复制链接」一行（`.post-actions`） | 主题没有，属于本站功能 |
| 窄屏不做汉堡菜单 | 主题本身就是横向滚动菜单，照它来；上一版自建的抽屉按钮已删除 |
| 首页欢迎卡片高度随内容（`.first-entry { min-height: 0 }`） | 主题把它做成 320px（窄屏 260px）的 hero，底下再留 48px。本站引导语只有一句，图标下面会空出一大块；改成内容自适应，边距收到 `--gap`，与卡片间距同一节奏 |
| 首页欢迎语是「👏 来到yjchen's blog」 | 主题的 `home-info` 标题本来就短；文案放在 `site.config.ts` 的 `author.greeting`，不写死在模板里。这是**全站唯一允许带 emoji 的地方**，skill §3.D 的 emoji 禁令因此拆成两条自检：源码里 0 个、渲染结果里最多 1 个且只能在首页 |

| 顶栏菜单用英文（Posts / Archive / Search / Tags / FAQ），站名写作 yjchen's blog | 用户指定，与参考站 Lil'Log 的菜单一致；页面正文仍是中文 |
| 新增 `/archive/` 与 `/faq/` 两个页面 | 菜单需要落点。归档页用主题的 `.archive-*` 类（原样来自 `archive.css`）；FAQ 是一页手写问答 |
| 分类页与关于页不在顶栏里 | 菜单只放用户列的 5 项。两页都没丢，从 FAQ 正文可以点进去，也都在 sitemap 里 |
| 当前页标记改用参考站的写法：`.menu .active { border-bottom: 2px solid }` | 参考站跑的是较早的 PaperMod，它的 active 是「贴在文字下方的 2px 实线」；我们移植的这版改成了 `text-decoration` 缩写 + 0.3rem 偏移，观感明显更轻。行内元素加 `border-bottom` 落在外框底部，不会撑高行盒，所以覆盖掉主题那两行即可 |
| 站点图标改成 ☕️ | v4 那版是蓝色渐变圆角方块 + 字母 Y，属于已经被取消的强调色，在现在的单色主题里是唯一的彩色遗留。新图标是一张只含一个 emoji 文本的 SVG：浏览器用**用户自己的**彩色 emoji 字体渲染，所以仓库里不分发 emoji 字体数据（字体许可清爽），图标也能跟随系统外观。代价是 iOS 主屏图标只认 PNG，这一项没有提供，iOS 会退回站点截图 |
| 停在首页时标记 Posts | 参考站的 Posts 直接指向 `/`，首页即文章列表，所以它的 active 落在 Posts 上。本站首页也是文章列表（欢迎卡片 + 最新 6 篇 + 全部文章），因此照它标记 Posts，站名保持不加标记 |

另外主题的标签总览用 `ul.terms-tags`，分类总览因为要放一句话说明，
改用了 `article.post-entry` 卡片（仍是主题的类，不新增样式）。

**覆盖纪律**：`site.css` 里每一处覆盖主题的地方，都要在这张表里有对应一行并写明原因。
改主题文件本身是禁止的（`npm run verify:theme` 会把 CI 打红）。

## 15. 迭代路线

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| v1 | 站点骨架、分类 / 标签归档、Markdown 全能力、公众号双路导出、GH Pages 部署 | 已完成 |
| v2 到 v4 | 排版主导的视觉系统、参考站研究、品牌标记与密度修正 | 已完成 |
| v5 | **移植 PaperMod 主题**（样式整份引入 + 结构对齐 + 哈希校验进 CI） | 已完成 |
| v5.1 | 真实头像与邮箱、公众号二维码、自定义域名 + CNAME（此时 `base` 改为 `/`） | 待办 |
| v5.2 | 阅读统计（Umami）、系列文章聚合页 | 待办 |
| v6 | 完整 Hugo + PaperMod 迁移（真的用主题而不是移植样式），或 MDX 交互组件、图片自动化 | 待定 |


---

## 16. 实现说明（与设计稿的差异与踩坑记录）

实现完成后回填，便于后续维护者少踩坑：

1. **Markdown 处理器**：Astro 7 默认使用 Sätteri（`@astrojs/markdown-satteri`），`markdown.rehypePlugins` / `remarkPlugins` 已被标记为废弃（需额外安装 `@astrojs/markdown-remark` 才可用 unified 管线）。因此标题锚点改为自研 hast 插件 `heading-anchors`，同时去掉 `rehype-slug`、`rehype-autolink-headings` 两个依赖。

2. **插件执行顺序**：Sätteri 的流水线是「代码高亮 → 用户插件 → 图片标记 → 标题 id 生成」。用户插件运行时标题还没有 id，所以锚点插件**自己生成 id**（复用 `github-slugger`，与 Astro 生成 `headings` 元数据的算法一致），Astro 会沿用已有 id。

3. **目录文案**：锚点若带 `#` 文本，会污染 `headings[].text`（目录里出现 `标题#`）。因此锚点元素保持空文本，`#` 用 CSS `::before` 绘制。

4. **双扩展名端点**：`src/pages/rss.xml.ts`、`src/pages/search-index.json.ts` 这类文件名在 Astro 7 + Vite 8 下**不会被 TypeScript 转换**，写 `import type` 或类型注解会直接构建失败（`builtin:vite-transform Unexpected token`）。这两个文件因此保持纯 JS 语法并加 `// @ts-nocheck`。

5. **代码高亮**：v5 起改用 shiki 的单一深色主题（`github-dark`）。原因是主题的 `--code-block-bg` 本来就是深色块，双主题（浅底 / 深底切换）反而与主题冲突；单一主题也让公众号导出直接沿用字面颜色，不需要 `!important` 覆盖。

6. **内容缓存**：Markdown 渲染结果缓存在 `node_modules/.astro/data-store.json`。修改 `astro.config.mjs` 的 Markdown 管线后必须清缓存（`npm run build:clean`），否则会继续用旧结果。

7. **中文标签路由**：标签作为路径参数保持原文（如 `/tags/写作/`），由浏览器 percent-encode、GitHub Pages 解码匹配；若改成 `encodeURIComponent` 作为目录名会 404。

8. **`base` 路径**：所有内链都经过 `withBase()`；CI 中由 `actions/configure-pages` 注入 `SITE_URL` 与 `BASE_PATH`，本地默认 `/my-blog`，换仓库只需改 `site.config.ts` 或设环境变量。

9. **移植主题的三条硬规矩**（v5 起）：
   1. `src/styles/papermod/**` 只读，任何外观调整都写到 `src/styles/site.css`；
      `npm run verify:theme` 用 SHA256 清单把这条规矩变成 CI 失败。
   2. 能复用主题的 class 就不新增 CSS。v5 里"最近更新 / 全部文章"这类小标题直接用
      `header.entry-header > h2`，正文段落用 `div.post-content.md-content`，
      页脚"回到顶部"沿用 `#top-link`。
   3. 主题的 `data-theme` 是**属性**不是 class（v4 用的是 `html.dark`）。
      首屏脚本读 `localStorage["pref-theme"]`，没有记录时跟随
      `prefers-color-scheme`；`[data-theme="dark"] .moon { display: none }` 靠属性选择器生效，
      所以图标必须原样带上 `moon` / `sun` 类名。

10. **`z-index` 与滚动监听**：主题的 `#top-link` 用 `z-index: 99` 加 `scroll` 监听；
    本站不改主题 CSS，但自己的代码里既不加 `z-index`，也不用 `scroll` 监听
    （改为 `IntersectionObserver` 观察顶栏是否还在视口内）。自检里两条都有对应检查。

11. **`site.css` 里的注释别写 `*/` 序列**：在注释里写 `.entry-*/` 会提前闭合注释，
    后面的内容被当成 CSS 解析，lightningcss 会报 `Unexpected token Delim('/')`，
    报错位置指在注释之后，很难看出真正原因。
