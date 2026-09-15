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

## 站点图标（Icons8 · kawaii coffee）

| 项 | 值 |
| --- | --- |
| 项目 | [Icons8](https://icons8.com)，图标页 <https://icons8.com/icon/KU9YxLHkVe7m/kawaii-coffee> |
| 用途 | `src/assets/favicon.png`：一杯咖啡（kawaii 风格，1024×1024 PNG） |
| 取得方式 | `https://img.icons8.com/?size=1024&id=KU9YxLHkVe7m&format=png` |
| 许可 | **Icons8 免费许可（linkware）** |
| 改动 | 无，直接用上游 PNG；下游只是缩放 |

### 这条许可要求什么

Icons8 免费版的原话：**「凡是用到我们内容的页面，请添加链接 icons8.com。
如果您的大多数页面都用了，则在页脚加链接即可。」**
站点图标出现在每一页，所以本站把这条链接放在**页脚**：

```
图标 Icons8      →  https://icons8.com
```

另外：**SVG 属于付费格式**，免费只能拿到 PNG（接口会返回
`{"error":"paid format requested"}`），所以本站的图标是一套光栅，没有 `favicon.svg`。

### 想脱离这条义务时的办法

换成 MIT 授权的图标即可删掉页脚那条链接。同一"亮面"观感在
[Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 里有 3D 版
（`assets/<名字>/3D/<名字>_3d.png`，256×256，MIT）——本项目在选型时比对过，
观感属同一路数，且没有署名以外的附加条件。

### 光栅图标怎么来的

```bash
bash scripts/make-icons.sh    # favicon.ico(16/32/48/64) + 16 + 32 + 256 + apple-touch-icon(180)
```

只依赖 python3 + Pillow（源文件是光栅，不需要 rsvg-convert）。
**改了 `src/assets/favicon.png` 就要重跑这个脚本**，否则光栅版还是旧图形。

生成结果落在两处，用途不同：

| 位置 | 用途 |
| --- | --- |
| `src/assets/favicon*` | 页面 `<link>` 指向的就是这几份，走 `import` 拿到内容哈希，换图形自动换 URL |
| `public/favicon.ico`、`apple-touch-icon.png` | 根路径兜底：书签栏、iOS、RSS 阅读器这类地方不看 `<link>`，按约定直接取这些路径 |

两处必须一致，自检里有一条会逐字节比对（改了图形忘了重跑脚本就会报红）。

## 图标

| 项 | 值 |
| --- | --- |
| 项目 | [Tabler Icons](https://github.com/tabler/tabler-icons) |
| 许可 | MIT |
| 用法 | 构建期用 `?raw` 读入官方 SVG 源文件，统一线宽后内联（`src/components/Icon.astro`） |

## 评论

giscus（MIT）以 iframe 形式在运行时从 `giscus.app` 加载，不进入本仓库产物。
