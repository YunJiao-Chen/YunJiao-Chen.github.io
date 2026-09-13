#!/usr/bin/env node
/**
 * 新建文章脚手架
 * ---------------------------------------------------------------------------
 * 用法：
 *   npm run new -- "文章标题"
 *   npm run new -- "文章标题" --category frontend --tags Astro,性能
 *   npm run new -- "文章标题" --id my-custom-slug --draft
 *
 * 会在 src/content/blog/ 下生成带完整 frontmatter 的 Markdown 文件，
 * 并顺带打印公众号导出提示。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteConfig } from '../site.config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const blogDir = resolve(__dirname, '..', 'src', 'content', 'blog');

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const title = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1]?.startsWith('--') !== true);

if (!title) {
  console.error(`用法：npm run new -- "文章标题" [--category <slug>] [--tags a,b] [--id <slug>] [--draft]

可用分类：
${siteConfig.categories.map((c) => `  ${c.slug.padEnd(10)} ${c.name}`).join('\n')}`);
  process.exit(1);
}

const category = valueOf('--category') ?? siteConfig.categories[0].slug;
if (!siteConfig.categories.some((c) => c.slug === category)) {
  console.error(`未知分类：${category}
可用分类：${siteConfig.categories.map((c) => c.slug).join(' | ')}`);
  process.exit(1);
}

/** 标题 → slug：保留 ASCII，中文转拼音不可能，因此用日期 + 序号兜底 */
function slugify(input) {
  const ascii = input
    .toLowerCase()
    .replace(/[^\da-z\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (ascii.length >= 3) return ascii;
  const now = new Date();
  return `post-${now.toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}

const id = valueOf('--id') ?? slugify(title);
const tags = (valueOf('--tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const isDraft = args.includes('--draft');

const today = new Date().toISOString().slice(0, 10);
const frontmatter = `---
title: ${title}
description: 一句话摘要：这篇文章解决什么问题、给出什么结论。
pubDate: ${today}
category: ${category}
tags: [${tags.join(', ')}]
${isDraft ? 'draft: true\n' : ''}---

## 为什么写这篇

（把动机写清楚：遇到了什么问题，为什么值得记录。）

## 正文

（正文从 ## 开始，H1 由模板渲染。）

\`\`\`ts
// 代码块会自动高亮，并可以在公众号导出中保留排版
\`\`\`

## 结论

（给出取舍与适用边界，而不只是"这样做更好"。）
`;

mkdirSync(blogDir, { recursive: true });
const target = join(blogDir, `${id}.md`);

if (existsSync(target)) {
  console.error(`文件已存在：${target}`);
  process.exit(1);
}

writeFileSync(target, frontmatter, 'utf8');

console.log(`已创建：src/content/blog/${id}.md
  分类：${siteConfig.categories.find((c) => c.slug === category).name}
  标签：${tags.length ? tags.join('、') : '（未设置）'}
  状态：${isDraft ? '草稿（生产构建不输出）' : '正式'}

下一步：
  1. npm run dev                      本地预览 http://localhost:4321
  2. 写作时正文标题从 ## 开始
  3. 发布后 npm run build 会自动生成公众号导出页 dist/wechat/${id}.html
`);
