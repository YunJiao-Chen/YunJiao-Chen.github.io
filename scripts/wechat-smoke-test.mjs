/**
 * 浏览器端公众号导出运行时 · 回归测试（jsdom）
 * 运行：npm run test:wechat
 * 验证：克隆 → 内联 → 公众号化 → 剪贴板写入 全链路不报错且输出符合规范
 */
import { JSDOM } from 'jsdom';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, '..', 'src', 'scripts', 'wechat-runtime.js');

const page = `<!doctype html><html><head><style>
  .prose p { font-size: 17px; line-height: 1.85; color: rgb(16,24,40); }
  .prose h2 { font-size: 22px; border-bottom: 1px solid #eee; }
  .prose blockquote { border-left: 4px solid #4f46e5; background: #f7f8fb; }
  .prose table { border-collapse: collapse; }
  .prose th, .prose td { border: 1px solid #e4e7ec; padding: 6px 8px; }
  .prose pre { background: #f7f8fb; border: 1px solid #e4e7ec; }
  .heading-anchor { opacity: 0; }
</style></head><body>
<article class="prose" data-wechat-article>
  <h2 id="why">为什么<a class="heading-anchor" href="#why"><span>#</span></a></h2>
  <p>正文里有 <code>npm run dev</code> 与 <strong>重点</strong>，还有 <a href="https://astro.build">外链</a>。</p>
  <ul><li>第一项</li></ul>
  <ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked /> 已完成</li><li class="task-list-item"><input type="checkbox" /> 未完成</li></ul>
  <blockquote><p>这是一段引用。</p></blockquote>
  <pre class="astro-code astro-code-themes github-light github-dark" style="background-color:#fff;--shiki-dark-bg:#24292e;color:#24292e;--shiki-dark:#e1e4e8; overflow-x: auto;" data-language="ts"><code><span class="line"><span style="color:#005CC5;--shiki-dark:#79B8FF">const</span><span style="color:#032F62;--shiki-dark:#9ECBFF"> x</span></span></code></pre>
  <table><thead><tr><th>模式</th><th>说明</th></tr></thead><tbody><tr><td>SSG</td><td>构建期生成</td></tr></tbody></table>
  <div data-wechat-ignore>这段不应该出现</div>
</article></body></html>`;

const dom = new JSDOM(page, { pretendToBeVisual: true, url: 'https://example.com/blog/demo/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.Node = window.Node;
globalThis.Blob = window.Blob;

let captured;
window.ClipboardItem = class ClipboardItem {
  constructor(items) { this.items = items; }
};
Object.defineProperty(window.navigator, 'clipboard', {
  value: { write: async (items) => { captured = items; } },
  configurable: true,
});

const { buildWechatArticle, copyWechatArticle, renderWechatBody } = await import(RUNTIME);

const article = document.querySelector('[data-wechat-article]');
const meta = {
  title: '测试文章',
  date: '2026-01-01',
  category: '前端工程',
  reading: '3 分钟阅读',
  tags: ['Astro', '公众号'],
  openingLine: '点击上方蓝字关注',
  signature: '本文首发于博客',
  followText: '欢迎关注公众号',
};

const html = buildWechatArticle(article, meta);
const checks = [
  ['无 class 属性', !html.includes('class=')],
  ['顶层是 section', html.trimStart().startsWith('<section style=')],
  ['剔除 ignore 节点', !html.includes('这段不应该出现')],
  ['剔除锚点链接', !html.includes('heading-anchor')],
  ['复选框转文本标记', html.includes('[x]') && html.includes('[ ]') && !html.includes('<input')],
  ['代码 token 保留浅色', html.includes('#005CC5')],
  ['代码块换行保护', html.includes('white-space:pre-wrap')],
  ['表格内联边框', /<t[hd][^>]*border:1px solid/.test(html)],
  ['引用块内联样式', html.includes('border-left:3px solid #d9d9d9')],
  ['超链接公众号色', html.includes('color:#576b95')],
  ['元信息行', html.includes('2026-01-01 / 前端工程 / 3 分钟阅读')],
  ['引导语/署名/关注', html.includes('点击上方蓝字关注') && html.includes('本文首发于博客') && html.includes('欢迎关注公众号')],
  ['标签行', html.includes('标签：Astro / 公众号')],
  ['无 shiki 自定义属性', !html.includes('--shiki')],
];

await copyWechatArticle(article, meta);
const item = captured?.[0];
const blob = item?.items?.['text/html'];
const plainBlob = item?.items?.['text/plain'];
checks.push(['写入 text/html 剪贴板内容', Boolean(blob) && blob.type === 'text/html']);
checks.push(['同时写入纯文本兜底', Boolean(plainBlob) && plainBlob.type === 'text/plain']);
checks.push(['剪贴板内容与生成结果一致', (await blob?.text())?.includes('border-left:3px solid #d9d9d9') === true]);

// 深色模式下的标题不应破坏导出（样式取内联规范，不依赖主题变量）
const bodyOnly = renderWechatBody(article, {});
checks.push(['正文片段可独立渲染', bodyOnly.includes('font-size:16px')]);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 项通过，输出长度 ${html.length}`);
process.exit(failed === 0 ? 0 : 1);
