# 评论系统接入指南

## 当前状态（YunJiao-Chen/blog）

代码侧已全部就绪，`site.config.ts` 里的值：

| 配置 | 值 | 状态 |
| --- | --- | --- |
| `comments.provider` | `giscus` | 已切好 |
| `comments.giscus.repo` | `YunJiao-Chen/blog` | 已填 |
| `comments.giscus.repoId` | `R_kgDOUY1RCA` | 已填（取自 GitHub API 的 `node_id`） |
| `comments.giscus.category` | `Announcements` | 已填 |
| `comments.giscus.categoryId` | 空 | **待补**，补上后评论区立即出现 |

**配置已完成，评论已上线**（2026-09 状态）：

```ts
comments: {
  provider: 'giscus',
  giscus: {
    repo: 'YunJiao-Chen/blog',
    repoId: 'R_kgDOUY1RCA',            // 仓库 node_id
    category: 'Announcements',
    categoryId: 'DIC_kwDOUY1RCM4DFgPJ', // Announcements 分类 node id
    mapping: 'pathname',                // 用页面路径关联讨论，改标题不会丢评论
    strict: false,
    reactionsEnabled: true,
    inputPosition: 'top',
    lang: 'zh-CN',
  },
}
```

仓库侧需要（都已具备）：Discussions 已开启（`has_discussions: true`，默认分类含 Announcements）；
giscus App 需安装在该仓库上，否则评论区会显示 "giscus is not installed on this repository"，
装一次即可：<https://github.com/apps/giscus> → Install → 选择 `blog`。

### 怎么验证是否真的可用

1. 打开任意文章页，滚到「评论与讨论」，能看到 **Sign in with GitHub** 就是正常的。
2. 用 GitHub 账号发出第一条评论时，giscus 会自动在 Announcements 分类下创建该页面的 discussion，
   之后这个页面就与这个讨论绑定（换标题不影响，因为用的是 pathname）。
3. 如果显示安装错误，去上面链接装一次 App；如果显示分类错误，重新到 <https://giscus.app/zh-CN> 取 `categoryId`。

> 评论框的主题会跟随站点明暗切换（组件内用 `MutationObserver` 监听 `html.dark` 并通过 `postMessage` 通知 iframe）。
> `categoryId` 缺失或 `provider` 为 `none` 时，评论区会降级为联系入口，不会渲染坏掉的 iframe。

> 在补上 `categoryId` 之前，文章底部显示的是「联系入口」而不是坏掉的评论区，这是刻意设计的降级（代码里 `giscusReady` 同时要求两个 ID 都存在）。


本站是纯静态站点（GitHub Pages 托管），没有服务端，因此评论走「托管式无后端方案」。
代码里已经做好了 **Provider 抽象层**：页面只引用 `src/components/Comments.astro`，切换实现不需要改任何页面。

```
src/components/Comments.astro      # 抽象层：按 site.config.ts 的 provider 分发
├─ src/components/GiscusComments.astro   # 已实现（GitHub Discussions 托管）
└─ （新增 Waline / Twikoo / Artalk 时在此平行添加一个组件）
```

当前默认：`provider: 'none'` → 渲染占位说明卡片，**零外部请求、零 JS**。

---

## 方案一：giscus（推荐，GitHub Discussions 托管）

**优点**：与 GitHub Pages 同一账号体系；零成本、零运维；评论数据存在仓库的 Discussions 里，随时可导出/迁移；支持 GitHub 登录、表情回应、Markdown。

**缺点**：评论者需要 GitHub 账号（技术博客通常没问题）；数据在 GitHub 上（国内访问偶尔慢）。

### 接入步骤

1. **开启 Discussions**
   仓库 → `Settings` → `General` → `Features` → 勾选 **Discussions**。

2. **新建分类**
   Discussions → 分类管理 → 新建分类，例如 `Announcements`（类型选 Announcement，只有维护者能发起，访客只能评论，这样能避免有人在 Discussions 里乱开贴）。

3. **安装 giscus App**
   访问 <https://github.com/apps/giscus> → Install → 选择该仓库。

4. **获取两个 ID**
   打开 <https://giscus.app/zh-CN>：
   - Repository 填 `你的用户名/仓库名`（形如 `yourname/my-blog`），确认仓库通过校验；
   - Discussion Category 选刚才建的分类；
   - Mapping 选 **pathname**（本站文章 URL 稳定，推荐；改标题不会丢评论）；
   - 页面下方会给出配置片段，复制 `data-repo-id` 与 `data-category-id` 两个值。

5. **写入配置** `site.config.ts`：

```ts
comments: {
  provider: 'giscus',
  giscus: {
    repo: 'yourname/my-blog',
    repoId: 'R_kgDOxxxxxxx',          // 第 4 步复制
    category: 'Announcements',
    categoryId: 'DIC_kwDOxxxxxxx',    // 第 4 步复制
    mapping: 'pathname',
    strict: false,
    reactionsEnabled: true,
    inputPosition: 'top',
    lang: 'zh-CN',
  },
}
```

6. `npm run dev` 或 `npm run build`，文章页底部即出现评论区。评论主题会跟随站点明暗切换（组件内用 `MutationObserver` 监听 `html.dark` 并 `postMessage` 给 iframe）。

> 若第 5 步只填了 `repo` 而没填 `repoId` / `categoryId`，组件会判定"未就绪"并回退到占位说明，不会把坏掉的 iframe 渲染出来。

---

## 方案二：Waline / Twikoo / Artalk（需要服务端）

适合希望**不要求访客登录 GitHub**、需要点赞/浏览量等能力的场景，代价是要部署一个 Serverless 函数或轻量服务。

以 Waline 为例（Vercel + LeanCloud 免费额度即可跑）：

1. 按 Waline 文档部署服务端，得到 `serverURL`；
2. 新增 `src/components/WalineComments.astro`：

```astro
---
import { siteConfig } from '../../site.config.ts';
const { serverURL } = siteConfig.comments.waline;
---
<div id="waline" style="margin-top:1rem"></div>
<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<script define:vars={{ serverURL }}>
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.mjs';
  init({ el: '#waline', serverURL, path: window.location.pathname, dark: 'html.dark' });
</script>
```

3. 在 `site.config.ts` 里扩展 provider 联合类型并加 `waline: { serverURL: '...' }`；
4. 在 `Comments.astro` 的分支里加：

```astro
{provider === 'waline' && <WalineComments />}
```

页面层（`PostLayout.astro`）不需要任何改动。

---

## 方案三：暂不开评论

保持 `provider: 'none'`。占位卡片会告诉访客"评论已预留"，并给出开启步骤；同时页脚提供邮箱与公众号入口，读者仍能联系到你。

---

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `site.config.ts` → `comments` | 唯一的开关与配置 |
| `src/components/Comments.astro` | Provider 分发 + 未启用时的占位说明 |
| `src/components/GiscusComments.astro` | giscus 实现（含主题跟随） |
| `src/layouts/PostLayout.astro` | 渲染 `<Comments />` 的位置 |

评论区容器带 `data-wechat-ignore`，因此**不会**被带进公众号导出内容。
