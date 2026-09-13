import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

import { siteConfig } from '../site.config.ts';

const categorySlugs = siteConfig.categories.map((c) => c.slug);

/**
 * 博客内容集合
 * 文件位置：src/content/blog/**\/*.{md,mdx}
 * 文件名即 URL slug：my-first-post.md → /blog/my-first-post/
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    /** 文章标题（H1 由模板渲染，正文从 ## 开始） */
    title: z.string().min(1, 'title 不能为空'),
    /** 摘要：用于卡片、SEO description、公众号 digest */
    description: z.string().min(1, 'description 不能为空'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** 分类 slug，必须是 site.config.ts 中定义过的分类 */
    category: z.string().refine((value) => categorySlugs.includes(value), {
      message: `未知分类，可用值：${categorySlugs.join(' | ')}`,
    }),
    tags: z.array(z.string()).default([]),
    /** 自定义封面（public 下的路径）；缺省时按分类渐变自动生成 */
    cover: z.string().optional(),
    draft: z.boolean().default(false),
    /** 是否进入主页精选 */
    featured: z.boolean().default(false),
    /** 系列名（可选） */
    series: z.string().optional(),
    /** 公众号覆盖字段（可选） */
    wechat: z
      .object({
        title: z.string().optional(),
        digest: z.string().optional(),
        author: z.string().optional(),
        /** false 表示这篇文章不同步公众号（导出时跳过） */
        enable: z.boolean().default(true),
      })
      .optional(),
  }),
});

export const collections = { blog };
