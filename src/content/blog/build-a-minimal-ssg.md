---
title: 用 200 行脚本写一个极简静态站点生成器
description: 只做三件事：读取内容集合、渲染模板、生成路由，亲手写一遍就理解了 Astro 这类框架在做什么。
pubDate: 2026-07-05
updatedDate: 2026-08-12
category: frontend
tags: [静态站点, Node.js, 模板渲染, 构建工具]
series: Astro 实战
---

## 为什么值得自己写一遍

用 Astro 写博客很舒服，但舒服久了会产生一种错觉：好像「构建」是一件自动发生的、不需要理解的事。直到某天我需要在构建产物里插一段自定义逻辑，才发现自己说不清「从 Markdown 到 HTML」中间到底发生了什么。

所以我花了一个晚上写了一个极简生成器。目标不是替代任何框架，而是把三件事亲手实现一遍：**内容集合怎么读、模板怎么渲染、路由怎么生成**。写完之后再看 [Astro 的内容集合 API](https://astro.build)，我忽然能读懂它的每一步设计意图了。

## 第一步：先把边界定死

自己写工具最大的风险是无限扩张。所以我先写下不做的事：

- 不支持 MDX、组件嵌入与布局插槽。
- 不做增量构建，每次全量重建。
- 模板只做占位符替换，不引入模板语言。
- 没有插件系统，需要什么就在构建脚本里写死。

> 一个玩具项目能不能学到东西，取决于它的边界是否清晰，而不是它能支持多少功能。功能越多，你越容易把时间花在维护玩具上，而不是理解原理。

## 第二步：内容集合

内容集合的本质是「一批有相同 frontmatter 结构的文件」。我约定每篇文章放在 `content/*.md`，用 `gray-matter` 解析头部，用 `marked` 转换正文：

```js
// build.mjs：极简静态站点生成器
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const SRC = resolve('content');
const OUT = resolve('dist');

// ① 内容集合：读取目录、解析 frontmatter、过滤草稿
async function loadPosts() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const raw = await readFile(join(SRC, file), 'utf8');
    const { data, content } = matter(raw);
    if (data.draft) continue;               // 草稿不进生产构建
    const slug = file.replace(/\.md$/, '');
    posts.push({
      slug,
      url: `/blog/${slug}/`,                // 目录式 URL，便于静态托管
      title: data.title,
      pubDate: new Date(data.pubDate),
      content: marked.parse(content),       // Markdown → HTML
    });
  }
  return posts.sort((a, b) => b.pubDate - a.pubDate);
}

// ② 模板渲染：唯一的字符串替换层
function render(template, data) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => data[key] ?? '');
}

// ③ 路由生成：每篇文章一个目录，外加一个列表页
async function build() {
  await rm(OUT, { recursive: true, force: true });
  const layout = await readFile(resolve('templates/post.html'), 'utf8');
  const posts = await loadPosts();

  for (const post of posts) {
    const file = join(OUT, post.url, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, render(layout, post), 'utf8');
  }

  const items = posts
    .map((p) => `<li><a href="${p.url}">${p.title}</a></li>`)
    .join('\n');
  const listFile = join(OUT, 'blog', 'index.html');
  await mkdir(dirname(listFile), { recursive: true });
  await writeFile(
    listFile,
    render(layout, { title: '全部文章', content: `<ul>${items}</ul>` }),
    'utf8',
  );
}

await build();
```

加上模板文件、`marked` 与 `gray-matter` 的依赖声明，整体不到 200 行。运行方式就是一句 `node build.mjs`，产物是 `dist/` 里的一堆目录，任何静态托管都能直接吃下。

## 第三步：踩到的三个坑

第一版跑通之后，我遇到三个问题，而它们恰好都是真实框架花大力气解决的地方：

1. **日期排序不可靠。** `gray-matter` 会把 `pubDate` 解析成 `Date`，但一旦写成带引号的字符串就变回字符串，排序结果静默出错。正确做法是在解析后显式转型并校验。
2. **HTML 转义遗漏。** 文章标题里的 `&` 和 `<` 会直接破坏页面结构。框架里的安全转义、以及「哪些内容允许原始 HTML」的决策，都不是可选项。
3. **相对链接全崩。** 目录式 URL 下，文章里的 `./other-post.md` 必须被重写成 `/blog/other-post/`。我最后加了一条正则重写规则，也终于理解了 Astro 为什么要在构建期统一处理链接。

## 我学到的

写完之后我最大的收获是：**框架的价值不在于它替我写了多少代码，而在于它替我做了多少决策**。内容集合的约定、路由的生成规则、转义与链接的处理，这些决策我自己做一遍只需要一晚上，但要做得足够健壮、足够快、足够可扩展，就是几年时间。

所以现在我用 Astro，但我不再把它当黑盒。知道下面发生了什么，出问题时才有能力往下查一层。这可能是我今年在工程上最有价值的一次「重复造轮子」。
