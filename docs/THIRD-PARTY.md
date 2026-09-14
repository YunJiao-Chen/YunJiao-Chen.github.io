# 第三方资源与署名

本仓库自带（vendored）了一份第三方主题样式。这里记录来源、许可与同步方式。

## PaperMod

| 项 | 值 |
| --- | --- |
| 项目 | [adityatelange/hugo-PaperMod](https://github.com/adityatelange/hugo-PaperMod) |
| 用途 | 全站视觉样式（本站在 Astro 上使用它的 CSS，不使用 Hugo） |
| 许可 | MIT |
| 版权 | Copyright (c) 2020 nanxiaobei and adityatelange；Copyright (c) 2021-2026 adityatelange |
| 版本 | commit `d3768854d00ad003b0a8dbdba254ce9224377a01`（2026-08-02） |
| 来源目录 | 上游 `assets/css/` |
| 落地位置 | `src/styles/papermod/`（18 个文件） |
| 引入顺序 | `src/styles/papermod.css`，与上游 `layouts/_partials/head.html` 的拼接顺序一致 |
| 完整性 | `src/styles/papermod/MANIFEST.json` 记录每个文件的 SHA256 |

许可原文的落点有三处：

| 位置 | 作用 |
| --- | --- |
| 本文件 | 人读的来源与同步说明 |
| `LICENSE-PaperMod`（仓库根目录） | 上游 MIT 原文，随源码分发 |
| `public/third-party-licenses.txt` → 站点 `/third-party-licenses.txt` | 随**构建产物**发布，满足"notice 需随副本分发"的要求 |

注：CSS 打包时会剥掉所有注释（`lightningcss` 不留 `/*!` 保留注释），
所以许可声明不能靠写在样式表里，必须单独出一个文件。自检里有一条会确认这个文件确实在 `dist/` 里。

### 规矩

**不要直接编辑 `src/styles/papermod/` 下的文件。** 外观调整写在 `src/styles/site.css`，
它在这份主题样式之后加载。原因很实际：这些文件是从上游整份复制的，
一旦就地修改，下次同步上游就会静默丢失改动。

```bash
npm run verify:theme              # 用清单里的哈希做离线校验（CI 会跑）
node scripts/verify-theme.mjs --upstream   # 额外抓上游文件逐个比对，需要网络
```

### 同步到新版本

1. `node scripts/verify-theme.mjs --upstream` 先确认当前是否还是原样。
2. 拉取上游目标 commit 的 `assets/css/`，整体覆盖 `src/styles/papermod/`。
3. 重新生成 `MANIFEST.json` 里的 commit 与哈希：

   ```bash
   node -e '
   const fs=require("fs"),path=require("path"),crypto=require("crypto");
   const base="src/styles/papermod";
   const walk=(d,o=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):o.push(p);}return o;};
   const files=walk(base).filter(f=>f.endsWith(".css")).sort();
   const m=Object.fromEntries(files.map(f=>[path.relative(base,f),crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")]));
   const old=JSON.parse(fs.readFileSync(base+"/MANIFEST.json","utf8"));
   fs.writeFileSync(base+"/MANIFEST.json",JSON.stringify({...old,files:m},null,2)+"\n");
   '
   ```

   记得同时把 `commit` 与 `commitDate` 改成新版本的值。

4. `npm run build` 后跑 `npm run audit`（自检会检查圆角 token、代码块底色、
   系统字体栈、未定义类等与主题相关的约定），确认没有选择器在新版本里被改名。

## 站点图标（Twemoji）

| 项 | 值 |
| --- | --- |
| 项目 | [jdecked/twemoji](https://github.com/jdecked/twemoji)（Twitter Twemoji 的维护分支） |
| 用途 | `src/assets/favicon.svg`：一杯咖啡（U+2615 HOT BEVERAGE） |
| 许可 | CC-BY 4.0（[全文](https://creativecommons.org/licenses/by/4.0/)） |
| 版本 | commit `b6b55fef1e8636b540a6d016a4729ca8cdf2e60b`，`assets/svg/2615.svg` |
| 改动 | 仅删除 XML 声明，viewBox 与路径原样保留；文件头部加了来源注释 |

为什么用一个现成的矢量图形，而不是像参考站那样把 emoji 字体栅格化：
彩色 emoji 字体的字形数据不能随便再分发（Apple Color Emoji 尤其），
而 Twemoji 是 CC-BY 4.0，署名即可用。

### 光栅图标怎么来的

`src/assets/` 下除了矢量还有一整套光栅图标，供只看光栅的场合使用
（Windows 任务栏、iOS 主屏、部分老浏览器）。它们由矢量生成：

```bash
brew install librsvg          # 提供 rsvg-convert
bash scripts/make-icons.sh    # 生成 favicon.ico(16/32/48) + 16 + 32 + apple-touch-icon(180)
```

**改了 `favicon.svg` 就要重跑这个脚本**，否则光栅版还是旧图形。
两套文件的引用都在 `src/layouts/BaseLayout.astro`，走 `import` 拿到内容哈希。

## 图标

| 项 | 值 |
| --- | --- |
| 项目 | [Tabler Icons](https://github.com/tabler/tabler-icons) |
| 许可 | MIT |
| 用法 | 构建期用 `?raw` 读入官方 SVG 源文件，统一线宽后内联（`src/components/Icon.astro`） |

## 评论

giscus（MIT）以 iframe 形式在运行时从 `giscus.app` 加载，不进入本仓库产物。
