const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'https://example.com'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  exclude: ['/posts-sitemap.xml', '/pages-sitemap.xml', '/*', '/posts/*'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: '/admin/*' },
      // Явно пускаем ИИ-ботов (GEO, cross-project pool #051): обнаружимость и
      // цитируемость контента у нейросетей. /admin закрыт для всех.
      { userAgent: 'GPTBot', allow: '/', disallow: '/admin/*' },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: '/admin/*' },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: '/admin/*' },
      { userAgent: 'ClaudeBot', allow: '/', disallow: '/admin/*' },
      { userAgent: 'Claude-Web', allow: '/', disallow: '/admin/*' },
      { userAgent: 'anthropic-ai', allow: '/', disallow: '/admin/*' },
      { userAgent: 'PerplexityBot', allow: '/', disallow: '/admin/*' },
      { userAgent: 'Google-Extended', allow: '/', disallow: '/admin/*' },
      { userAgent: 'YandexBot', allow: '/', disallow: '/admin/*' },
    ],
    additionalSitemaps: [`${SITE_URL}/pages-sitemap.xml`, `${SITE_URL}/posts-sitemap.xml`],
  },
}
