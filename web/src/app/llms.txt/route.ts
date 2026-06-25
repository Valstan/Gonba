import { SITE } from '@/seo/site'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * /llms.txt — карта сайта для ИИ-краулеров (cross-project pool #051 — GEO).
 * Лежит в КОРНЕ app/ (не в route-group) — иначе не сгенерируется (см. GOTCHA G12).
 * Статическая отдача из единого конфига фактов SITE → фактологичность + ноль БД.
 */
export const dynamic = 'force-static'
export const revalidate = 86400

export function GET(): Response {
  const url = getServerSideURL()
  const abs = (path: string) => `${url}${path === '/' ? '' : path}`

  const body = [
    `# ${SITE.name} (${SITE.shortName})`,
    '',
    `> ${SITE.description}`,
    '',
    `Сайт: ${url} · Язык: русский · Регион: ${SITE.addressRegion}, Россия.`,
    '',
    '## Разделы',
    ...SITE.sections.map((s) => `- [${s.title}](${abs(s.path)}): ${s.desc}`),
    '',
    '## Карты сайта',
    `- ${url}/sitemap.xml`,
    `- ${url}/pages-sitemap.xml`,
    `- ${url}/posts-sitemap.xml`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
