#!/usr/bin/env bash
#
# 从 src/assets/favicon.svg 生成光栅图标（ico / png / apple-touch-icon）
# ---------------------------------------------------------------------------
# 为什么要光栅版：SVG 图标在支持它的浏览器里没问题，但
#   - 标签页、Windows 任务栏、iOS 主屏这些地方仍然可能只看 .ico / .png
#   - 参考站（lilianweng.github.io）用的就是这一整套光栅文件
# 所以每份都出：favicon.ico(16/32/48) + 16/32 png + 180 的 apple-touch-icon。
#
# 依赖（都在 macOS 上装得到）：
#   brew install librsvg        # 提供 rsvg-convert
#   python3 -c "import PIL"     # Pillow，用来打包多尺寸 ICO
#
# 用法：bash scripts/make-icons.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/src/assets/favicon.svg"
out="$root/src/assets"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

command -v rsvg-convert >/dev/null || {
  echo "缺少 rsvg-convert，先跑：brew install librsvg" >&2
  exit 1
}

for size in 16 32 48 180 512; do
  rsvg-convert -w "$size" -h "$size" "$src" -o "$tmp/$size.png"
done

cp "$tmp/16.png" "$out/favicon-16x16.png"
cp "$tmp/32.png" "$out/favicon-32x32.png"
cp "$tmp/180.png" "$out/apple-touch-icon.png"

# ICO 里塞 16/32/48 三个尺寸，用 512 的渲染结果做兰索斯下采样
python3 - "$tmp" "$out" <<'PY'
import sys
from PIL import Image

tmp, out = sys.argv[1], sys.argv[2]
Image.open(f"{tmp}/512.png").convert("RGBA").save(
    f"{out}/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
)
ico = Image.open(f"{out}/favicon.ico")
print("favicon.ico 内含尺寸:", sorted(ico.info.get("sizes", [])))
PY

# 根路径副本：浏览器、书签栏、iOS、RSS 阅读器里有不少地方不看你页面里的
# <link>，而是按约定直接取 /favicon.ico、/apple-touch-icon.png。
# 页面里指向的仍是带内容哈希的那份，这几份只是给"按约定取图"的场合兜底。
# 必须在 ICO 生成之后拷贝，否则拷过去的是上一次的旧 ico。
root="$(cd "$out/../.." && pwd)"
cp "$out/favicon.ico"          "$root/public/favicon.ico"
cp "$out/favicon.svg"          "$root/public/favicon.svg"
cp "$out/apple-touch-icon.png" "$root/public/apple-touch-icon.png"

echo "已生成（带哈希的源文件 + 根路径兜底副本）："
ls -la "$out"/favicon.ico "$out"/favicon-16x16.png "$out"/favicon-32x32.png "$out"/apple-touch-icon.png
ls -la "$root/public"/favicon.ico "$root/public"/favicon.svg "$root/public"/apple-touch-icon.png
