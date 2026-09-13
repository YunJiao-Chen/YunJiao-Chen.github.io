/**
 * 图片解析层
 * ---------------------------------------------------------------------------
 * 设计规范（design-taste-frontend §4.8 / §9.E）要求页面出现真实照片，
 * 因此没有本地封面时回落到稳定的远程占位照片（seed 由 slug 决定，构建可复现）。
 * 换成自己的图片：文件放 public/images/，frontmatter 里写 cover: /images/xxx.jpg
 */
import { siteConfig, withBase } from '../../site.config.ts';
import type { Post } from './posts.ts';

/** 文章封面：本地优先，其次远程占位，最后没有（页面会回落为纯排版） */
export function coverUrl(post?: Post): string | undefined {
  if (!post) return undefined;
  if (post.data.cover) return withBase(post.data.cover);
  if (!siteConfig.images.remoteCovers) return undefined;
  return `${siteConfig.images.coverBase}/${post.id}/1600/1000`;
}

/** 作者照片：本地优先，其次远程占位 */
export function portraitUrl(): string | undefined {
  if (siteConfig.author.photo) return withBase(siteConfig.author.photo);
  if (!siteConfig.images.remotePortrait) return undefined;
  return `${siteConfig.images.coverBase}/${siteConfig.images.portraitSeed}/1200/1500`;
}

