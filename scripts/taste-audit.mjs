#!/usr/bin/env node
/**
 * 设计规范自检（把 design-taste-frontend 的 Pre-Flight Check 变成可执行的门禁）
 * ---------------------------------------------------------------------------
 * 检查分三类：
 *   A. 颜色与对比度（§4.2 / §4.5 / §6.C / §8.B）：token 逐对算 WCAG，AA 未过直接失败
 *   B. 内容与文案（§9.D / §9.F / §9.G）：破折号零容忍、中点配额、CTA 意图唯一、
 *      版本页脚、装饰圆点、地区时间条、滚动提示、emoji 等
 *   C. 结构与图片（§3.E / §4.4 / §4.7 / §4.8 / §9.E）：真实图片、形状一致性、
 *      内联样式、hero 元素数、z-index 集中定义、SVG 手绘
 *
 * 用法：node scripts/taste-audit.mjs [--json]
 */
import { readFileSync, readdirSync, statSync, existsSync, globSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = join(root, 'dist');
const asJson = process.argv.includes('--json');

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

const results = [];
const add = (group, name, ok, detail = '') => results.push({ group, name, ok, detail });

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.astro') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* A. 颜色与对比度                                                              */
/* -------------------------------------------------------------------------- */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};
const contrast = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** 从 global.css 里按主题解析 token */
function parseTokens(css, dark = false) {
  const block = dark
    ? css.slice(css.indexOf('html.dark {'))
    : css.slice(0, css.indexOf('html.dark {'));
  const tokens = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) tokens[m[1]] = m[2];
  return tokens;
}

function auditContrast() {
  const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');

  for (const dark of [false, true]) {
    const t = parseTokens(css, dark);
    const mode = dark ? '深色' : '浅色';
    const pairs = [
      ['正文 text/bg', t.text, t.bg, 7],
      ['正文 text/surface', t.text, t.surface, 7],
      ['次要 text-muted/bg', t['text-muted'], t.bg, 4.5],
      ['次要 text-muted/surface', t['text-muted'], t.surface, 4.5],
      ['弱化 text-subtle/bg', t['text-subtle'], t.bg, 4.5],
      ['弱化 text-subtle/surface', t['text-subtle'], t.surface, 4.5],
      ['强调色作链接 accent/bg', t.accent, t.bg, 4.5],
      ['强调色作链接 accent/surface', t.accent, t.surface, 4.5],
      ['主按钮文字 accent-contrast/accent', t['accent-contrast'], t.accent, 4.5],
      ['次级按钮文字 text-muted/bg', t['text-muted'], t.bg, 4.5],
    ];
    for (const [name, fg, bg, need] of pairs) {
      if (!fg || !bg) {
        add('A 对比度', `${mode} ${name}`, false, 'token 缺失');
        continue;
      }
      const ratio = contrast(fg, bg);
      add('A 对比度', `${mode} ${name}`, ratio >= need, `${ratio.toFixed(2)}:1，要求 ${need}:1`);
    }

    // 纯黑纯白禁令（§8.B）
    const values = Object.values(t);
    add('A 对比度', `${mode} 无纯黑 #000`, !values.includes('#000000'), '');
  }

  // 强调色饱和度 < 80%（§4.2）
  const t = parseTokens(css, false);
  const accent = t.accent.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(accent.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  add('A 对比度', '强调色饱和度 < 80%', saturation < 0.8, `${(saturation * 100).toFixed(0)}%`);
}

/* -------------------------------------------------------------------------- */
/* B. 内容与文案                                                                */
/* -------------------------------------------------------------------------- */

const UI_GLOBS = ['src/**/*.astro', 'src/**/*.ts', 'src/**/*.js'];
const uiFiles = () => UI_GLOBS.flatMap((pattern) => globSync(pattern, { cwd: root })).map((p) => join(root, p));

function auditCopy() {
  const files = uiFiles();
  const mdFiles = globSync('src/content/blog/*.md', { cwd: root }).map((p) => join(root, p));

  // §9.G 破折号零容忍（同时覆盖 UI 文案与文章正文）
  let dashHits = [];
  for (const file of [...files, ...mdFiles]) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/[—–]/.test(line)) dashHits.push(`${relative(root, file)}:${i + 1}`);
    });
  }
  add('B 文案', '零破折号（— 与 –）', dashHits.length === 0, dashHits.slice(0, 5).join(', '));

  // §9.F 中点配额：元信息类标记一行最多 1 个
  const dotHits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      const dots = (line.match(/·/g) ?? []).length;
      if (dots > 1) dotHits.push(`${relative(root, file)}:${i + 1} 有 ${dots} 个`);
    });
  }
  add('B 文案', '每行最多 1 个中点', dotHits.length === 0, dotHits.slice(0, 5).join(', '));

  // §4.5 CTA 意图唯一：同一页面不能有两个同意图按钮文案
  const ctaIntents = {
    联系: ['联系我', '聊聊', '合作', '联系作者'],
    阅读: ['看文章', '读这篇', '阅读全文', '查看全部文章', '浏览全部文章'],
    订阅: ['订阅 RSS', '订阅更新', 'RSS 订阅'],
  };
  const duplicated = [];
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      // 只比较真正的 CTA 元素文案（按钮与文字链接），正文提及不算 CTA
      const ctaLabels = [...html.matchAll(/<(?:a|button)[^>]*class="[^"]*(?:btn|text-link)[^"]*"[^>]*>([\s\S]{0,80}?)<\/(?:a|button)>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      for (const [intent, labels] of Object.entries(ctaIntents)) {
        const found = [...new Set(labels.filter((label) => ctaLabels.some((c) => c.includes(label))))];
        if (found.length > 1) duplicated.push(`${file} 有多个「${intent}」意图：${found.join('/')}`);
      }
      // 同一个 CTA 文案在同一页出现两次以上（例如订阅带同时出现在正文与页脚）
      const counts = new Map();
      for (const label of ctaLabels) counts.set(label, (counts.get(label) ?? 0) + 1);
      for (const [label, count] of counts) {
        if (count > 1 && /订阅|RSS|联系/.test(label)) {
          duplicated.push(`${file} 重复出现「${label}」${count} 次`);
        }
      }
    }
  }
  add('B 文案', '无重复 CTA 意图', duplicated.length === 0, duplicated.slice(0, 3).join('; '));

  // §9.F 版本页脚 / 构建时间戳
  const versionTells = [];
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      // 只看页脚区域：忽略 <meta name="generator"> 与文章自身的「更新于」日期
      const footerStart = html.indexOf('<footer');
      const footer = footerStart >= 0 ? html.slice(footerStart, html.indexOf('</footer>') + 9) : '';
      if (/v\d+\.\d+\.\d+/.test(footer)) versionTells.push(`${file} 页脚版本号`);
      if (/build|build \d|last sync|更新于 20\d\d/i.test(footer)) versionTells.push(`${file} 页脚构建戳`);
    }
  }
  add('B 文案', '无版本号 / 构建时间戳页脚', versionTells.length === 0, versionTells.slice(0, 3).join(', '));

  // §9.F 地区 / 时间 / 天气条（footer 允许一次地址提及，hero 不允许）
  const localeTells = [];
  if (existsSync(distDir)) {
    for (const file of globSync('**/index.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      const hero = html.slice(html.indexOf('hero__split'), html.indexOf('hero__split') + 4000);
      if (/\d{1,2}:\d{2}\s*[·|]/.test(html) || /°C/.test(html)) localeTells.push(file);
      if (/hero__meta/.test(hero)) localeTells.push(`${file} hero 内有地区条`);
    }
  }
  add('B 文案', '无地区 / 时间 / 天气条', localeTells.length === 0, localeTells.slice(0, 3).join(', '));

  // §9.F 滚动提示
  const scrollTells = [];
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      if (/(Scroll to|向下滚动|↓\s*scroll|scroll to explore)/i.test(html)) scrollTells.push(file);
    }
  }
  add('B 文案', '无滚动提示文案', scrollTells.length === 0, scrollTells.slice(0, 3).join(', '));

  // §3.D emoji 策略：UI 文案里不要 emoji（文章正文允许）
  const emojiHits = [];
  const stripComments = (text) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/g, '');
  for (const file of files) {
    // 只扫描可见文案：模板标记 + 配置文案，跳过注释与脚本
    const text = stripComments(readFileSync(file, 'utf8'));
    const matches = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? [];
    if (matches.length) emojiHits.push(`${relative(root, file)}: ${matches.join('')}`);
  }
  add('B 文案', 'UI 文案无 emoji', emojiHits.length === 0, emojiHits.slice(0, 3).join('; '));

  // §9.F 装饰性状态圆点：只允许语义状态，这里检查是否成片出现
  const dotCount = uiFiles()
    .map((f) => (readFileSync(f, 'utf8').match(/border-radius:\s*50%/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  add('B 文案', '装饰圆点克制（≤ 2 处）', dotCount <= 2, `圆形元素样式 ${dotCount} 处`);
}

/* -------------------------------------------------------------------------- */
/* C. 结构与图片                                                                */
/* -------------------------------------------------------------------------- */

function auditStructure() {
  const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');

  // §4.8 / §9.E 真实图片
  let imgCount = 0;
  let fakeShot = 0;
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      imgCount += (html.match(/<img\s/g) ?? []).length;
      // div 拼的假截图：一连串只有背景色的空 div
      if (/<div class="(screenshot|preview|mockup|fake-)/.test(html)) fakeShot += 1;
    }
  }
  add('C 结构', '页面出现真实图片', imgCount > 0, `共 ${imgCount} 个 img`);
  add('C 结构', '无 div 拼的假截图', fakeShot === 0, '');

  // 首页 hero 必须有图片（§4.8：hero 需要真实视觉）
  if (existsSync(join(distDir, 'index.html'))) {
    const home = readFileSync(join(distDir, 'index.html'), 'utf8');
    // hero 区域 = 从 hero__split 到紧随其后的第一个 section 边界（不依赖后续区块的位置）
    const heroStart = home.indexOf('hero__split');
    const heroEnd = home.indexOf('class="section"', heroStart);
    const hero = home.slice(heroStart, heroEnd > heroStart ? heroEnd : heroStart + 6000);
    add('C 结构', 'hero 含真实图片', /<img\s/.test(hero), '');
    // §4.7 hero 文本元素 ≤ 4
    const textNodes = [
      /class="eyebrow hero__eyebrow"/.test(hero),
      /class="hero__title"/.test(hero),
      /class="hero__lead"/.test(hero),
      /class="hero__cta"/.test(hero),
    ].filter(Boolean).length;
    add('C 结构', 'hero 文本元素 ≤ 4', textNodes <= 4, `${textNodes} 个`);
  }

  // §4.4 形状一致性：只允许三档圆角 token
  const radiusValues = [...css.matchAll(/--radius-[\w-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
  add('C 结构', '圆角 token ≤ 3 档', radiusValues.length <= 3, radiusValues.join(' / '));
  const hardcodedRadius = [...css.matchAll(/border-radius:\s*(\d+)px/g)]
    .map((m) => Number(m[1]))
    .filter((n) => ![2, 4, 8, 14].includes(n));
  add('C 结构', '无计划外圆角值', hardcodedRadius.length === 0, hardcodedRadius.join(', '));

  // §6.F z-index 集中定义
  const zVars = [...css.matchAll(/--z-[\w-]+:\s*\d+/g)].length;
  const rawZ = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => m[1]);
  add('C 结构', 'z-index 集中定义', zVars >= 4 && rawZ.length === 0, `token ${zVars} 个，裸值 ${rawZ.length} 个`);

  // 内联样式（除 Shiki 代码高亮外应为 0）
  let inline = 0;
  let inlineNonCode = 0;
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8');
      for (const m of html.matchAll(/<[^>]+\sstyle="([^"]*)"/g)) {
        inline += 1;
        const value = m[1];
        if (!/^(color|background-color):#/.test(value) && !value.includes('--shiki')) inlineNonCode += 1;
      }
    }
  }
  add('C 结构', '模板内联样式为 0', inlineNonCode === 0, `非代码高亮 ${inlineNonCode} 处`);

  // 订阅区存在性：导航里的 #subscribe 锚点必须有落点
  if (existsSync(distDir)) {
    const homeHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    const hasBand = /id="subscribe"/.test(homeHtml);
    const anchorUsed = /href="[^"]*#subscribe"/.test(homeHtml);
    add('C 结构', '订阅区存在且锚点有效', !anchorUsed || hasBand, anchorUsed && !hasBand ? '#subscribe 锚点悬空' : '');
    // 统计数据必须出现在正文里
    add('C 结构', '统计数据在主页出现', /class="facts/.test(homeHtml), '');
    // 统计数据位于内容末尾（标签场之后）
    const factsPos = homeHtml.search(/class="facts/);
    const tagsPos = homeHtml.search(/class="tag-field"/);
    add('C 结构', '统计数据位于内容之后', factsPos > tagsPos && tagsPos >= 0, '');
  }

  // §9.E 手绘 SVG：图标必须来自图标库
  const icon = readFileSync(join(root, 'src/components/Icon.astro'), 'utf8');
  const fromLibrary = icon.includes("@tabler/icons/outline/");
  const handDrawn = (icon.match(/path d="/g) ?? []).length;
  add('C 结构', '图标来自图标库', fromLibrary, '');
  add('C 结构', '无手绘 SVG 路径', handDrawn === 0, `Icon.astro 内手写路径 ${handDrawn} 条`);

  // 网格布局：不允许 flex 百分比数学（§3.E）
  const flexMath = [];
  for (const file of walk(join(root, 'src'))) {
    if (!['.css', '.astro'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    if (/width:\s*calc\(\s*\d+(\.\d+)?%/.test(text)) flexMath.push(relative(root, file));
  }
  add('C 结构', '无 flex 百分比数学', flexMath.length === 0, flexMath.join(', '));

  // §6.B reduced motion 覆盖
  const hasReduced = css.includes('prefers-reduced-motion');
  add('C 结构', '动效尊重 reduced motion', hasReduced, '');

  // §5.D 硬性禁止 scroll 监听
  const scrollListeners = [];
  for (const file of walk(join(root, 'src'))) {
    if (!['.astro', '.ts', '.js'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    if (/addEventListener\(\s*['"]scroll['"]/.test(text)) scrollListeners.push(relative(root, file));
  }
  add('C 结构', '无 window scroll 监听', scrollListeners.length === 0, scrollListeners.join(', '));

  // 自托管字体，不引用 Google Fonts
  const fonts = [];
  for (const file of walk(join(root, 'src'))) {
    if (!['.astro', '.css', '.ts'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text)) fonts.push(relative(root, file));
  }
  add('C 结构', '无 Google Fonts 外链', fonts.length === 0, fonts.join(', '));
  add('C 结构', '自托管字体文件存在', existsSync(join(root, 'public/fonts/geist-latin-wght-normal.woff2')), '');

  // 站点页面无未定义类（排除 shiki / GFM 自带）
  if (existsSync(distDir)) {
    const pageStyles = globSync('**/*.html', { cwd: distDir })
      .filter((f) => !f.startsWith('wechat/'))
      .flatMap((f) => [...readFileSync(join(distDir, f), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)])
      .map((m) => m[1])
      .join('\n');
    const cssAll =
      globSync('_astro/*.css', { cwd: distDir })
        .map((f) => readFileSync(join(distDir, f), 'utf8'))
        .join('') +
      pageStyles +
      css +
      readFileSync(join(root, 'src/styles/prose.css'), 'utf8');
    const defined = new Set([...cssAll.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const allowed = new Set([
      'astro-code-themes', 'github-light', 'github-dark', 'line', 'contains-task-list',
      'task-list-item', 'sr-only', 'heading-anchor', 'data-footnote-backref', 'footnotes',
    ]);
    const unknown = new Set();
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, file), 'utf8').replace(
        /<code[\s\S]*?<\/code>/g,
        '',
      );
      for (const m of html.matchAll(/class="([^"]+)"/g)) {
        for (const cls of m[1].split(/\s+/)) {
          if (cls && !defined.has(cls) && !allowed.has(cls)) unknown.add(cls);
        }
      }
    }
    add('C 结构', '无未定义 CSS 类', unknown.size === 0, [...unknown].join(', '));
  }
}

/* -------------------------------------------------------------------------- */
/* 运行                                                                        */
/* -------------------------------------------------------------------------- */

if (!existsSync(distDir)) {
  console.error('未找到 dist/，请先执行 npm run build');
  process.exit(1);
}

auditContrast();
auditCopy();
auditStructure();

const failed = results.filter((r) => !r.ok);

if (asJson) {
  console.log(JSON.stringify({ results, failed: failed.length }, null, 2));
} else {
  let group = '';
  for (const r of results) {
    if (r.group !== group) {
      group = r.group;
      console.log(`\n${group}`);
    }
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
  if (failed.length) {
    console.log('\n未通过项：');
    for (const r of failed) console.log(`  - ${r.group} / ${r.name}: ${r.detail}`);
  }
}

process.exit(failed.length === 0 ? 0 : 1);
