/**
 * 文章查询层：所有页面只通过这里拿数据，方便统一排序 / 草稿过滤 / 分页
 */
import { getCollection, type CollectionEntry } from 'astro:content';

import { siteConfig } from '../../site.config.ts';
import { categoryOf, readingTime, tagToSlug } from './utils.ts';

export type Post = CollectionEntry<'blog'>;

/** 生产构建过滤草稿；开发环境保留以便预览 */
const includeDrafts = import.meta.env.DEV;

/** 全部文章：按发布日期倒序 */
export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => includeDrafts || !data.draft);
  return posts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime(),
  );
}

/** 文章 URL：/blog/<id>/ */
export function postPath(post: Post): string {
  return `/blog/${post.id}/`;
}

/** 主页精选：优先 featured，不足时用最新补齐 */
export async function getFeaturedPosts(limit = 3): Promise<Post[]> {
  const posts = await getAllPosts();
  const featured = posts.filter((p) => p.data.featured);
  if (featured.length >= limit) return featured.slice(0, limit);
  const rest = posts.filter((p) => !p.data.featured);
  return [...featured, ...rest].slice(0, limit);
}

/** 最新 N 篇（可排除指定 id） */
export async function getLatestPosts(limit: number, excludeIds: string[] = []): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => !excludeIds.includes(p.id)).slice(0, limit);
}

/** 单分类文章 */
export async function getPostsByCategory(categorySlug: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => p.data.category === categorySlug);
}

/** 单标签文章 */
export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((p) => p.data.tags.includes(tag));
}

/** 分类 + 文章数 + 最近一篇（主页分类卡片的数据源） */
export async function getCategorySummaries() {
  const posts = await getAllPosts();
  return siteConfig.categories.map((category) => {
    const list = posts.filter((p) => p.data.category === category.slug);
    return { ...category, count: list.length, latest: list[0] };
  });
}

/** 标签 + 出现次数（按频次倒序） */
export async function getTagSummaries() {
  const posts = await getAllPosts();
  const map = new Map<string, number>();
  posts.forEach((p) => p.data.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1)));
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, slug: tagToSlug(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 上一篇 / 下一篇（按时间线） */
export async function getAdjacentPosts(id: string) {
  const posts = await getAllPosts();
  const index = posts.findIndex((p) => p.id === id);
  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}

/** 相关文章：同分类优先，其次标签重合度 */
export async function getRelatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const posts = await getAllPosts();
  const others = posts.filter((p) => p.id !== post.id);
  const scored = others.map((p) => {
    const sameCategory = p.data.category === post.data.category ? 2 : 0;
    const sharedTags = p.data.tags.filter((t) => post.data.tags.includes(t)).length;
    return { post: p, score: sameCategory + sharedTags };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || +new Date(b.post.data.pubDate) - +new Date(a.post.data.pubDate))
    .slice(0, limit)
    .map((s) => s.post);
}

/** 分页：返回第 page 页的数据与页数 */
export async function paginate(posts: Post[], page: number, perPage = siteConfig.site.postsPerPage) {
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * perPage;
  return {
    items: posts.slice(start, start + perPage),
    current,
    totalPages,
    total: posts.length,
  };
}

/** 文章的展示用派生数据：分类定义 / 阅读时长 / 公众号标题 */
export function postMeta(post: Post) {
  const body = post.body ?? '';
  const category = categoryOf(post.data.category);
  return {
    category,
    reading: readingTime(body),
    wechatTitle: post.data.wechat?.title ?? post.data.title,
    wechatDigest: post.data.wechat?.digest ?? post.data.description,
    wechatEnabled: post.data.wechat?.enable !== false,
  };
}

/** 搜索索引（构建期生成 JSON，客户端按需加载） */
export async function buildSearchIndex() {
  const posts = await getAllPosts();
  return posts.map((post) => {
    const meta = postMeta(post);
    return {
      id: post.id,
      title: post.data.title,
      description: post.data.description,
      url: postPath(post),
      category: meta.category.slug,
      categoryName: meta.category.name,
      tags: post.data.tags,
      date: new Date(post.data.pubDate).toISOString().slice(0, 10),
      reading: meta.reading.minutes,
    };
  });
}
