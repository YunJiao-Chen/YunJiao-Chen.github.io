// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import Slugger from 'github-slugger';

import { siteConfig } from './site.config.ts';

/**
 * Markdown 渲染管线（Astro 7 默认使用 Sätteri 处理器）
 * ---------------------------------------------------------------------------
 * 内置能力：GFM（表格 / 任务列表 / 删除线 / 脚注）、标题 id、Shiki 代码高亮。
 * 这里补充一个 hast 插件：给 h2~h4 追加可点击的 # 锚点链接（配合文章目录）。
 */
/**
 * 标题锚点插件
 * ---------------------------------------------------------------------------
 * Sätteri 的流水线顺序是：代码高亮 → 用户插件 → 图片标记 → 标题 id 生成。
 * 也就是说用户插件运行时标题还没有 id，因此这里自己生成 id（与 github-slugger
 * 一致的算法，Astro 的 headings 元数据会沿用已有 id），并给 h2~h4 追加 # 锚点。
 */
const headingAnchorPlugin = {
  name: 'heading-anchors',
  /**
   * 每个文档一个 slugger，避免跨文档累积导致 id 递增
   * @param {any} _root @param {any} ctx
   */
  before(_root, ctx) {
    ctx.data.headingAnchorSlugger = new Slugger();
  },
  element: {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    /** @param {any} node @param {any} ctx */
    visit(node, ctx) {
      const existing = node.properties?.id;
      const slugger = /** @type {any} */ (ctx.data.headingAnchorSlugger);
      const slug =
        typeof existing === 'string' && existing
          ? existing
          : slugger.slug(ctx.textContent(node));
      if (typeof existing !== 'string') ctx.setProperty(node, 'id', slug);

      // 只有 h2~h4 需要可见锚点（h1 是文章标题，h5/h6 很少用）
      if (!['h2', 'h3', 'h4'].includes(node.tagName)) return;

      // 锚点本身不带文本内容：'#' 由 CSS ::before 绘制，
      // 这样 Astro 的 headings 元数据（目录文案）不会被 '#' 污染
      ctx.appendChild(node, {
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['heading-anchor'],
          href: `#${slug}`,
          ariaLabel: '本文锚点链接',
          tabIndex: -1,
        },
        children: [],
      });
    },
  },
};

export default defineConfig({
  /* GitHub Pages 项目站点：site + base 由 site.config.ts 统一注入
     （CI 中可用 SITE_URL / BASE_PATH 环境变量覆盖） */
  site: siteConfig.site.url,
  base: siteConfig.site.base,

  trailingSlash: 'always',
  integrations: [
    mdx(),
    sitemap({
      // 公众号导出目录不参与索引
      filter: (page) => !page.includes('/wechat/'),
    }),
  ],

  markdown: {
    processor: satteri({
      features: {
        // GFM：表格 / 任务列表 / 删除线 / 脚注（脚注文案本地化为中文）
        gfm: {
          footnotes: {
            label: '注释',
            backLabel: '返回正文引用 {reference}',
          },
        },
        // 智能标点：把直引号转成弯引号、-- 转破折号
        smartPunctuation: true,
      },
      hastPlugins: [headingAnchorPlugin],
    }),
    // 双主题代码高亮：默认浅色，html.dark 时切深色（配合 src/styles/prose.css）
    // defaultColor: 'light' 让浅色 token 直接写成字面颜色，公众号导出可直接沿用
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: 'light',
      wrap: false,
    },
  },

  // 悬停预取，静态站点切换近乎瞬时
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  devToolbar: {
    enabled: false,
  },

  build: {
    // CSS 按体积内联，减少请求
    inlineStylesheets: 'auto',
  },
});
