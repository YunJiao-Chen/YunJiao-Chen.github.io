// @ts-nocheck
// 说明：本文件必须保持纯 JS 语法（见下方注释），因此关闭该文件的类型检查，
// 类型安全由 astro check 对其他页面与组件的检查保证。
/**
 * RSS 订阅源：/rss.xml
 * RSS 需要绝对地址，site 必须与部署地址一致
 *
 * ⚠️ 注意：`xxx.xml.ts` 这类双扩展名端点必须使用纯 JS 语法
 * （Astro 7 + Vite 8 不会对它们做 TypeScript 转换），原因见 search-index.json.ts
 */
import rss from '@astrojs/rss';

import { getAllPosts, postMeta, postPath } from '../lib/posts.ts';
import { siteConfig } from '../../site.config.ts';

export async function GET(context) {
  const posts = await getAllPosts();
  const year = new Date().getFullYear();

  return rss({
    title: siteConfig.site.title,
    description: siteConfig.site.description,
    site: context.site ?? siteConfig.site.url,
    trailingSlash: true,
    items: posts.map((post) => {
      const meta = postMeta(post);
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: new Date(post.data.pubDate),
        link: postPath(post),
        categories: [meta.category.name, ...post.data.tags],
        author: post.data.wechat?.author ?? siteConfig.author.name,
      };
    }),
    customData: [
      `<language>${siteConfig.site.lang}</language>`,
      `<managingEditor>${siteConfig.author.email} (${siteConfig.author.name})</managingEditor>`,
      `<copyright>© ${siteConfig.footer.since}-${year} ${siteConfig.author.name}</copyright>`,
      `<generator>Astro</generator>`,
    ].join(''),
  });
}
