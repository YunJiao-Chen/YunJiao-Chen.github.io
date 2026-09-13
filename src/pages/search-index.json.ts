// @ts-nocheck
// 说明：本文件必须保持纯 JS 语法（见下方注释），故关闭本文件的类型检查。
/**
 * 站内搜索索引端点：构建期生成 /search-index.json
 * 客户端只在首次打开搜索框时拉取（纯前端过滤，无搜索服务）
 *
 * ⚠️ 注意：`xxx.json.ts` 这类双扩展名端点必须使用纯 JS 语法。
 * Astro 7 + Vite 8 不会对它们做 TypeScript 转换，写 `import type` 或类型注解会导致构建报
 * "builtin:vite-transform Unexpected token"。同理见 src/pages/rss.xml.ts。
 */
import { buildSearchIndex } from '../lib/posts.ts';
import { siteConfig } from '../../site.config.ts';

export const GET = async () => {
  const index = await buildSearchIndex();
  const payload = {
    site: siteConfig.site.title,
    generatedAt: new Date().toISOString(),
    count: index.length,
    posts: index,
  };
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
