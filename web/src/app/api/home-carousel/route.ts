import configPromise from '@payload-config'
import { getPayload } from 'payload'

const CENTER_SLUG = 'gonba'
const MAX_ORBIT_ITEMS = 12

type MediaDoc = { id?: string | number; url?: string | null; alt?: string | null }
type HomeCarouselGlobal = {
  center?: { link?: string | null; image?: unknown } | null
  items?: Array<{ link?: string | null; image?: unknown }> | null
}

type CarouselApiEntry = {
  title: string
  link: string
  image: { id: string; url: string; alt?: string } | null
}

function toImage(media: unknown) {
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const doc = media as MediaDoc
  if (!doc.url) return null
  const url = String(doc.url).trim()
  const normalizedUrl = url.startsWith('http') || url.startsWith('/') ? url : `/media/${url}`
  return { id: String(doc.id ?? ''), url: normalizedUrl, alt: typeof doc.alt === 'string' ? doc.alt : undefined }
}

const normalizeLinkKey = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase()

export async function GET() {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'projects',
    depth: 1,
    limit: MAX_ORBIT_ITEMS + 1,
    sort: 'sortOrder,-updatedAt',
    overrideAccess: false,
    where: { isActive: { equals: true } },
    select: { title: true, shortLabel: true, slug: true, logo: true, heroImage: true, sortOrder: true },
  })

  const docs = result.docs as Array<{
    id: string | number
    title: string
    slug: string
    shortLabel?: string | null
    logo?: unknown
    heroImage?: unknown
  }>

  let legacyCarousel: HomeCarouselGlobal | null = null
  try {
    legacyCarousel = (await payload.findGlobal({ slug: 'homeCarousel', depth: 1 })) as HomeCarouselGlobal
  } catch {
    legacyCarousel = null
  }

  const legacyImageByLink = new Map<string, ReturnType<typeof toImage>>()
  for (const item of legacyCarousel?.items || []) {
    const link = typeof item?.link === 'string' ? item.link : ''
    if (!link) continue
    const key = normalizeLinkKey(link)
    if (!legacyImageByLink.has(key)) {
      legacyImageByLink.set(key, toImage(item.image))
    }
  }

  const centerDoc = docs.find((d) => d.slug === CENTER_SLUG) ?? docs[0]
  const orbitDocs = docs.filter((d) => d.slug !== centerDoc?.slug).slice(0, MAX_ORBIT_ITEMS)
  const centerLink = centerDoc ? `/projects/${centerDoc.slug}` : '/projects/gonba'
  const centerKey = normalizeLinkKey(centerLink)
  const legacyCenterImage = toImage(legacyCarousel?.center?.image)

  const label = (d: { shortLabel?: string | null; title: string }) =>
    d.shortLabel && d.shortLabel !== 'Проект' ? d.shortLabel : d.title

  const center: CarouselApiEntry | null = centerDoc
    ? {
        title: label(centerDoc),
        link: centerLink,
        image: toImage(centerDoc.logo) || toImage(centerDoc.heroImage) || legacyCenterImage || legacyImageByLink.get(centerKey) || null,
      }
    : null

  const items: CarouselApiEntry[] = orbitDocs.map((d) => ({
    title: label(d),
    link: `/projects/${d.slug}`,
    image: toImage(d.logo) || toImage(d.heroImage) || legacyImageByLink.get(normalizeLinkKey(`/projects/${d.slug}`)) || null,
  }))

  return Response.json({ items, center })
}
