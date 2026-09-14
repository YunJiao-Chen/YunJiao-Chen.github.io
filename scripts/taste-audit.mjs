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
/** 入参是 [r, g, b] */
const luminance = ([r, g, b]) =>
  0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
const contrast = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** 从 theme-vars.css 里按明暗两套解析颜色 token */
const themeVarsPath = () => join(root, 'src/styles/papermod/core/theme-vars.css');

/** 解析 rgb(r g b) / rgb(r, g, b) / #rrggbb → [r, g, b] */
function parseColor(value) {
  const text = String(value).trim();
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = text.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (full.length < 6) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function parseTokens(css, dark = false) {
  const marker = ':root[data-theme="dark"] {';
  const start = dark ? css.indexOf(marker) : 0;
  const end = dark ? css.length : css.indexOf(marker);
  const block = css.slice(start, end);
  const tokens = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const color = parseColor(m[2]);
    if (color) tokens[m[1]] = color;
  }
  return tokens;
}

function auditContrast() {
  const css = readFileSync(themeVarsPath(), 'utf8');
  const siteCss = readFileSync(join(root, 'src/styles/site.css'), 'utf8');

  /** 统计窗口内文字与背景的组合（值与用途都取自主题自身） */
  const expectedPairs = (t) => [
    ['正文 primary/theme', t.primary, t.theme, 7],
    ['正文 primary/entry', t.primary, t.entry, 7],
    ['次要 secondary/theme', t.secondary, t.theme, 4.5],
    ['次要 secondary/entry', t.secondary, t.entry, 4.5],
    ['长文 content/entry', t.content, t.entry, 7],
    ['行内代码 content/code-bg', t.content, t['code-bg'], 4.5],
  ];

  for (const dark of [false, true]) {
    const t = parseTokens(css, dark);
    const mode = dark ? '深色' : '浅色';

    for (const [name, fg, bg, need] of expectedPairs(t)) {
      if (!fg || !bg) {
        add('A 对比度', `${mode} ${name}`, false, 'token 缺失');
        continue;
      }
      const ratio = contrast(fg, bg);
      add('A 对比度', `${mode} ${name}`, ratio >= need, `${ratio.toFixed(2)}:1，要求 ${need}:1`);
    }

    // 纯黑禁令（§8.B）：主题的正文色是 rgb(30,30,30)，深色代码块底也不是纯黑
    const black = Object.entries(t).filter(([, [r, g, b]]) => r + g + b === 0);
    add('A 对比度', `${mode} 无纯黑`, black.length === 0, black.map(([k]) => k).join(', '));

    // 代码块底永远是深色块（正文颜色由语法高亮的行内色决定）
    add(
      'A 对比度',
      `${mode} 代码块底色为深色`,
      luminance(t['code-block-bg']) < 0.15,
      `亮度 ${luminance(t['code-block-bg']).toFixed(3)}`,
    );
  }

  // 参考站 PaperMod 不使用强调色，链接靠下划线与 hover 变化
  add(
    'A 对比度',
    '无强调色 token（与参考站一致）',
    !/--accent/.test(siteCss),
    '',
  );
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
      // 只认 "build 123" 这类构建戳；排掉 astro.build 这样的域名
      if (/(^|[^/\w.])build\s*[#:]?\s*\d|\blast\s+sync\b|更新于\s*20\d\d/i.test(footer)) {
        versionTells.push(`${file} 页脚构建戳`);
      }
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

  // §3.D emoji 策略：UI 代码里不要 emoji（文章正文允许）
  // 例外：首页欢迎语带一个 👏（用户指定），文案在 site.config.ts 里，
  // 所以这一条拆成两步：源码里 0 个，渲染结果里最多 1 个且只能在首页。
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
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
    const matches = text.match(EMOJI) ?? [];
    if (matches.length) emojiHits.push(`${relative(root, file)}: ${matches.join('')}`);
  }
  add('B 文案', 'UI 代码里无 emoji', emojiHits.length === 0, emojiHits.slice(0, 3).join('; '));

  const emojiRenderHits = [];
  let emojiTotal = 0;
  if (existsSync(distDir)) {
    for (const file of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const matches = readFileSync(join(distDir, file), 'utf8').match(EMOJI) ?? [];
      if (!matches.length) continue;
      emojiTotal += matches.length;
      if (file !== 'index.html') emojiRenderHits.push(`${file}: ${matches.join('')}`);
    }
  }
  add(
    'B 文案',
    '页面 emoji ≤ 1 且只在首页欢迎语',
    emojiTotal <= 1 && emojiRenderHits.length === 0,
    `全站 ${emojiTotal} 个${emojiRenderHits.length ? `，越界：${emojiRenderHits.slice(0, 3).join('; ')}` : ''}`,
  );

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
  const css = readFileSync(join(root, 'src/styles/site.css'), 'utf8');
  const themeCss = readFileSync(themeVarsPath(), 'utf8');
  /** 移植进来的 PaperMod 全部样式，用于检查字体栈、圆角等主题级约定 */
  const vendoredCss = globSync('src/styles/papermod/**/*.css', { cwd: root })
    .map((p) => readFileSync(join(root, p), 'utf8'))
    .join('\n');

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

  // 首屏视觉：PaperMod 结构把真实照片放在顶栏 logo，首页是欢迎卡片 + 条目卡片
  if (existsSync(join(distDir, 'index.html'))) {
    const home = readFileSync(join(distDir, 'index.html'), 'utf8');
    // 参考站的顶栏是纯文字 logo，真实照片放在关于页
    if (existsSync(join(distDir, 'about/index.html'))) {
      const about = readFileSync(join(distDir, 'about/index.html'), 'utf8');
      add('C 结构', '关于页含作者照片', /<img\s/.test(about), '');
    }

    // 欢迎卡片：PaperMod 的 first-entry home-info
    const infoStart = home.indexOf('first-entry home-info');
    const infoEnd = home.indexOf('class="post-entry"', infoStart);
    const info = home.slice(infoStart, infoEnd > infoStart ? infoEnd : infoStart + 3000);
    const textNodes = [
      /class="entry-header"/.test(info),
      /class="entry-content md-content"/.test(info),
      /class="social-icons"/.test(info),
    ].filter(Boolean).length;
    add('C 结构', '欢迎卡片文本元素 ≤ 4', infoStart > 0 && textNodes <= 4, `${textNodes} 个`);

    // 首页应有条目卡片（PaperMod 的 post-entry 列表）与「全部文章」分页链接
    const entries = (home.match(/class="post-entry"/g) ?? []).length;
    add('C 结构', '首页有条目卡片列表', entries >= 3, `${entries} 条`);
    add('C 结构', '首页有全部文章入口', /class="pagination"/.test(home), '');
  }

  // §4.4 形状一致性：圆角只来自主题的单个 --radius
  const themeRadius = [...themeCss.matchAll(/--radius[\w-]*:/g)].length;
  const customRadius = [...css.matchAll(/--radius[\w-]*:/g)].length;
  add('C 结构', '圆角只有主题一个 token', themeRadius === 1, `theme-vars 里 ${themeRadius} 个`);
  add('C 结构', '站内不新增圆角 token', customRadius === 0, `site.css 里 ${customRadius} 个`);
  const hardcodedRadius = [...css.matchAll(/border-radius:\s*(\d+)px/g)]
    .map((m) => Number(m[1]))
    .filter((n) => ![2, 4, 8, 14].includes(n));
  add('C 结构', '无计划外圆角值', hardcodedRadius.length === 0, hardcodedRadius.join(', '));

  // §6.F z-index 集中：主题只给 top-link 一个层级，站内不再自造
  const rawZ = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => m[1]);
  add('C 结构', 'z-index 只用主题的层级', rawZ.length === 0, `site.css 裸值 ${rawZ.length} 个`);

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

  // 页内锚点一致性：每个 href="#x" 都要有对应的 id="x"（删区块后最容易留下悬空锚点）
  if (existsSync(distDir)) {
    const dangling = [];
    for (const rel of globSync('**/*.html', { cwd: distDir }).filter((f) => !f.startsWith('wechat/'))) {
      const html = readFileSync(join(distDir, rel), 'utf8');
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const m of html.matchAll(/href="#([^"]+)"/g)) {
        if (!ids.has(m[1])) dangling.push(`${rel}#${m[1]}`);
      }
    }
    add('C 结构', '页内锚点都有落点', dangling.length === 0, [...new Set(dangling)].slice(0, 3).join(', '));
  }

  // 部署路径一致性：资源的路径前缀（base）必须和 sitemap / RSS 的绝对地址一致
  // base 从构建产物里的资源地址反推：'/blog/_astro/…' → '/blog'，'/_astro/…' → ''（根站点）
  if (existsSync(join(distDir, 'index.html'))) {
    const homeHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    const baseMatch = /href="([^"]*)\/_astro\//.exec(homeHtml);
    if (baseMatch) {
      // 归一化：'' 与 '/' 都表示根站点
      const base = baseMatch[1].replace(/\/$/, '');
      const sitemap = existsSync(join(distDir, 'sitemap-0.xml'))
        ? readFileSync(join(distDir, 'sitemap-0.xml'), 'utf8')
        : '';
      const rss = existsSync(join(distDir, 'rss.xml')) ? readFileSync(join(distDir, 'rss.xml'), 'utf8') : '';
      const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const links = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
      const label = base || '根站点';

      // 首页地址必须正好是 origin + base + '/'：这一条能同时抓住"漏了 base"和"多带了旧 base"
      const origin = locs.length ? new URL(locs[0]).origin : '';
      const expectedHome = `${origin}${base}/`;
      add(
        'C 结构',
        `sitemap 首页地址正确（${label}）`,
        locs.includes(expectedHome),
        locs.length ? `期望 ${expectedHome}，实际 ${locs.slice(0, 2).join(', ')}` : 'sitemap 为空',
      );

      const wrongPrefix = (url) => !new URL(url).pathname.startsWith(`${base}/`);
      const badSitemap = locs.filter(wrongPrefix);
      const badRss = links.filter((url) => url.startsWith('http') && wrongPrefix(url));
      add('C 结构', `sitemap 链接都在 ${label} 下`, badSitemap.length === 0, badSitemap.slice(0, 2).join(', '));
      add('C 结构', `RSS 链接都在 ${label} 下`, badRss.length === 0, badRss.slice(0, 3).join(', '));
    }
  }

  // §9.E 手绘 SVG：图标必须来自图标库
  const icon = readFileSync(join(root, 'src/components/Icon.astro'), 'utf8');
  const fromLibrary = icon.includes("@tabler/icons/outline/");
  const handDrawn = (icon.match(/path d="/g) ?? []).length;
  add('C 结构', '图标来自图标库', fromLibrary, '');
  add('C 结构', '无手绘 SVG 路径', handDrawn === 0, `Icon.astro 内手写路径 ${handDrawn} 条`);

  // 移植主题的署名必须随产物发布（CSS 打包会剥掉注释，只能单独出文件）
  const noticePath = join(distDir, 'third-party-licenses.txt');
  const notice = existsSync(noticePath) ? readFileSync(noticePath, 'utf8') : '';
  add(
    'C 结构',
    '产物内含第三方许可声明',
    /adityatelange/.test(notice) && /MIT/.test(notice),
    existsSync(noticePath) ? '' : '缺少 third-party-licenses.txt',
  );

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
  // 字体策略：参考站用系统字体栈（不自托管网络字体）
  add(
    'C 结构',
    '字体使用系统栈（与参考站一致）',
    /-apple-system,\s*BlinkMacSystemFont/.test(vendoredCss),
    '',
  );

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
      css;
    const defined = new Set([...cssAll.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const allowed = new Set([
      'astro-code-themes', 'github-light', 'github-dark', 'line', 'contains-task-list',
      'task-list-item', 'sr-only', 'heading-anchor', 'data-footnote-backref', 'footnotes',
      'moon', 'sun', 'icon',
      // 主题模板里的结构性钩子，主题自己不给样式（PaperMod 原样如此）
      'page-footer', 'prev', 'astro-code',
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
