#!/usr/bin/env node
/**
 * 主题完整性检查：确认 src/styles/papermod/ 下的文件与上游逐字节一致
 * ---------------------------------------------------------------------------
 * 为什么需要它：PaperMod 的样式是整份复制进来的（vendored），一旦有人为了
 * 改某个局部而直接编辑这些文件，就会在下次同步上游时悄悄丢失改动。
 * 这个脚本用 MANIFEST.json 里的 sha256 做离线校验，改没改一目了然。
 *
 * 用法：
 *   node scripts/verify-theme.mjs              离线校验哈希
 *   node scripts/verify-theme.mjs --upstream   额外抓上游文件比对（需要网络）
 *   同步上游：先跑 --upstream 确认差异，再整体替换文件并重算 MANIFEST.json
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themeDir = join(root, 'src/styles/papermod');
const manifestPath = join(themeDir, 'MANIFEST.json');
const withUpstream = process.argv.includes('--upstream');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!existsSync(manifestPath)) {
  console.error('缺少 src/styles/papermod/MANIFEST.json');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const actual = new Map(
  walk(themeDir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => [relative(themeDir, file), sha256(readFileSync(file))]),
);

const problems = [];
for (const [name, hash] of Object.entries(manifest.files)) {
  const got = actual.get(name);
  if (!got) problems.push(`${name} 缺失`);
  else if (got !== hash) problems.push(`${name} 被改动过`);
  actual.delete(name);
}
for (const leftover of actual.keys()) problems.push(`${leftover} 不在清单里`);

console.log(
  `主题文件 ${Object.keys(manifest.files).length} 个，上游 ${manifest.commit.slice(0, 7)}（${manifest.commitDate}，${manifest.license}）`,
);
console.log(problems.length === 0 ? '✓ 与清单一致' : `✗ ${problems.length} 处不一致`);

if (withUpstream) {
  const base = `${manifest.upstream.replace('github.com', 'raw.githubusercontent.com')}/${manifest.commit}/${manifest.sourceDir}`;
  for (const name of Object.keys(manifest.files)) {
    try {
      const response = await fetch(`${base}/${name}`);
      if (!response.ok) {
        problems.push(`${name} 上游返回 ${response.status}`);
        continue;
      }
      const remote = sha256(Buffer.from(await response.arrayBuffer()));
      if (remote !== manifest.files[name]) problems.push(`${name} 与上游不一致`);
    } catch (error) {
      problems.push(`${name} 拉取失败：${error.message}`);
    }
  }
  console.log('（已额外比对上游）');
}

if (problems.length) {
  console.log('\n不一致项：');
  for (const item of problems) console.log(`  - ${item}`);
  console.log('\n要改主题样式，请把改动写到 src/styles/site.css，不要直接改这些文件。');
  process.exit(1);
}
