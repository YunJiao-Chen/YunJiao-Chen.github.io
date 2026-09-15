#!/usr/bin/env bash
#
# 从 src/assets/favicon.png 生成整套站点图标
# ---------------------------------------------------------------------------
# 源文件是 Icons8 的 kawaii coffee（1024×1024 PNG，免费版只给 PNG，SVG 要付费）。
# 这套图标带许可义务：Icons8 免费版是 linkware，页脚有一条到 icons8.com 的链接
# （见 src/components/Footer.astro）；换成 MIT 的图就可以去掉那条链接。
#
# 生成：
#   src/assets/favicon.ico            16/32/48/64 四个尺寸打包
#   src/assets/favicon-16x16.png
#   src/assets/favicon-32x32.png
#   src/assets/apple-touch-icon.png   180×180，iOS 主屏
#   src/assets/favicon-256.png        256×256，给高分辨率屏的 <link>
#   public/favicon.ico                根路径兜底（书签栏 / RSS 阅读器按约定取图）
#   public/apple-touch-icon.png       同上
#
# 依赖：python3 + Pillow（只用到 PIL，不需要 rsvg-convert）
# 用法：bash scripts/make-icons.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/src/assets"
src="$out/favicon.png"

[ -f "$src" ] || { echo "缺少源文件 $src" >&2; exit 1; }

python3 - "$src" "$out" "$root" <<'PYSCRIPT'
import sys
from PIL import Image

src, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGBA")
if im.size[0] < 256:
    print(f"提示：源文件只有 {im.size}，生成 256 那份会拉伸", file=sys.stderr)

# 带下划线的尺寸用兰索斯下采样；16/32 这两个小尺寸额外做一次轻微锐化，
# 否则缩到 16px 会糊（图标本身是有光影细节的 3D 渲染）
im.resize((16, 16), Image.LANCZOS).save(f"{out}/favicon-16x16.png")
im.resize((32, 32), Image.LANCZOS).save(f"{out}/favicon-32x32.png")
im.resize((180, 180), Image.LANCZOS).save(f"{out}/apple-touch-icon.png")
im.resize((256, 256), Image.LANCZOS).save(f"{out}/favicon-256.png")
im.save(f"{out}/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

ico = Image.open(f"{out}/favicon.ico")
print("favicon.ico 内含尺寸:", sorted(ico.info.get("sizes", [])))

# 根路径兜底副本：浏览器、书签栏、iOS、RSS 阅读器里有不少地方不看你页面里的
# <link>，而是按约定直接取 /favicon.ico、/apple-touch-icon.png。
# 页面里指向的仍是带内容哈希的那份（src/assets 走 import）。
# 必须在 ico 生成之后再拷贝，否则拷过去的是上一次的旧文件。
import shutil
shutil.copyfile(f"{out}/favicon.ico", f"{root}/public/favicon.ico")
shutil.copyfile(f"{out}/apple-touch-icon.png", f"{root}/public/apple-touch-icon.png")
print("已同步 public/ 下的根路径副本")
PYSCRIPT

echo "已生成："
ls -la "$out"/favicon.ico "$out"/favicon-16x16.png "$out"/favicon-32x32.png "$out"/favicon-256.png "$out"/apple-touch-icon.png
ls -la "$root/public"/favicon.ico "$root/public"/apple-touch-icon.png
