---
title: "Markdown 转公众号：把排版工程做扎实"
description: 公众号只认内联样式，于是我用 getComputedStyle 做样式冻结，再把剪贴板写成 text/html。
pubDate: 2025-11-23
category: frontend
tags: [Markdown, 微信公众号, 剪贴板, 排版]
featured: true
wechat:
  title: 为什么公众号排版这么难？我用一段脚本解决了
  digest: 从样式冻结到标签白名单，讲清 Markdown 一键转公众号的每一步
  author: 你的名字
---

## 公众号编辑器为什么这么「挑剔」

我原以为「复制网页进公众号」是个复制粘贴问题，做了才发现是排版工程问题。公众号编辑器的粘贴入口背后是一个白名单清洗器：它会删掉 `<style>` 标签，剥掉 `class` 与 `id`，不认识的标签会被拆掉外壳只留文字。也就是说，所有依赖 CSS 类名的样式，在这里统统失效，**能活下来的只有内联 `style` 属性**。

想通这一点，整个方案就清晰了：不是让公众号去理解我的 CSS，而是在复制的那一刻，把浏览器已经算好的样式**冻结**成内联属性。

## 用 getComputedStyle 做一次样式冻结

思路是克隆正文 DOM，逐个元素读取计算样式，再按白名单把值写回 `style` 属性。白名单的意义在于控制噪音：`getComputedStyle` 会返回几百个属性，全写进去会让 HTML 膨胀十倍，也会把公众号编辑器不认识的属性带进去。

```ts
const WHITELIST = [
  'font-family', 'font-size', 'font-weight', 'line-height',
  'color', 'background-color', 'text-align', 'letter-spacing',
  'margin-top', 'margin-bottom', 'padding', 'border-radius',
] as const;

function freezeStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source as HTMLElement);
  for (const prop of WHITELIST) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'normal' && value !== 'auto') {
      (target as HTMLElement).style.setProperty(prop, value);
    }
  }
  const srcChildren = Array.from(source.children);
  const dstChildren = Array.from(target.children);
  srcChildren.forEach((child, i) => freezeStyles(child, dstChildren[i]));
}
```

要注意 `getComputedStyle` 拿到的 `font-family` 是一长串回退列表（`-apple-system, "PingFang SC", ...`）。公众号会保留它，但读者设备上不一定有这些字体，所以我把它精简成「系统字体 + 中文回退」两段式，而不是照抄。

## 标签改造：div 换 section，标题重设字号

白名单之外还要做结构兼容：

1. 把布局用的 `div` 全部换成 `section`，前者容易被清洗器连壳带内容一起处理，后者是公众号的「安全标签」。
2. `h1`~`h6` 重设字号。站内依赖全局 CSS 控制层级，内联之后必须显式写出 22px / 19px / 17px 这类具体值。
3. 表格补边框，图片加 `max-width: 100%` 并居中，标题里的锚点链接整段去掉，否则读者会点到一个空链接。

## 代码块的换行保护

这是最容易翻车的地方。站内代码块用 `overflow-x: auto` 横向滚动，但在公众号里，超出容器的部分会被**直接裁掉**，读者看不到长行。所以移动端优先的策略是：`white-space: pre-wrap` 配合 `word-break: break-all`，让长行折行而不是滚动。

> 一个判断标准：如果读者要在手机上横向滑动才能看完一行代码，那这段代码在公众号里就是失败的。宁可折行难看一点，也不能让内容丢失。

另外 `pre` 内部的空行必须保留，否则多段脚本会糊成一团。我的做法是在序列化前把连续空行转成显式的占位空行，并在预览页里肉眼核对一遍。

## 剪贴板：写 text/html 而不是 text/plain

最后一步是复制。如果只写 `text/plain`，粘到公众号里就是一堆裸文本；必须同时写入 `text/html`，编辑器才会解析富文本：

```ts
const item = new ClipboardItem({
  'text/html': new Blob([html], { type: 'text/html' }),
  'text/plain': new Blob([text], { type: 'text/plain' }),
});
await navigator.clipboard.write([item]);
```

`ClipboardItem` 需要安全上下文（HTTPS 或 localhost），失败时降级到 `document.execCommand('copy')`，再失败就提供「下载 HTML」按钮，让用户手动全选复制。三层兜底之后，这个按钮才敢放在文章页上给读者用。

整套流程跑通后，我的发布动作从「半小时手工调格式」变成「点一下按钮，粘贴，检查首尾」。省下的时间不多，但它把一件需要耐心的事变成了一件不需要的事。
