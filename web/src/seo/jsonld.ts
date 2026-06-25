/**
 * Билдеры schema.org JSON-LD (cross-project pool #051 — SEO/GEO).
 * Чистые функции → plain-объекты для <JsonLd data={...} />. JSON.stringify сам
 * выбрасывает поля со значением undefined, поэтому опциональные поля можно
 * оставлять undefined — в выводе их не будет.
 */
import { getServerSideURL } from '@/utilities/getURL'
import { SITE } from './site'

const base = () => getServerSideURL()
const ORG_ID = () => `${base()}/#organization`

export const absoluteUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  return `${base()}${path.startsWith('/') ? '' : '/'}${path}`
}

const mediaUrl = (image: unknown): string | undefined => {
  if (!image || typeof image !== 'object') return undefined
  return absoluteUrl((image as { url?: string | null }).url)
}

export const organizationJsonLd = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID(),
  name: SITE.name,
  alternateName: SITE.shortName,
  url: base(),
  logo: absoluteUrl(SITE.logoPath),
  description: SITE.description,
  areaServed: { '@type': 'AdministrativeArea', name: SITE.addressRegion },
  address: {
    '@type': 'PostalAddress',
    addressRegion: SITE.addressRegion,
    addressCountry: SITE.addressCountry,
  },
})

export const websiteJsonLd = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${base()}/#website`,
  name: SITE.name,
  url: base(),
  inLanguage: SITE.lang,
  description: SITE.description,
  publisher: { '@id': ORG_ID() },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base()}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
})

export const breadcrumbJsonLd = (
  items: { href?: string; label: string }[],
): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.label,
    ...(it.href ? { item: absoluteUrl(it.href) } : {}),
  })),
})

type ArticleInput = {
  title?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  meta?: { description?: string | null; image?: unknown } | null
  heroImage?: unknown
  populatedAuthors?: ({ name?: string | null } | null)[] | null
}
export const articleJsonLd = (post: ArticleInput, path: string): Record<string, unknown> => {
  const url = absoluteUrl(path)
  const image = mediaUrl(post.heroImage) || mediaUrl(post.meta?.image)
  const authors = (post.populatedAuthors || [])
    .map((a) => a?.name)
    .filter((n): n is string => Boolean(n))
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title || undefined,
    description: post.meta?.description || undefined,
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt || post.publishedAt || undefined,
    image: image ? [image] : undefined,
    author: authors.length
      ? authors.map((name) => ({ '@type': 'Person', name }))
      : { '@type': 'Organization', name: SITE.name },
    publisher: { '@id': ORG_ID() },
    mainEntityOfPage: url ? { '@type': 'WebPage', '@id': url } : undefined,
    url,
    inLanguage: SITE.lang,
  }
}

type EventInput = {
  title?: string | null
  startDate?: string | null
  endDate?: string | null
  summary?: string | null
  meta?: { description?: string | null } | null
  heroImage?: unknown
}
export const eventJsonLd = (e: EventInput, path: string): Record<string, unknown> => {
  const image = mediaUrl(e.heroImage)
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title || undefined,
    startDate: e.startDate || undefined,
    endDate: e.endDate || undefined,
    description: e.summary || e.meta?.description || undefined,
    image: image ? [image] : undefined,
    url: absoluteUrl(path),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: `Усадьба ${SITE.shortName}`,
      address: {
        '@type': 'PostalAddress',
        addressRegion: SITE.addressRegion,
        addressCountry: SITE.addressCountry,
      },
    },
    organizer: { '@id': ORG_ID() },
    inLanguage: SITE.lang,
  }
}

type ProductInput = {
  title?: string | null
  summary?: string | null
  price?: number | null
  currency?: string | null
  images?: ({ image?: unknown } | null)[] | null
  meta?: { description?: string | null } | null
}
export const productJsonLd = (p: ProductInput, path: string): Record<string, unknown> => {
  const url = absoluteUrl(path)
  const images = (p.images || [])
    .map((i) => mediaUrl(i?.image))
    .filter((u): u is string => Boolean(u))
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title || undefined,
    description: p.summary || p.meta?.description || undefined,
    image: images.length ? images : undefined,
    url,
    offers:
      typeof p.price === 'number'
        ? {
            '@type': 'Offer',
            price: p.price,
            priceCurrency: p.currency || 'RUB',
            availability: 'https://schema.org/InStock',
            url,
          }
        : undefined,
  }
}

type ServiceInput = {
  title?: string | null
  summary?: string | null
  price?: number | null
  currency?: string | null
  meta?: { description?: string | null } | null
}
export const serviceJsonLd = (s: ServiceInput, path: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: s.title || undefined,
  description: s.summary || s.meta?.description || undefined,
  url: absoluteUrl(path),
  provider: { '@id': ORG_ID() },
  areaServed: { '@type': 'AdministrativeArea', name: SITE.addressRegion },
  offers:
    typeof s.price === 'number'
      ? { '@type': 'Offer', price: s.price, priceCurrency: s.currency || 'RUB' }
      : undefined,
})

type ProjectInput = {
  title?: string | null
  summary?: string | null
  excerpt?: string | null
  heroImage?: unknown
  logo?: unknown
}
export const projectJsonLd = (pr: ProjectInput, path: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: pr.title || undefined,
  description: pr.summary || pr.excerpt || undefined,
  url: absoluteUrl(path),
  image: mediaUrl(pr.heroImage) || mediaUrl(pr.logo) || undefined,
  parentOrganization: { '@id': ORG_ID() },
  areaServed: { '@type': 'AdministrativeArea', name: SITE.addressRegion },
})
