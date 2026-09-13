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

主页是"三秒钟让人知道你是谁、你在写什么、下一步点哪里"。从上到下 7 个区块，每个区块都有明确任务：

```
┌──────────────────────────────────────────────────────────┐
│ [1] 顶栏 Header                                           │
│     Logo/站名 · 首页 博客 分类 标签 关于 · 搜索 · 主题切换   │
├──────────────────────────────────────────────────────────┤
│ [2] Hero 个人介绍（左文右名片，无渐变/光晕）                │
│     状态行 · 姓名标题 · 一句话签名 · 简介 2~3 行            │
│     元信息：职业 · 公司 · 地点 · 持续写作天数               │
│     右侧名片：头像 · 姓名 · 职务 · 社交链接列表             │
│     CTA：开始阅读（实心按钮） ｜ 关于我（文字链接）          │
├──────────────────────────────────────────────────────────┤
│ [3] 数字条 Stats（一条细边框横条，四格等分）                │
│     文章 N 篇 │ 分类 5 个 │ 标签 N 个 │ 持续更新天数        │
├──────────────────────────────────────────────────────────┤
│ [4] 精选文章 Featured（1 篇主推 + 2 篇次推，可配 featured） │
├──────────────────────────────────────────────────────────┤
│ [5] 博客分类 Categories                                   │
│     5 行分类列表：名称 · 篇数 · 简介 · 最近更新            │
├──────────────────────────────────────────────────────────┤
│ [6] 最新文章 Latest（行式列表，细线分隔）                   │
│     日期 │ 标题 + 摘要 │ 阅读时长            → 查看全部      │
├──────────────────────────────────────────────────────────┤
│ [7] 标签云 Tags ＋ 订阅区 Subscribe ＋ Footer              │
└──────────────────────────────────────────────────────────┘
```

### 各区块内容规格

**[1] Header（全局）**：粘性吸顶 + 细分隔线。导航为纯文字（当前页用下划线标记，不用胶囊底色），由 `site.config.nav` 驱动；移动端折叠为下拉面板。右侧为 RSS、全文搜索（构建期索引 JSON，纯前端过滤）与明暗主题切换（记忆到 localStorage）。

**[2] Hero 个人介绍**：字段全部来自 `site.config.author`：
- `name` / `avatar` / `tagline`（一句话签名）
- `bio`：2~3 行自我介绍（我是谁、做什么、关心什么）
- `location` / `jobTitle` / `company`
- `status`：当前状态徽章，如"正在写 Astro 系列"
- `socials[]`：GitHub、微信公众号、邮箱、X、RSS

**[3] Stats**：构建期统计，真实数字增强可信度：文章总数、分类数、标签数、首篇至今天数。

**[4] Featured 精选**：`featured: true` 的文章；无标记时自动取最新 3 篇。1 张主推卡（标题更大）+ 2 张普通卡，只用细边框与留白区分，不使用封面图与色块。

**[5] Categories 分类**：**这是主页的核心发现入口**。分类是人工维护的固定集合（见 §4.3），每类固定语义，避免标签式噪音。以**行式列表**呈现（不用彩色卡片）：名称 + 篇数、简介、最近一篇文章标题，点击进入分类归档页。

**[6] Latest 最新文章**：默认 6 篇，行式列表呈现。每条含：发布日期、标题、`description` 摘要、阅读时长。不再叠加分类/公众号/标签徽章，分类与标签在各自主页出现即可。

**[7] 标签云 / 订阅 / Footer**：标签统一字号的细边框标签（频次只以数字标注，不做字号加权的视觉噪音）；订阅区提供 RSS 与公众号二维码位；Footer 含版权、备案位、构建时间、社交链接。

---

## 3. 信息架构：站点地图与路由

```
/                         主页（§2 的 7 个区块）
/blog/                    全部文章列表（分页 + 分类/标签筛选 + 搜索）
/blog/<slug>/             文章详情
/blog/page/2/             列表分页
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

**URL 约定**：全小写、连字符分隔；分类与标签使用拼音/英文 slug（`前端工程 → frontend`），中文标题只出现在页面文案里。文章 slug 由文件名决定（`my-first-post.md → /blog/my-first-post/`），保证 URL 稳定不被标题改名影响。

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
category: frontend                             # 必填，必须是 site.config 里定义的 slug
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
| `frontend` | 前端工程 | 框架、性能、工程化、CSS |
| `backend` | 后端与架构 | 服务端、数据库、分布式、系统设计 |
| `ai` | AI 与工具链 | 大模型应用、Agent、效率工具 |
| `reading` | 读书笔记 | 技术书与非技术书摘与思考 |
| `life` | 生活随笔 | 随笔、旅行、年度总结 |

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
      dist/blog/<slug>/index.html → 抽取正文 → juice 内联样式 → dist/wechat/<slug>.html
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
│  ├─ styles/                   # global.css / prose.css / wechat.css
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

`scripts/export-wechat.mjs`：读取 `dist/blog/*/index.html` → 用 `cheerio` 抽出 `[data-wechat-article]` 正文并做公众号化改造（`div→section`、打 `wx-*` 类、复选框转文本、代码 token 取浅色值）→ `juice` 把 `src/styles/wechat.css` 内联成行内样式 → 套用导出模板（建议标题/摘要、一键复制、下载 HTML、全选正文）→ 输出 `dist/wechat/<slug>.html` 与目录页 `dist/wechat/index.html`。导出页内联了与站内按钮同一份运行时，因此**双击本地文件也能一键复制**。

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
2. `.github/workflows/deploy.yml`：Node 20+ → `npm ci` → `npm run build` → `upload-pages-artifact`（含 `dist/wechat`）→ `deploy-pages`。
3. **base 路径**：项目站点是 `https://yourname.github.io/my-blog/`，故 `site.config.ts` 的 `base = '/my-blog'`；所有内链走 `withBase()` 或 `import.meta.env.BASE_URL`。使用自定义域名或 `<user>.github.io` 仓库时把 `base` 改为 `'/'`。
4. `public/.nojekyll` 防止下划线目录被 Jekyll 忽略；Astro 产物无需 Jekyll。
5. 站点 `url`/`base` 支持环境变量覆盖（`SITE_URL`、`BASE_PATH`），CI 中可直接注入，无需改代码。
6. 可选：自定义域名 `public/CNAME`；RSS 与 sitemap 使用绝对地址需与 `site` 一致。

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

设计令牌全部定义在 `src/styles/global.css` 顶部（颜色 / 字号阶 / 间距阶 / 半径 / 版心），
文章排版在 `src/styles/prose.css`，公众号排版在 `src/styles/wechat.css`。
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
| 3 | 最新文章 | 双栏索引 | 6 条，避免单列 hairline 长列表 |
| 4 | 分类 | Bento 5 格 | 1 个带真实配图的大格 + 4 个文字格，格子数等于分类数 |
| 5 | 标签 | 标签场 | 纯文字 + hairline，不用一排胶囊 |
| 6 | 统计数据 | hairline 四栏横条 | 放在内容最后收尾，不抢占开篇注意力 |

### 12.C 与 v2 的关键差异

| 维度 | v2 | v3 |
| --- | --- | --- |
| 图片 | 完全无图（纯文字） | Hero 人像 + 每篇文章封面 + 分类配图，共 69 处真实照片引用 |
| 字体 | 系统字体栈 | 自托管 Geist Variable + Geist Mono（82 KB，latin 子集），CJK 回落系统字体 |
| 图标 | 18 条手写 SVG 路径 | Tabler Icons 官方图标库，线宽统一 1.75 |
| 强调色 | 靛蓝 #3559d9（饱和度偏高） | 松绿 #30685a，饱和度 54%，对白底 6.45:1 |
| 动效 | 仅 hover | 入场动效（IntersectionObserver + CSS 过渡）与触觉反馈，全部尊重 reduced motion |
| 交互态 | 只有成功态 | 搜索弹层补齐加载骨架、空状态、错误重试三态 |
| 无障碍 | text-subtle 3.1:1（不达标） | 全 token 逐对校验，最低 4.66:1，正文 18:1 |
| 文案 | 破折号 35 处、中点成串、hero 6 个文本元素 | 破折号 0、每行最多 1 个中点、hero 4 个文本元素 |

### 12.D 交付前自检（已脚本化）

`npm run audit` 把 skill §14 的 Pre-Flight Check 变成 50 项可执行断言：

- **A 对比度**（21 项）：逐 token 计算 WCAG，浅色与深色各 10 对，外加纯黑禁令与饱和度上限
- **B 文案**（7 项）：破折号零容忍、中点配额、CTA 意图唯一、版本号页脚、地区时间条、滚动提示、emoji
- **C 结构**（22 项）：真实图片、hero 元素数、圆角档位、z-index 集中、内联样式、手绘 SVG、reduced motion、scroll 监听、字体自托管、订阅区锚点、统计区块位置

当前状态：**50 / 50 通过**。任何一项失败脚本都会以非零码退出，可以直接接进 CI 当门禁。

## 13. 迭代路线

| 阶段 | 内容 |
| --- | --- |
| v1（本次交付） | 主页 7 区块、分类/标签归档、Markdown 全能力、公众号双路导出、评论抽象层、GH Pages 部署 |
| v1.1 | 开启 giscus、添加真实头像与公众号二维码、自定义域名 + CNAME |
| v1.2 | 阅读统计（Umami）、系列文章聚合页、文章内相关推荐 |
| v2 | MDX 交互组件（图表/演示）、图片自动化（本地图床/图压缩）、公众号草稿箱 API 直发 |


---

## 14. 实现说明（与设计稿的差异与踩坑记录）

实现完成后回填，便于后续维护者少踩坑：

1. **Markdown 处理器**：Astro 7 默认使用 Sätteri（`@astrojs/markdown-satteri`），`markdown.rehypePlugins` / `remarkPlugins` 已被标记为废弃（需额外安装 `@astrojs/markdown-remark` 才可用 unified 管线）。因此标题锚点改为自研 hast 插件 `heading-anchors`，同时去掉 `rehype-slug`、`rehype-autolink-headings` 两个依赖。

2. **插件执行顺序**：Sätteri 的流水线是「代码高亮 → 用户插件 → 图片标记 → 标题 id 生成」。用户插件运行时标题还没有 id，所以锚点插件**自己生成 id**（复用 `github-slugger`，与 Astro 生成 `headings` 元数据的算法一致），Astro 会沿用已有 id。

3. **目录文案**：锚点若带 `#` 文本，会污染 `headings[].text`（目录里出现 `标题#`）。因此锚点元素保持空文本，`#` 用 CSS `::before` 绘制。

4. **双扩展名端点**：`src/pages/rss.xml.ts`、`src/pages/search-index.json.ts` 这类文件名在 Astro 7 + Vite 8 下**不会被 TypeScript 转换**，写 `import type` 或类型注解会直接构建失败（`builtin:vite-transform Unexpected token`）。这两个文件因此保持纯 JS 语法并加 `// @ts-nocheck`。

5. **Shiki 双主题**：`shikiConfig.themes` + `defaultColor: 'light'` 会把浅色 token 写成**字面颜色**，深色覆盖必须用 `!important`（`html.dark .prose .astro-code span { color: var(--shiki-dark) !important }`），否则深色模式下代码块仍是浅色 token。同时这个设定让公众号导出可以直接沿用字面浅色值。

6. **内容缓存**：Markdown 渲染结果缓存在 `node_modules/.astro/data-store.json`。修改 `astro.config.mjs` 的 Markdown 管线后必须清缓存（`npm run build:clean`），否则会继续用旧结果。

7. **中文标签路由**：标签作为路径参数保持原文（如 `/tags/写作/`），由浏览器 percent-encode、GitHub Pages 解码匹配；若改成 `encodeURIComponent` 作为目录名会 404。

8. **`base` 路径**：所有内链都经过 `withBase()`；CI 中由 `actions/configure-pages` 注入 `SITE_URL` 与 `BASE_PATH`，本地默认 `/my-blog`，换仓库只需改 `site.config.ts` 或设环境变量。
