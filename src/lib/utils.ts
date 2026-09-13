/**
 * 格式化与文本工具（纯函数，可在页面与脚本中复用）
 */
import { siteConfig, type Category } from '../../site.config.ts';

/** 日期 → 2026-03-15 */
export function formatDate(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 日期 → 2026 年 3 月 15 日 */
export function formatDateCN(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/** 相对时间：3 天前 / 2 个月前 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(date).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return '今天';
  if (diff < 2 * day) return '昨天';
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} 个月前`;
  return `${Math.floor(diff / (365 * day))} 年前`;
}

/** 中英混排阅读时长：中文按 350 字/分钟，英文按 220 词/分钟 */
export function readingTime(text: string): { minutes: number; label: string; words: number } {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (plain.match(/[A-Za-z0-9]+/g) ?? []).length;
  const minutes = Math.max(1, Math.round(cjk / 350 + words / 220));
  return { minutes, label: `${minutes} 分钟阅读`, words: cjk + words };
}

/** 正文 → 纯文本摘要（用于搜索索引与 SEO 兜底） */
export function toPlainText(markdown: string, maxLength = 240): string {
  const text = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * 标签 → 路由参数
 * 中文标签直接作为目录名（浏览器会自动 percent-encode，GitHub Pages 解码后匹配），
 * 因此这里保持原文，只在生成 href 时做 encodeURIComponent。
 * 注意：标签中不要包含 "/"，它会被替换为 "-"。
 */
export function tagToSlug(tag: string): string {
  return tag.trim().replace(/\//g, '-');
}

/** 取分类定义（找不到时返回兜底对象，避免渲染崩溃） */
export function categoryOf(slug: string): Category {
  return (
    siteConfig.categories.find((c) => c.slug === slug) ?? {
      slug,
      name: slug,
      description: '',
    }
  );
}

/** 站点统计：文章数 / 分类数 / 标签数 / 持续写作天数 */
export function siteStats(posts: { pubDate: Date; tags: string[] }[]) {
  const tags = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tags.add(t)));
  const dates = posts.map((p) => new Date(p.pubDate).getTime()).filter((t) => !Number.isNaN(t));
  const first = dates.length ? Math.min(...dates) : Date.now();
  const days = Math.max(1, Math.ceil((Date.now() - first) / (24 * 60 * 60 * 1000)));
  return {
    posts: posts.length,
    categories: siteConfig.categories.length,
    tags: tags.size,
    days,
  };
}
