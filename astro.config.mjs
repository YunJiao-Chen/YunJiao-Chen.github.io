// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import Slugger from 'github-slugger';
import * as cheerio from 'cheerio';
import temml from 'temml';

import { siteConfig } from './site.config.ts';

/**
 * 数学公式插件
 * ---------------------------------------------------------------------------
 * Sätteri 只把 $...$ 与 $$...$$ 解析成 mdast 的 inlineMath / math 节点，
 * 并不负责渲染。这里在 mdast 阶段就把 TeX 编译成 MathML，交给浏览器原生渲染：
 *   - 不需要 KaTeX 的样式表与自托管字体（与「不自托管网络字体」的约定一致），
 *     也不会产生任何内联样式，门禁里的「模板内联样式为 0」照样成立
 *   - Temml 给块级公式加的 style="display:block math;" 与 display="block"
 *     属性重复，这里直接去掉
 * 注入方式用声明式节点而不是 { raw }：raw 是「重新按 Markdown 解析」，行内公式
 * 会被再包一层 <p>，产生非法的嵌套段落；声明式节点直接把 MathML 拼进 AST。
 *
 * 写作约定（与 remark-math 一致）：
 *   - 行内公式 $...$，同一行内成对出现
 *   - 块级公式必须让 $$ 各占一行，写成 $$x$$ 只会被当成行内公式
 * TeX 写错时 Temml 直接抛错中断构建，比线上渲染出一片红字更安全。
 */
/** @param {string} tex @param {boolean} displayMode */
const renderMath = (tex, displayMode) =>
  temml.renderToString(tex, { displayMode }).replace(/\sstyle="display:block math;"/, '');

/**
 * 把 MathML 字符串转成 Sätteri 的声明式节点树
 * ---------------------------------------------------------------------------
 * 丢弃 Temml 输出的 class 与 style：前者是它可选的排版微调钩子（chr-sml、
 * wbk-sml-acc、tml-med-pad 之类），本站样式表里并没有对应规则，留着会撞上
 * 「无未定义 CSS 类」；后者只有 math-depth 一种，且同样会撞上「模板内联样式为 0」。
 * 只保留 MathML 自身的语义属性，浏览器照样按规范渲染。
 * @param {any} el cheerio 的元素节点
 * @returns {any} MdastContent
 */
function mathmlToNode(el) {
  /** @type {Record<string, string>} */
  const hProperties = {};
  for (const [key, value] of Object.entries(el.attribs ?? {})) {
    if (key === 'class' || key === 'style') continue;
    hProperties[key] = String(value);
  }
  /** @type {any[]} */
  const children = [];
  for (const child of el.children ?? []) {
    if (child.type === 'text') {
      if (child.data) children.push({ type: 'text', value: child.data });
    } else if (child.type === 'tag') {
      children.push(mathmlToNode(child));
    }
  }
  return { type: 'mathml', data: { hName: el.name, hProperties }, children };
}

/** @param {string} tex @param {boolean} displayMode */
const toMathNode = (tex, displayMode) =>
  mathmlToNode(cheerio.load(renderMath(tex, displayMode), { xmlMode: true }).root().children()[0]);

const mathToMathML = {
  name: 'math-to-mathml',
  /** 块级公式：$$ 各占一行 @param {any} node @param {any} ctx */
  math(node, ctx) {
    ctx.replaceNode(node, toMathNode(node.value, true));
  },
  /** 行内公式：$...$ @param {any} node @param {any} ctx */
  inlineMath(node, ctx) {
    ctx.replaceNode(node, toMathNode(node.value, false));
  },
};

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
        // 数学公式：$...$ 行内，$$...$$ 块级；渲染交给下面的 math-to-mathml 插件
        math: true,
      },
      mdastPlugins: [mathToMathML],
      hastPlugins: [headingAnchorPlugin],
    }),
    // 代码高亮：单一深色主题。PaperMod 的代码块底色在浅色模式下也是深的
    // （--code-block-bg 恒为深色块），所以不做明暗双主题切换
    shikiConfig: {
      theme: 'github-dark',
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
