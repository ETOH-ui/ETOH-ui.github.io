/**
 * 站点全局配置
 * 改这里就能改站点的基本信息，不用碰模板
 */
export default {
  // 站点名，用在浏览器标签页标题后缀、侧边栏等处
  name: 'jian的小屋',
  // 站点标题（banner 上那行大字）
  title: '迷茫的原因是你学了一堆拼图',
  // 副标题（banner 标题下面小一号的字），留空则不显示
  subtitle: '却不知道拼出来的是什么画',

  author: 'jian',
  // 侧边栏头像下方的签名，留空则不显示
  authorBio: '',

  // 站点描述，用于 SEO
  description: 'jian 的个人博客，记录一些笔记和折腾过程。',
  keywords: ['博客', '笔记', '前端', '安全'],
  lang: 'zh-CN',

  // 部署地址，同时用于 sitemap 的绝对链接
  url: 'https://ETOH-ui.github.io',
  // 站点根路径。仓库名是 ETOH-ui.github.io 时保持 '/'；若是子路径仓库改成 '/仓库名/'
  base: '/',

  // banner 大图
  banner: '/images/banner.webp',
  // 侧边栏头像
  avatar: '/images/avatar.webp',

  // 建站年份，页脚 copyright 用
  since: 2026,

  // 备案号之类的，留空不显示
  icp: '',

  // 访问统计。
  // provider: 'none'（统一显示 0，不加载任何统计脚本）| 'busuanzi' | 'goatcounter' | 'umami'
  analytics: {
    provider: 'none',
    // goatcounter 填站点 code，umami 填 website id 和 script 地址
    goatcounterCode: '',
    umamiWebsiteId: '',
    umamiScriptUrl: '',
    // 是否在文章页显示阅读量
    showPostViews: true,
    // 是否在侧边栏显示总访问量
    showSiteViews: true
  }
};
