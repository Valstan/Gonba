import configPromise from '@payload-config'
import type { CollectionSlug } from 'payload'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'
import { getServerSideURL } from '@/utilities/getURL'

const normalizeApiPath = (value: string) => {
  let path = value.trim()
  if (path.startsWith('/disk:') || path.startsWith('/app:') || path.startsWith('/urn:')) {
    path = path.slice(1)
  }
  if (path.startsWith('disk:')) {
    return path.replace(/^disk:/, '')
  }
  if (path.startsWith('app:')) {
    return path.replace(/^app:/, '')
  }
  return path
}

type UsageEntry = {
  collection: string
  id: string | number
  title?: string
  slug?: string
  adminUrl: string
  frontendUrl?: string
}

const collectionToFrontend = (collection: string, slug?: string | null) => {
  if (!slug) return null
  switch (collection) {
    case 'pages':
      return slug === 'home' ? '/' : `/${slug}`
    case 'posts':
      return `/posts/${slug}`
    case 'projects':
      return `/projects/${slug}`
    case 'events':
      return `/events/${slug}`
    case 'services':
      return `/services/${slug}`
    case 'products':
      return `/shop/${slug}`
    default:
      return null
  }
}

const buildRelationOr = (fieldPaths: string[], mediaIds: Array<number | string>) => {
  return fieldPaths.map((path) => ({
    [path]: { in: mediaIds },
  }))
}

const buildRichTextOr = (fieldPaths: string[], mediaIds: Array<number | string>) => {
  const conditions: Record<string, Record<string, string>>[] = []
  for (const fieldPath of fieldPaths) {
    for (const id of mediaIds) {
      conditions.push({
        [fieldPath]: {
          like: `${id}`,
        },
      })
    }
  }
  return conditions
}

const getStringField = (value: unknown) => (typeof value === 'string' ? value : undefined)

const relationValueToId = (value: unknown) => {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value)
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') {
      return String(id)
    }
  }
  return null
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json()) as { paths?: string[] }
  const paths = (body.paths || []).map((path) => normalizeApiPath(path)).filter(Boolean)
  if (paths.length === 0) {
    return Response.json({ usages: [] })
  }

  const payload = await getPayload({ config: configPromise })
  const orPaths = paths.flatMap((path) => [
    { yandexPath: { equals: path } },
    { yandexPath: { like: `${path}/` } },
  ])

  const mediaDocs = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 200,
    where: {
      or: orPaths,
    },
  })

  const mediaIds = mediaDocs.docs.map((doc) => doc.id)
  if (!mediaIds.length) {
    return Response.json({ usages: [] })
  }
  const mediaIdSet = new Set(mediaIds.map((id) => String(id)))

  const baseUrl = getServerSideURL()
  const usages: UsageEntry[] = []
  const collections: Array<{
    slug: CollectionSlug
    titleField: string
    slugField: string
    relationFields: string[]
    richTextFields: string[]
  }> = [
    {
      slug: 'pages',
      titleField: 'title',
      slugField: 'slug',
      relationFields: [
        'hero.media',
        'meta.image',
        'layout.items.image',
        'layout.items.photo',
        'layout.media',
      ],
      richTextFields: ['layout', 'hero.richText'],
    },
    {
      slug: 'posts',
      titleField: 'title',
      slugField: 'slug',
      relationFields: ['heroImage', 'meta.image'],
      richTextFields: ['content'],
    },
    {
      slug: 'projects',
      titleField: 'title',
      slugField: 'slug',
      relationFields: ['logo', 'heroImage', 'gallery.image'],
      richTextFields: ['description'],
    },
    {
      slug: 'events',
      titleField: 'title',
      slugField: 'slug',
      relationFields: ['heroImage', 'gallery.image'],
      richTextFields: ['content'],
    },
    {
      slug: 'services',
      titleField: 'title',
      slugField: 'slug',
      relationFields: ['heroImage'],
      richTextFields: ['description'],
    },
    {
      slug: 'products',
      titleField: 'title',
      slugField: 'slug',
      relationFields: ['images.image'],
      richTextFields: ['description'],
    },
  ]

  for (const collection of collections) {
    try {
      const relationOr = buildRelationOr(collection.relationFields, mediaIds)
      const richTextOr = buildRichTextOr(collection.richTextFields, mediaIds)
      const whereOr = [...relationOr, ...richTextOr]
      if (!whereOr.length) continue

      const result = await payload.find({
        collection: collection.slug,
        depth: 0,
        limit: 50,
        where: {
          or: whereOr,
        },
        select: {
          [collection.titleField]: true,
          [collection.slugField]: true,
        },
      })

      for (const doc of result.docs) {
        const record = doc as unknown as Record<string, unknown>
        const title = getStringField(record[collection.titleField])
        const slug = getStringField(record[collection.slugField])
        const frontendPath = collectionToFrontend(collection.slug, slug)
        usages.push({
          collection: collection.slug,
          id: doc.id,
          title,
          slug,
          adminUrl: `${baseUrl}/admin/collections/${collection.slug}/${doc.id}`,
          frontendUrl: frontendPath ? `${baseUrl}${frontendPath}` : undefined,
        })
      }
    } catch {
      // Skip problematic collection query instead of failing entire response.
    }
  }

  try {
    const homeCarousel = (await payload.findGlobal({
      slug: 'homeCarousel',
      depth: 0,
    })) as {
      center?: { image?: unknown }
      items?: Array<{ image?: unknown }>
    }

    const globalMediaIds = [
      relationValueToId(homeCarousel?.center?.image),
      ...(Array.isArray(homeCarousel?.items)
        ? homeCarousel.items.map((item) => relationValueToId(item?.image))
        : []),
    ].filter((value): value is string => Boolean(value))

    if (globalMediaIds.some((id) => mediaIdSet.has(id))) {
      usages.push({
        collection: 'homeCarousel',
        id: 'homeCarousel',
        title: 'Меню-карусель',
        adminUrl: `${baseUrl}/admin/globals/homeCarousel`,
        frontendUrl: `${baseUrl}/`,
      })
    }
  } catch {
    // Skip global lookup failures to keep usage API responsive.
  }

  return Response.json({ usages })
}
