/**
 * 站点唯一配置源（Single Source of Truth）
 * ---------------------------------------------------------------------------
 * 个性化只改这个文件：
 *   site       站点标题、描述、url、base、分页
 *   author     个人介绍（hero 用 lead，about 用 bio）、照片、社交链接
 *   nav        导航
 *   categories 分类（slug / 名称 / 一句话定位）
 *   images     图片策略（真实照片是硬要求，见下方说明）
 *   comments   评论 Provider（none / giscus）
 *   wechat     公众号导出模板
 *   features   功能开关
 *
 * 环境变量（CI 覆盖）：SITE_URL / BASE_PATH
 *
 * 文案规范（来自 design-taste-frontend skill §9）：
 *   1. 全站禁止破折号（—— 与 –），需要停顿就用逗号、冒号或句号
 *   2. 元信息一行最多一个中点（·），结构化信息优先用间距或分组
 *   3. hero 只放 4 个文本元素：状态行、标题、引导语、按钮
 *   4. 不写空泛动词（赋能、无缝、重新定义），只写具体的事
 */

/** 允许的图标名，对应 components/Icon.astro 中的 Tabler 图标映射 */
export type IconName = 'github' | 'wechat' | 'mail' | 'rss' | 'link' | 'x';

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
}

export interface Category {
  /** URL 中使用的 slug（英文/拼音），保持稳定不要改 */
  slug: string;
  /** 页面展示名 */
  name: string;
  /** 一句话定位：用于分类列表与分类页副标题 */
  description: string;
}

export interface NavItem {
  label: string;
  href: string;
}

const env = (key: string, fallback: string): string =>
  (typeof process !== 'undefined' && process.env?.[key]) || fallback;

export const siteConfig = {
  /* ------------------------------------------------------------------ */
  /* 站点基础信息                                                        */
  /* ------------------------------------------------------------------ */
  site: {
    title: '你的名字',
    subtitle: '写代码，也写思考',
    description:
      '一个关于前端工程、后端架构、AI 工具链与读书笔记的个人博客。用 Markdown 写作，同步发布到微信公众号。',
    /** 生产地址（不带结尾斜杠）。GitHub Pages 项目站点填 https://<user>.github.io */
    url: env('SITE_URL', 'https://yunjiao-chen.github.io'),
    /**
     * 部署子路径，决定所有内链与资源的路径前缀：
     *   仓库名 personal  → 项目站点 https://yunjiao-chen.github.io/personal/ → 填 '/personal'
     *   仓库名 <user>.github.io（用户站点）或绑定自定义域名 → 填 '/'
     * CI 里由 actions/configure-pages 注入 BASE_PATH 覆盖，这里只是本地默认值。
     */
    base: env('BASE_PATH', '/personal'),
    lang: 'zh-CN',
    locale: 'zh_CN',
    timezone: 'Asia/Shanghai',
    postsPerPage: 6,
    /** 主页索引区展示的条数（超过 5 条时用双栏索引，不用单列长列表） */
    latestCount: 6,
  },

  /* ------------------------------------------------------------------ */
  /* 作者                                                                */
  /* ------------------------------------------------------------------ */
  author: {
    name: '你的名字',
    /** 真实照片放在 public/ 下，填写如 '/portrait.jpg'；留空则使用远程占位照片 */
    photo: '',
    tagline: '把复杂的事说清楚',
    /** hero 引导语：一句话，40 字以内（skill §4.7 要求 hero 文案短） */
    lead: '记录前端工程、后端架构与 AI 工具链上的实践。写清楚取舍，而不只是结论。',
    /** 当前在做的事，显示为 hero 的状态行（不配彩色圆点） */
    status: '正在写 Astro 实战系列',
    /** 关于页的自我介绍段落 */
    bio: [
      '你好，我是你的名字，一名全栈工程师，目前在「某公司」做平台与基础设施。',
      '这个博客记录我在前端工程、后端架构和 AI 工具链上的实践与踩坑，也写读书笔记和生活随笔。',
      '我相信写作是最好的学习方式。如果某篇文章帮到了你，欢迎在评论区聊聊。',
    ],
    jobTitle: '全栈工程师',
    company: '某公司',
    location: '中国 杭州',
    email: 'you@example.com',
    /** 关于页经历时间线 */
    timeline: [
      {
        year: '2024',
        title: '开始写博客',
        description: '把散落各处的笔记整理成文章，逼自己把问题想透。',
      },
      {
        year: '2022',
        title: '转向平台与基础设施',
        description: '从业务开发走向工程效率、构建体系与可观测性。',
      },
      {
        year: '2019',
        title: '入行做全栈',
        description: '从前端起步，逐步接手服务端与数据链路。',
      },
    ],
    socials: [
      { label: 'GitHub', href: 'https://github.com/yourname', icon: 'github' },
      { label: '微信公众号', href: '#subscribe', icon: 'wechat' },
      { label: '邮箱', href: 'mailto:you@example.com', icon: 'mail' },
      { label: 'RSS', href: '/rss.xml', icon: 'rss' },
    ] as SocialLink[],
  },

  /* ------------------------------------------------------------------ */
  /* 图片策略                                                            */
  /* ------------------------------------------------------------------ */
  images: {
    /**
     * 没有本地封面时使用远程占位照片（Lorem Picsum，真实照片，seed 稳定）。
     * 设计规范要求页面必须有真实图片，不接受纯文字页面，也不接受用 div 拼的假截图。
     * 换成自己的图片：文件放进 public/images/，在文章 frontmatter 写 cover: /images/xxx.jpg
     * 如果部署环境访问不了外部图片服务，把下面两项设为 false，页面回落为纯排版。
     */
    remoteCovers: true,
    remotePortrait: true,
    /** 占位照片服务前缀，可替换为自建图床 */
    coverBase: 'https://picsum.photos/seed',
    portraitSeed: 'portrait-of-the-author',
  },

  /* ------------------------------------------------------------------ */
  /* 导航                                                                */
  /* ------------------------------------------------------------------ */
  nav: [
    { label: '首页', href: '/' },
    { label: '文章', href: '/blog/' },
    { label: '分类', href: '/categories/' },
    { label: '标签', href: '/tags/' },
    { label: '关于', href: '/about/' },
  ] as NavItem[],

  /* ------------------------------------------------------------------ */
  /* 分类（5 个固定栏目）                                                 */
  /* ------------------------------------------------------------------ */
  categories: [
    {
      slug: 'frontend',
      name: '前端工程',
      description: '框架原理、性能优化、构建工具与 CSS 工程化。',
    },
    {
      slug: 'backend',
      name: '后端与架构',
      description: '服务端设计、数据库、分布式系统与稳定性实践。',
    },
    {
      slug: 'ai',
      name: 'AI 与工具链',
      description: '大模型应用、Agent 工程与提升效率的工具链。',
    },
    {
      slug: 'reading',
      name: '读书笔记',
      description: '技术书与非技术书的摘录、批注与延伸思考。',
    },
    {
      slug: 'life',
      name: '生活随笔',
      description: '年度总结、旅行见闻与日常里的小发现。',
    },
  ] as Category[],

  /* ------------------------------------------------------------------ */
  /* 评论（Provider 抽象层）                                              */
  /* ------------------------------------------------------------------ */
  comments: {
    /** 'none' 渲染占位说明；'giscus' 启用 GitHub Discussions 评论 */
    provider: 'none' as 'none' | 'giscus',
    giscus: {
      repo: 'yourname/my-blog',
      repoId: '',
      category: 'Announcements',
      categoryId: '',
      mapping: 'pathname',
      strict: false,
      reactionsEnabled: true,
      inputPosition: 'top',
      lang: 'zh-CN',
    },
  },

  /* ------------------------------------------------------------------ */
  /* 微信公众号导出                                                       */
  /* ------------------------------------------------------------------ */
  wechat: {
    showCopyButton: true,
    /** 导出正文开头的引导语（留空则不插入） */
    openingLine: '',
    /** 结尾署名行 */
    signature: '本文首发于我的博客，公众号同步更新。',
    /** 结尾引导关注（留空则不渲染） */
    followText: '如果这篇文章对你有帮助，欢迎关注公众号「你的公众号」。',
    accountName: '你的公众号',
    exportDir: 'wechat',
  },

  /* ------------------------------------------------------------------ */
  /* 功能开关                                                            */
  /* ------------------------------------------------------------------ */
  features: {
    darkMode: true,
    search: true,
    rss: true,
    readingTime: true,
    toc: true,
    postNav: true,
  },

  footer: {
    /** 备案号等信息，留空则不显示 */
    icp: '',
    since: 2024,
    note: '本站内容采用 CC BY-NC-SA 4.0 许可协议。',
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** 按 slug 取分类定义 */
export function getCategory(slug: string): Category | undefined {
  return siteConfig.categories.find((c) => c.slug === slug);
}

/** 分类名 → 分类定义 */
export function getCategoryByName(name: string): Category | undefined {
  return siteConfig.categories.find((c) => c.name === name);
}

/** 拼接部署 base 路径，保证 GitHub Pages 子路径下链接正确 */
export function withBase(path: string): string {
  const base = siteConfig.site.base.replace(/\/+$/, '');
  if (!path || path === '/') return `${base}/`;
  if (
    /^(https?:)?\/\//.test(path) ||
    path.startsWith('mailto:') ||
    path.startsWith('#') ||
    path.startsWith('data:')
  ) {
    return path;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 绝对地址（RSS / sitemap / OG） */
export function absoluteUrl(path: string): string {
  const url = siteConfig.site.url.replace(/\/+$/, '');
  return `${url}${withBase(path)}`;
}
