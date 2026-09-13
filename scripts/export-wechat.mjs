#!/usr/bin/env node
/**
 * 微信公众号导出（构建期）
 * ---------------------------------------------------------------------------
 * 运行时机：`npm run build` 在 `astro build` 之后自动执行（也可 `npm run wechat`）
 *
 * 做什么：
 *   1. 读取 dist/blog/<slug>/index.html，抽出 [data-wechat-article] 正文
 *   2. 公众号化：div→section、打上 wx-* 类、复选框转文本、代码块保留浅色 token
 *   3. 用 juice 把 src/styles/wechat.css 全部内联成 style 属性
 *      （公众号编辑器只认行内样式，会丢弃 <style> 与 class）
 *   4. 套上导出模板（元信息 / 署名 / 引导关注 / 一键复制按钮）
 *   5. 输出 dist/wechat/<slug>.html 与目录页 dist/wechat/index.html
 *
 * 用法：
 *   node scripts/export-wechat.mjs              # 导出全部
 *   node scripts/export-wechat.mjs --only slug  # 只导出某一篇
 *   node scripts/export-wechat.mjs --check      # 只检查，不写文件
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cheerio from 'cheerio';
import matter from 'gray-matter';
import juice from 'juice';

import { siteConfig } from '../site.config.ts';
import { formatDate, readingTime } from '../src/lib/utils.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = join(root, 'dist');
const blogDir = join(distDir, 'blog');
const wechatDir = join(distDir, siteConfig.wechat.exportDir);
const contentDir = join(root, 'src', 'content', 'blog');
const runtimePath = join(root, 'src', 'scripts', 'wechat-runtime.js');
const wechatCssPath = join(root, 'src', 'styles', 'wechat.css');

const args = process.argv.slice(2);
const onlySlug = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const checkOnly = args.includes('--check');

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

const log = (...parts) => console.log('[wechat]', ...parts);

/** 递归收集 src/content/blog 下的 .md / .mdx，返回 id（相对路径，去扩展名）→ frontmatter */
function collectSources() {
  const out = new Map();
  if (!existsSync(contentDir)) return out;

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.mdx?$/.test(entry)) continue;
      const id = relative(contentDir, full).replace(/\.mdx?$/, '');
      const raw = readFileSync(full, 'utf8');
      const { data, content } = matter(raw);
      out.set(id, { data, content });
    }
  };
  walk(contentDir);
  return out;
}

/** 从 shiki 的行内样式里取出浅色 token 颜色（导出统一走浅色主题，保证可读） */
function lightColorOf(styleAttr) {
  if (!styleAttr) return undefined;
  const match = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/.exec(styleAttr);
  return match ? match[1] : undefined;
}

/** 正文里需要剔除的站内元素 */
const PRUNE = [
  '[data-wechat-ignore]',
  '.heading-anchor',
  '.toc',
  '.comments',
  '.post-actions',
  '.wechat-export',
  '.post-nav',
  '.related',
  'script',
  'style',
  'button',
  'nav',
  'iframe',
].join(',');

/**
 * 把站内正文 DOM 转成公众号可承受的结构（类名稍后由 juice 内联）
 */
function toWechatDom($, article) {
  article.find(PRUNE).remove();

  /* 1) div 之类的容器统一换成 section */
  article.find('div, article, main, header, footer, aside, span').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName.toLowerCase();
    if (tag === 'span') return; // span 保留原样
    const replacement = $('<section></section>');
    $.each(el.attribs ?? {}, (name, value) => replacement.attr(name, value));
    replacement.append($el.contents());
    $el.replaceWith(replacement);
  });

  /* 2) 标题 */
  article.find('h1').each((_, el) => {
    const h2 = $('<h2 class="wx-h2"></h2>');
    h2.append($(el).contents());
    $(el).replaceWith(h2);
  });
  article.find('h2').addClass('wx-h2');
  article.find('h3').addClass('wx-h3');
  article.find('h4, h5, h6').addClass('wx-h4');

  /* 3) 文本与内联元素 */
  article.find('p').addClass('wx-p');
  article.find('blockquote').addClass('wx-quote');
  article.find('hr').addClass('wx-hr');
  article.find('ul').addClass('wx-ul');
  article.find('ol').addClass('wx-ol');
  article.find('li').addClass('wx-li');
  article.find('table').addClass('wx-table');
  article.find('th').addClass('wx-th');
  article.find('td').addClass('wx-td');
  article.find('img').addClass('wx-img');
  article.find('figcaption').addClass('wx-figcaption');
  article.find('figure').addClass('wx-figure');
  article.find('a').addClass('wx-link');
  article.find('strong, b').addClass('wx-strong');
  article.find('em, i').addClass('wx-em');
  article.find('del, s').addClass('wx-del');
  article.find('mark').addClass('wx-mark');
  article.find('section[data-footnotes], .footnotes').addClass('wx-footnotes');

  /* 4) 任务列表：公众号不支持 input，转成符号文本 */
  article.find('input[type="checkbox"]').each((_, el) => {
    const $el = $(el);
    const checked = $el.attr('checked') !== undefined || $el.attr('checked') === 'checked';
    $el.replaceWith($(`<span>${checked ? '✅ ' : '⬜ '}</span>`));
  });
  article.find('li').each((_, el) => {
    const $el = $(el);
    $el.addClass('wx-task');
    $el.removeClass('task-list-item');
  });

  /* 5) 代码块：保留浅色 token 颜色，去掉 shiki 的自定义属性 */
  article.find('pre').each((_, el) => {
    const $pre = $(el);
    $pre.addClass('wx-pre');
    $pre.removeAttr('data-language');
    $pre.removeAttr('tabindex');
    $pre.attr('style', '');
    $pre.find('code').each((__, codeEl) => {
      const $code = $(codeEl);
      $code.addClass('wx-pre-code');
      $code.attr('style', '');
      $code.find('span').each((___, spanEl) => {
        const $span = $(spanEl);
        const color = lightColorOf($span.attr('style'));
        // 只保留颜色；shiki 的 --shiki-dark 等自定义属性在公众号里无效
        if (color) $span.attr('style', `color:${color}`);
        else $span.removeAttr('style');
        $span.removeClass('line');
      });
      // 没有 token span 的纯文本代码块，给出统一的深色文字
      const textOnlyColor = lightColorOf($(codeEl).attr('style'));
      if (textOnlyColor && $code.find('span').length === 0) {
        $code.attr('style', `color:${textOnlyColor}`);
      }
    });
  });

  /* 6) 行内代码 */
  article.find('code').each((_, el) => {
    const $code = $(el);
    if ($code.closest('pre').length) return;
    $code.addClass('wx-code-inline');
    $code.attr('style', '');
  });

  /* 7) 脚注引用去掉链接 */
  article.find('[data-footnote-ref]').each((_, el) => {
    const $el = $(el);
    $el.removeAttr('href');
    $el.removeAttr('id');
  });

  /* 8) 清掉站内专用属性 */
  article.find('*').each((_, el) => {
    const $el = $(el);
    ['id', 'data-astro-cid', 'loading', 'decoding', 'tabindex', 'target', 'rel'].forEach((attr) =>
      $el.removeAttr(attr),
    );
    Object.keys(el.attribs ?? {}).forEach((name) => {
      if (name.startsWith('data-astro') || name.startsWith('astro-') || name.startsWith('data-wx')) {
        $el.removeAttr(name);
      }
    });
  });

  return article;
}

/** 组装正文（含元信息 / 署名 / 引导关注），类名由 juice 转成行内样式 */
function buildBody($, article, meta) {
  const wrapper = $('<section class="wx-article"></section>');

  if (siteConfig.wechat.openingLine) {
    wrapper.append($(`<p class="wx-opening"></p>`).text(siteConfig.wechat.openingLine));
  }

  const metaBits = [meta.date, meta.categoryName, meta.reading].filter(Boolean);
  if (metaBits.length) {
    wrapper.append($('<p class="wx-meta"></p>').text(metaBits.join(' / ')));
  }

  wrapper.append(article.contents());

  if (meta.tags.length) {
    wrapper.append($('<p class="wx-tags"></p>').text(`标签：${meta.tags.join(' / ')}`));
  }
  if (siteConfig.wechat.signature) {
    wrapper.append($('<p class="wx-signature"></p>').text(siteConfig.wechat.signature));
  }
  if (siteConfig.wechat.followText) {
    wrapper.append($('<section class="wx-follow"></section>').text(siteConfig.wechat.followText));
  }

  return wrapper;
}

/** juice：把 wechat.css 内联到 style 属性，然后清掉类名（公众号里没有意义） */
function inlineStyles(html) {
  const css = readFileSync(wechatCssPath, 'utf8');
  const juiced = juice(html, {
    extraCss: css,
    applyStyleTags: true,
    removeStyleTags: true,
    preserveImportant: true,
    insertPreservedExtraCss: false,
  });
  const $ = cheerio.load(juiced, null, false);
  $('*').each((_, el) => {
    const $el = $(el);
    $el.removeAttr('class');
    $el.removeAttr('id');
  });
  return $('body').html() ?? $.html();
}

/** 导出页里的运行时脚本：去掉 ESM 导出语句后内联 */
function runtimeScript() {
  return readFileSync(runtimePath, 'utf8')
    .replace(/^export\s+(?=(async\s+)?function\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

/* -------------------------------------------------------------------------- */
/* 导出页模板                                                                  */
/* -------------------------------------------------------------------------- */

function exportPage({ slug, title, digest, html: bodyHtml, meta }) {
  const script = runtimeScript();
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>公众号导出 · ${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f2f3f5; color: #1f2329;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
  .bar { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 0.6rem;
    align-items: center; padding: 0.85rem 1.25rem; background: #fff;
    border-bottom: 1px solid #e5e6eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .bar h1 { font-size: 1rem; margin: 0 auto 0 0; font-weight: 600; }
  .bar p { margin: 0; font-size: 0.8rem; color: #86909c; width: 100%; }
  button { font: inherit; padding: 0.5rem 1rem; border-radius: 999px; border: 1px solid #07c160;
    background: #07c160; color: #fff; cursor: pointer; }
  button.ghost { background: #fff; color: #4e5969; border-color: #dcdfe6; }
  button:disabled { opacity: 0.6; cursor: default; }
  .sheet { max-width: 760px; margin: 1.5rem auto 3rem; background: #fff; padding: 28px 22px 40px;
    border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.06); }
  .tip { max-width: 760px; margin: 1rem auto 0; font-size: 0.82rem; color: #86909c; line-height: 1.7; }
  .tip code { background: #fff; border: 1px solid #e5e6eb; border-radius: 4px; padding: 0 4px; }
  .digest { max-width: 760px; margin: 1rem auto 0; background: #fff; border-radius: 10px;
    padding: 14px 18px; font-size: 0.85rem; color: #4e5969; line-height: 1.8; }
  .digest b { color: #1f2329; }
</style>
</head>
<body>
  <div class="bar">
    <h1>公众号导出 · ${escapeHtml(title)}</h1>
    <button type="button" data-wx-copy>复制到公众号</button>
    <button type="button" class="ghost" data-wx-download>下载 HTML</button>
    <button type="button" class="ghost" data-wx-select>全选正文</button>
    <p>点「复制到公众号」后，打开公众号后台编辑器直接粘贴即可（样式已全部内联）。</p>
  </div>

  <div class="digest">
    <b>建议标题：</b>${escapeHtml(title)}<br />
    <b>建议摘要：</b>${escapeHtml(digest)}<br />
    <b>来源：</b>${escapeHtml(meta.url)} ｜ 分类：${escapeHtml(meta.categoryName)} ｜ 发布：${escapeHtml(meta.date)} ｜ ${escapeHtml(meta.reading)}
  </div>

  <div class="sheet">
    <section id="wx-article">${bodyHtml}</section>
  </div>

  <p class="tip">
    注：公众号编辑器只接受行内样式，因此本页所有样式都已内联。图片需要在公众号后台重新上传
    （外链图片会被过滤）；数学公式建议在站内改为图片后再导出。文件路径：
    <code>dist/wechat/${escapeHtml(slug)}.html</code>
  </p>

<script>
${script}
(function () {
  var article = document.getElementById('wx-article');
  var meta = { title: ${JSON.stringify(title)} };
  mountCopyNode(document.querySelector('[data-wx-copy]'), article, meta);

  document.querySelector('[data-wx-download]').addEventListener('click', function () {
    downloadHtml(article.outerHTML, meta.title);
    toast('已下载 HTML', 'ok');
  });

  document.querySelector('[data-wx-select]').addEventListener('click', function () {
    var range = document.createRange();
    range.selectNodeContents(article);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    toast('已选中正文，按 ⌘C / Ctrl+C 复制', 'ok');
  });
})();
</script>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  if (!existsSync(blogDir)) {
    log('未找到 dist/blog，请先执行 astro build（npm run build:site）');
    process.exitCode = 1;
    return;
  }

  const sources = collectSources();
  const entries = [];

  for (const slug of readdirSync(blogDir)) {
    if (onlySlug && slug !== onlySlug) continue;

    const pagePath = join(blogDir, slug, 'index.html');
    if (!existsSync(pagePath)) continue;

    const source = sources.get(slug) ?? {};
    const data = source.data ?? {};
    if (data.draft === true) continue;
    if (data.wechat && data.wechat.enable === false) {
      log(`跳过 ${slug}（frontmatter 里 wechat.enable=false）`);
      continue;
    }

    const pageHtml = readFileSync(pagePath, 'utf8');
    const $ = cheerio.load(pageHtml);
    const article = $('[data-wechat-article]').first();
    if (!article.length) {
      log(`跳过 ${slug}（页面里没有 [data-wechat-article] 正文容器）`);
      continue;
    }

    // 元信息：优先 frontmatter，其次页面里的 meta
    const title = data.wechat?.title ?? data.title ?? $('title').text().split(' · ')[0];
    const digest = data.wechat?.digest ?? data.description ?? '';
    const categorySlug = data.category ?? '';
    const categoryName =
      siteConfig.categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug;
    const date = data.pubDate
      ? formatDate(new Date(data.pubDate))
      : ($('meta[property="article:published_time"]').attr('content')?.slice(0, 10) ?? '');
    const reading = source.content ? readingTime(source.content).label : '';
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const url = `${siteConfig.site.url}${siteConfig.site.base.replace(/\/$/, '')}/blog/${slug}/`;

    const meta = { title, digest, categoryName, date, reading, tags, url, slug };

    const transformed = toWechatDom($, article);
    const body = buildBody($, transformed, meta);
    let inlined;
    try {
      inlined = inlineStyles(body.toString());
    } catch (error) {
      log(`✗ ${slug} 内联样式失败：${error.message}`);
      process.exitCode = 1;
      continue;
    }

    entries.push({ slug, title, digest, meta, html: inlined });
  }

  if (entries.length === 0) {
    log(onlySlug ? `没有匹配的文章：${onlySlug}` : '没有可导出的文章');
    return;
  }

  if (!checkOnly) {
    mkdirSync(wechatDir, { recursive: true });
    for (const entry of entries) {
      writeFileSync(join(wechatDir, `${entry.slug}.html`), exportPage(entry), 'utf8');
    }
    writeFileSync(join(wechatDir, 'index.html'), indexPage(entries), 'utf8');
  }

  for (const entry of entries) {
    log(`✓ ${entry.slug} → ${siteConfig.wechat.exportDir}/${entry.slug}.html（${entry.html.length} 字节）`);
  }
  log(`共导出 ${entries.length} 篇${checkOnly ? '（--check，未写文件）' : ''}`);
}

function indexPage(entries) {
  const rows = entries
    .map(
      (entry) => `<tr>
        <td><a href="./${entry.slug}.html">${escapeHtml(entry.title)}</a></td>
        <td>${escapeHtml(entry.meta.categoryName)}</td>
        <td>${escapeHtml(entry.meta.date)}</td>
        <td>${escapeHtml(entry.digest).slice(0, 60)}</td>
      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>公众号导出目录 · ${escapeHtml(siteConfig.site.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; margin: 0;
    padding: 2.5rem 1.25rem; background: #f2f3f5; color: #1f2329; }
  .wrap { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 2rem;
    box-shadow: 0 6px 24px rgba(0,0,0,0.06); }
  h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
  p { color: #86909c; font-size: 0.88rem; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; font-size: 0.9rem; }
  th, td { border-bottom: 1px solid #e5e6eb; padding: 0.6rem 0.5rem; text-align: left; }
  th { color: #86909c; font-weight: 500; font-size: 0.8rem; }
  a { color: #07c160; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #f7f8fa; border: 1px solid #e5e6eb; border-radius: 4px; padding: 0 4px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>公众号导出目录</h1>
    <p>
      共 ${entries.length} 篇。每篇都是<strong>全内联样式</strong>的独立页面：打开后点「复制到公众号」，
      再到公众号后台编辑器粘贴即可。<br />
      重新生成：<code>npm run wechat</code>（会先构建站点再导出）。
    </p>
    <table>
      <thead>
        <tr><th>文章</th><th>分类</th><th>日期</th><th>摘要</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
</body>
</html>
`;
}

await main();
