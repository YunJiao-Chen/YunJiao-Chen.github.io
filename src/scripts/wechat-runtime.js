/**
 * 微信公众号导出运行时（浏览器端）
 * ---------------------------------------------------------------------------
 * 公众号编辑器只保留元素上的 style 属性，会丢弃 <style> 与 class，
 * 所以流程是：克隆正文 DOM → 逐元素读取 getComputedStyle →
 *           按白名单写回 style → 做公众号兼容改造 → 写入剪贴板 text/html。
 *
 * 这份文件同时被两处使用：
 *   1. 文章页的「复制到公众号」按钮（Astro 打包为模块）
 *   2. scripts/export-wechat.mjs 生成的独立 HTML（去掉末尾 export 语句后内联）
 * 因此：不要引入任何依赖，也不要在模块顶层访问 DOM。
 */

/* -------------------------------------------------------------------------- */
/* 配置                                                                        */
/* -------------------------------------------------------------------------- */

/** 会被内联的属性白名单（公众号可安全渲染的子集） */
const INLINE_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'color',
  'background-color',
  'text-align',
  'text-decoration-line',
  'letter-spacing',
  'text-indent',
  'white-space',
  'word-break',
  'vertical-align',
  'display',
  'width',
  'max-width',
  'height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'list-style-type',
  'box-sizing',
  'overflow-x',
];

/** 导出正文里需要剔除的节点（站内交互元素） */
const PRUNE_SELECTOR = [
  '[data-wechat-ignore]',
  '.heading-anchor',
  '.toc',
  '.post-actions',
  '.comments',
  '.post-nav',
  '.related',
  'button',
  'script',
  'style',
  'nav',
  'iframe',
].join(',');

/** 公众号排版基准样式（与 src/styles/wechat.css 保持一致） */
const SPEC = {
  article: 'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.75;color:#3f3f3f;letter-spacing:0.5px;word-break:break-word;text-align:left;',
  meta: 'font-size:13px;color:#9a9a9a;margin:0 0 22px;letter-spacing:0.3px;',
  opening: 'font-size:15px;color:#888888;margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid #eeeeee;',
  signature: 'margin-top:30px;padding-top:14px;border-top:1px solid #eeeeee;font-size:14px;color:#8a8a8a;line-height:1.7;',
  follow: 'margin-top:22px;padding:14px 16px;background-color:#f7f7f7;border-radius:8px;font-size:14px;color:#666666;line-height:1.7;',
  tags: 'margin-top:18px;font-size:13px;color:#9a9a9a;line-height:1.7;',
  h2: 'font-size:19px;font-weight:700;color:#1a1a1a;line-height:1.5;margin:32px 0 16px;padding:0 0 8px;border-bottom:1px solid #ececec;',
  h3: 'font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.5;margin:26px 0 14px;',
  h4: 'font-size:16px;font-weight:600;color:#444444;margin:22px 0 12px;',
  p: 'font-size:16px;line-height:1.75;color:#3f3f3f;margin:0 0 16px;',
  quote: 'margin:20px 0;padding:12px 14px;background-color:#f7f7f7;border-left:3px solid #d9d9d9;border-radius:0 4px 4px 0;color:#666666;font-size:15px;line-height:1.75;',
  pre: 'font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:13px;line-height:1.65;color:#24292e;background-color:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:14px 16px;margin:20px 0;white-space:pre-wrap;word-break:break-all;overflow-x:auto;',
  preCode: 'font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:13px;line-height:1.65;color:#24292e;background-color:transparent;white-space:pre-wrap;word-break:break-all;',
  codeInline: 'font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:14px;color:#1a1a1a;background-color:#f5f6f8;border-radius:4px;padding:2px 5px;margin:0 2px;',
  table: 'width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;line-height:1.6;',
  th: 'border:1px solid #e5e5e5;background-color:#fafafa;color:#1a1a1a;font-weight:600;padding:8px 10px;text-align:left;',
  td: 'border:1px solid #e5e5e5;color:#3f3f3f;padding:8px 10px;text-align:left;',
  img: 'max-width:100%;height:auto;display:block;margin:20px auto;border-radius:6px;',
  figcaption: 'font-size:13px;color:#9a9a9a;text-align:center;margin-top:8px;',
  ul: 'margin:0 0 16px;padding:0 0 0 22px;',
  li: 'font-size:16px;line-height:1.75;color:#3f3f3f;margin-bottom:8px;',
  link: 'color:#576b95;text-decoration:none;',
  hr: 'border:none;border-top:1px dashed #dddddd;margin:26px 0;',
  footnotes: 'margin-top:28px;padding-top:14px;border-top:1px solid #eeeeee;font-size:14px;color:#8a8a8a;line-height:1.7;',
  strong: 'font-weight:600;color:#1a1a1a;',
  mark: 'background-color:#fff3bf;color:#3f3f3f;padding:0 3px;',
  del: 'color:#9a9a9a;text-decoration:line-through;',
};

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

const isElement = (node) => node && node.nodeType === 1;

/** 遍历 root 及其后代（含自身） */
function walk(root, visit) {
  visit(root);
  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i += 1) visit(all[i]);
}

/**
 * 取代码高亮的「浅色 token」颜色
 * Shiki 配置 defaultColor: 'light' 时，浅色颜色是 style 里的字面 color；
 * 若改用 --shiki-light 变量写法，这里也能兼容。
 * 深色模式下 computed color 是深色 token，直接导出会在浅底代码块里看不清，
 * 所以必须从原始 style 属性里取浅色值。
 */
function readCustomProps(el) {
  const raw = el.getAttribute && el.getAttribute('style');
  if (!raw) return null;
  const asVar = /--shiki-light\s*:\s*([^;]+)/.exec(raw);
  if (asVar) return asVar[1].trim();
  const asColor = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-z]+)/.exec(raw);
  return asColor ? asColor[1].trim() : null;
}

/** 解析 inline style 字符串为对象 */
function parseStyle(text) {
  const out = {};
  String(text || '')
    .split(';')
    .forEach((chunk) => {
      const idx = chunk.indexOf(':');
      if (idx > 0) out[chunk.slice(0, idx).trim()] = chunk.slice(idx + 1).trim();
    });
  return out;
}

/** 合并样式字符串（后者覆盖前者） */
function mergeStyle(...parts) {
  const merged = Object.assign({}, ...parts.map(parseStyle));
  return Object.keys(merged)
    .filter((k) => merged[k] !== '' && merged[k] != null)
    .map((k) => `${k}:${merged[k]}`)
    .join(';');
}

/** 元素 → 语义化的替换标签（公众号偏好 section） */
const TAG_MAP = { div: 'section', span: 'span', article: 'section', main: 'section', header: 'section', footer: 'section', aside: 'section' };

/* -------------------------------------------------------------------------- */
/* 核心：克隆 → 清理 → 内联 → 公众号化                                          */
/* -------------------------------------------------------------------------- */

/**
 * 把正文 DOM 转成公众号可用的、全部内联样式的 HTML
 * @param {HTMLElement} sourceEl 正文容器（站内为 [data-wechat-article]）
 * @param {{pretty?: boolean}} [options]
 * @returns {string}
 */
export function renderWechatBody(sourceEl, options) {
  const opts = options || {};
  let clone = sourceEl.cloneNode(true);

  // 1) 清理站内交互元素
  clone.querySelectorAll(PRUNE_SELECTOR).forEach((el) => el.remove());

  // 2) 记录代码高亮的浅色 token（深色模式下导出依然可读）
  const lightTokens = new Map();
  walk(clone, (el) => {
    const light = readCustomProps(el);
    if (light) lightTokens.set(el, light);
    Array.from(el.attributes || []).forEach((attr) => {
      if (attr.name.startsWith('data-astro') || attr.name.startsWith('astro-')) el.removeAttribute(attr.name);
    });
  });

  // 3) 内联计算样式（必须在页面可见状态下读取，隐藏元素取不到尺寸但颜色仍在）
  //    源树与克隆树结构一致，因此按下标配对遍历
  const srcEls = [sourceEl, ...sourceEl.querySelectorAll('*')];
  const dstEls = [clone, ...clone.querySelectorAll('*')];
  for (let i = 0; i < dstEls.length && i < srcEls.length; i += 1) {
    const src = srcEls[i];
    const el = dstEls[i];
    if (!isElement(src) || !isElement(el)) continue;
    const cs = window.getComputedStyle(src);
    const parts = [];
    for (const prop of INLINE_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (!value || value === 'none') continue;
      if (value === 'normal' && prop !== 'font-style') continue;
      if (prop === 'display' && (value === 'inline' || value === 'block')) continue;
      parts.push(`${prop}:${value}`);
    }
    el.setAttribute('style', parts.join(';'));
  }

  // 4) 标签替换：div → section
  clone.querySelectorAll(Object.keys(TAG_MAP).join(',')).forEach((el) => {
    const tag = TAG_MAP[el.tagName.toLowerCase()];
    if (!tag || tag === el.tagName.toLowerCase()) return;
    const next = document.createElement(tag);
    Array.from(el.attributes).forEach((attr) => next.setAttribute(attr.name, attr.value));
    while (el.firstChild) next.appendChild(el.firstChild);
    el.replaceWith(next);
  });

  // 5) 逐类元素套用公众号排版规范
  const apply = (el, style) => {
    el.setAttribute('style', mergeStyle(el.getAttribute('style'), style));
  };

  // 标题：正文不出现 h1（标题由公众号标题栏填写）
  clone.querySelectorAll('h1').forEach((el) => {
    const h2 = document.createElement('h2');
    h2.innerHTML = el.innerHTML;
    h2.setAttribute('style', SPEC.h2);
    el.replaceWith(h2);
  });
  clone.querySelectorAll('h2').forEach((el) => apply(el, SPEC.h2));
  clone.querySelectorAll('h3').forEach((el) => apply(el, SPEC.h3));
  clone.querySelectorAll('h4, h5, h6').forEach((el) => apply(el, SPEC.h4));

  clone.querySelectorAll('p').forEach((el) => apply(el, SPEC.p));
  clone.querySelectorAll('blockquote').forEach((el) => apply(el, SPEC.quote));
  clone.querySelectorAll('hr').forEach((el) => apply(el, SPEC.hr));
  clone.querySelectorAll('strong, b').forEach((el) => apply(el, SPEC.strong));
  clone.querySelectorAll('em, i').forEach((el) => apply(el, 'font-style:italic;color:#555555;'));
  clone.querySelectorAll('mark').forEach((el) => apply(el, SPEC.mark));
  clone.querySelectorAll('del, s').forEach((el) => apply(el, SPEC.del));
  clone.querySelectorAll('a').forEach((el) => {
    apply(el, SPEC.link);
    if (opts.appendLinkUrl && el.getAttribute('href') && !el.getAttribute('href').startsWith('#')) {
      el.insertAdjacentText('afterend', `（${el.getAttribute('href')}）`);
    }
  });
  clone.querySelectorAll('img').forEach((el) => {
    apply(el, SPEC.img);
    el.removeAttribute('loading');
    el.removeAttribute('decoding');
  });
  clone.querySelectorAll('figcaption').forEach((el) => apply(el, SPEC.figcaption));
  clone.querySelectorAll('ul, ol').forEach((el) => apply(el, SPEC.ul));
  clone.querySelectorAll('li').forEach((el) => apply(el, SPEC.li));
  clone.querySelectorAll('table').forEach((el) => apply(el, SPEC.table));
  clone.querySelectorAll('thead th, th').forEach((el) => apply(el, SPEC.th));
  clone.querySelectorAll('td').forEach((el) => apply(el, SPEC.td));
  clone.querySelectorAll('.footnotes, section[data-footnotes]').forEach((el) => apply(el, SPEC.footnotes));

  // 脚注引用：去掉链接样式，保留上标
  clone.querySelectorAll('[data-footnote-ref]').forEach((el) => {
    el.setAttribute('style', 'font-size:12px;color:#576b95;vertical-align:super;text-decoration:none;');
    el.removeAttribute('href');
    el.removeAttribute('id');
  });

  // 任务列表：复选框 → ASCII 勾选标记（公众号不支持 input，且默认不使用 emoji）
  clone.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    const symbol = el.hasAttribute('checked') ? '[x] ' : '[ ] ';
    el.replaceWith(document.createTextNode(symbol));
  });
  clone.querySelectorAll('li').forEach((el) => {
    if (el.getAttribute('style') && el.getAttribute('style').indexOf('list-style') === -1) {
      const style = parseStyle(el.getAttribute('style'));
      if (style.display !== 'list-item') style['list-style-type'] = 'none';
      apply(el, style);
    }
  });

  // 代码块：统一浅色底，token 用浅色主题色
  clone.querySelectorAll('pre').forEach((pre) => {
    const saved = lightTokens.get(pre);
    const original = pre.getAttribute('style') || '';
    const preStyle = { 'font-size': '13px', 'line-height': '1.65' };
    if (/--shiki-light-bg\s*:\s*([^;]+)/.test(original)) {
      preStyle['background-color'] = /--shiki-light-bg\s*:\s*([^;]+)/.exec(original)[1].trim();
    }
    pre.setAttribute('style', mergeStyle(SPEC.pre, preStyle));
    if (saved) void saved;
    pre.querySelectorAll('code').forEach((code) => {
      code.setAttribute('style', SPEC.preCode);
      code.removeAttribute('class');
      code.querySelectorAll('span').forEach((span) => {
        const light = lightTokens.get(span);
        // 有浅色 token 就只写颜色；否则保留内联计算结果
        if (light) span.setAttribute('style', `color:${light};`);
        else span.removeAttribute('style');
      });
      if (!code.querySelector('span') && lightTokens.get(code)) {
        code.setAttribute('style', mergeStyle(SPEC.preCode, { color: lightTokens.get(code) }));
      }
    });
  });

  // 行内代码（不在 pre 里的 code）
  clone.querySelectorAll('code').forEach((code) => {
    if (code.closest('pre')) return;
    code.setAttribute('style', mergeStyle(SPEC.codeInline, {}));
  });

  // 去掉所有 class / id（公众号编辑器里没有意义，且可能被它重置样式）
  walk(clone, (el) => {
    el.removeAttribute('class');
    el.removeAttribute('id');
    el.removeAttribute('tabindex');
  });

  // 顶层容器：统一为 section，并套用基准排版
  const rootTag = clone.tagName.toLowerCase();
  if (rootTag === 'div' || rootTag === 'article') {
    const section = document.createElement('section');
    section.innerHTML = clone.innerHTML;
    clone = section;
  }
  clone.setAttribute('style', mergeStyle(SPEC.article, clone.getAttribute('style')));

  void opts.pretty;
  return clone.outerHTML;
}

/**
 * 组装完整公众号文章（元信息 + 正文 + 署名 + 引导关注）
 * @param {HTMLElement} articleEl
 * @param {{title?: string, digest?: string, date?: string, category?: string, reading?: string, tags?: string[],
 *          openingLine?: string, signature?: string, followText?: string, context?: 'copy' | 'export'}} meta
 */
export function buildWechatArticle(articleEl, meta) {
  const m = meta || {};
  const body = renderWechatBody(articleEl, { appendLinkUrl: false });
  const parts = [`<section style="${SPEC.article}">`];

  if (m.openingLine) parts.push(`<p style="${SPEC.opening}">${m.openingLine}</p>`);

  const metaBits = [m.date, m.category, m.reading].filter(Boolean);
  if (metaBits.length) parts.push(`<p style="${SPEC.meta}">${metaBits.join(' / ')}</p>`);

  parts.push(body);

  if (m.tags && m.tags.length) {
    parts.push(`<p style="${SPEC.tags}">标签：${m.tags.join(' / ')}</p>`);
  }
  if (m.signature) parts.push(`<p style="${SPEC.signature}">${m.signature}</p>`);
  if (m.followText) parts.push(`<section style="${SPEC.follow}">${m.followText}</section>`);

  parts.push('</section>');
  return parts.join('');
}

/* -------------------------------------------------------------------------- */
/* 剪贴板 / 下载 / 提示                                                         */
/* -------------------------------------------------------------------------- */

/** 写入剪贴板：优先 text/html，失败则回退 execCommand */
export async function copyHtml(html, text) {
  const plain = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch (error) {
    /* 继续尝试回退方案 */
  }
  try {
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.style.top = '0';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const ok = document.execCommand('copy');
    selection.removeAllRanges();
    holder.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

/** 复制整篇文章（含元信息与结尾） */
export async function copyWechatArticle(articleEl, meta) {
  const html = buildWechatArticle(articleEl, meta);
  return copyHtml(html, (meta && meta.title) || '');
}

/** 下载为 HTML 文件（备用通道） */
export function downloadHtml(html, filename) {
  const doc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${(filename || 'article').replace(/</g, '')}</title></head><body style="background:#fff;padding:24px;max-width:760px;margin:0 auto;">${html}</body></html>`;
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (filename || 'article').replace(/[\\/:*?"<>|]/g, '-') + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 浮层提示 */
export function toast(message, type) {
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute(
    'style',
    'position:fixed;left:50%;bottom:2.2rem;transform:translateX(-50%);z-index:9999;' +
      'padding:0.7rem 1.15rem;border-radius:999px;font-size:0.9rem;font-family:inherit;' +
      'box-shadow:0 12px 30px rgba(0,0,0,0.22);transition:opacity .3s ease;' +
      (type === 'error'
        ? 'background:#b42318;color:#fff;'
        : 'background:#07c160;color:#fff;'),
  );
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 2400);
}

/* -------------------------------------------------------------------------- */
/* 自动挂载：站内文章页的按钮                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 绑定 [data-wechat-copy] / [data-wechat-download] 按钮
 * 数据来源于按钮上的 data-* 与页面 [data-wechat-article] 容器
 */
export function mountWechatExport() {
  const buttons = document.querySelectorAll('[data-wechat-copy], [data-wechat-download]');
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const article = document.querySelector('[data-wechat-article]');
      if (!article) {
        toast('未找到正文容器', 'error');
        return;
      }
      const meta = {
        title: button.getAttribute('data-title') || document.title,
        date: button.getAttribute('data-date') || '',
        category: button.getAttribute('data-category') || '',
        reading: button.getAttribute('data-reading') || '',
        tags: (button.getAttribute('data-tags') || '').split(',').filter(Boolean),
        openingLine: button.getAttribute('data-opening') || '',
        signature: button.getAttribute('data-signature') || '',
        followText: button.getAttribute('data-follow') || '',
      };

      const label = button.getAttribute('data-label') || button.textContent;
      button.disabled = true;

      try {
        if (button.hasAttribute('data-wechat-download')) {
          const html = buildWechatArticle(article, meta);
          downloadHtml(html, meta.title);
          toast('已下载 HTML，可直接复制到公众号编辑器');
        } else {
          const ok = await copyWechatArticle(article, meta);
          toast(ok ? '已复制，去公众号编辑器粘贴即可' : '复制失败，请用「下载 HTML」', ok ? 'ok' : 'error');
        }
      } catch (error) {
        toast('导出失败：' + (error && error.message ? error.message : error), 'error');
      } finally {
        button.disabled = false;
        if (label) button.setAttribute('data-label', label);
      }
    });
  });
}

/* 供独立导出页使用（无 DOM 依赖，纯复制现有 HTML） */
export function mountCopyNode(button, node, meta) {
  if (!button || !node) return;
  button.addEventListener('click', async () => {
    const ok = await copyHtml(node.outerHTML, (meta && meta.title) || '');
    toast(ok ? '已复制，去公众号编辑器粘贴即可' : '复制失败，请手动全选复制', ok ? 'ok' : 'error');
  });
}

export { SPEC, INLINE_PROPS };
