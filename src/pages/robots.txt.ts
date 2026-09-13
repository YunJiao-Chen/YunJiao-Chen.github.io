// @ts-nocheck
// 说明：双扩展名端点必须保持纯 JS 语法（Astro 7 + Vite 8 不对其做 TS 转换）。
/**
 * robots.txt：构建期生成，Sitemap 使用绝对地址（环境变量覆盖 site 时也会跟着变）
 */
import { siteConfig, absoluteUrl, withBase } from '../../site.config.ts';

export const GET = () => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${withBase('/wechat/')}`,
    '',
    `Sitemap: ${absoluteUrl('/sitemap-index.xml')}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
