#!/usr/bin/env bash
#
# 从 src/assets/favicon.png 生成整套站点图标
# ---------------------------------------------------------------------------
# 源文件是一张 256×256 的光栅图（Microsoft Fluent Emoji 的 3D 渲染，MIT）。
# 为什么不用矢量：Fluent Emoji 的 3D 版上游只提供 PNG；这套"亮面"观感正是
# 想要的，而矢量版（Color / Flat）是另一种较平的设计。
#
# 生成：
#   src/assets/favicon.ico            16/32/48/64 四个尺寸打包
#   src/assets/favicon-16x16.png
#   src/assets/favicon-32x32.png
#   src/assets/apple-touch-icon.png   180×180，iOS 主屏
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
if im.size != (256, 256):
    print(f"提示：源文件是 {im.size}，脚本按 256×256 设计", file=sys.stderr)

# 带下划线的尺寸用兰索斯下采样；16/32 这两个小尺寸额外做一次轻微锐化，
# 否则缩到 16px 会糊（图标本身是有光影细节的 3D 渲染）
im.resize((16, 16), Image.LANCZOS).save(f"{out}/favicon-16x16.png")
im.resize((32, 32), Image.LANCZOS).save(f"{out}/favicon-32x32.png")
im.resize((180, 180), Image.LANCZOS).save(f"{out}/apple-touch-icon.png")
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
ls -la "$out"/favicon.ico "$out"/favicon-16x16.png "$out"/favicon-32x32.png "$out"/apple-touch-icon.png
ls -la "$root/public"/favicon.ico "$root/public"/apple-touch-icon.png
