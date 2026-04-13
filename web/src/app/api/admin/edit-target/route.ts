import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'

type EditableCollection = 'pages' | 'posts' | 'projects' | 'events' | 'services' | 'products'

type AdminDoc = {
  id: string | number
  title?: string | null
  slug?: string | null
}

type AdminEditTarget = {
  found: boolean
  collection?: EditableCollection
  editUrl?: string
  title?: string | null
  slug?: string | null
}

const COLLECTION_BY_SEGMENT: Record<string, EditableCollection> = {
  posts: 'posts',
  projects: 'projects',
  events: 'events',
  services: 'services',
  shop: 'products',
  products: 'products',
}

const stripQueryAndHash = (value: string) => {
  const [pathname] = value.split('?')
  return (pathname || '').split('#')[0]
}

const normalizePath = (pathname: string) => {
  if (!pathname) return '/'
  const trimmed = stripQueryAndHash(pathname).replace(/\/+$/, '')
  return trimmed || '/'
}

const splitSegments = (pathname: string) =>
  normalizePath(pathname)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

const findPageBySlug = async (payload: Awaited<ReturnType<typeof getPayload>>, slug: string) => {
  const result = await payload.find({
    collection: 'pages',
    limit: 1,
    where: {
      slug: {
        equals: slug,
      },
    },
    overrideAccess: true,
    select: {
      id: true,
      title: true,
      slug: true,
    },
  })

  return (result.docs[0] as AdminDoc | undefined) ?? null
}

const findByCollection = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: EditableCollection,
  slug: string,
) => {
  const result = await payload.find({
    collection,
    limit: 1,
    where: {
      slug: {
        equals: slug,
      },
    },
    overrideAccess: true,
    select: {
      id: true,
      title: true,
      slug: true,
    },
  })

  return (result.docs[0] as AdminDoc | undefined) ?? null
}

const makeEditUrl = (collection: EditableCollection, id: string | number) => `/admin/collections/${collection}/${id}`

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const pathname = normalizePath(new URL(request.url).searchParams.get('path') || '/')
  const segments = splitSegments(pathname)

  if (segments.length === 0) {
    const payload = await getPayload({ config: configPromise })
    const rootDoc = await findPageBySlug(payload, 'home')
    if (!rootDoc) {
      return Response.json({ found: false })
    }

    return Response.json({
      found: true,
      collection: 'pages',
      editUrl: makeEditUrl('pages', rootDoc.id),
      title: rootDoc.title || 'Главная',
      slug: rootDoc.slug || 'home',
    } satisfies AdminEditTarget)
  }

  const [first, second] = segments
  const collection = COLLECTION_BY_SEGMENT[first]

  if (first === 'sections') {
    return Response.json({ found: false })
  }

  const slug = collection ? second : first
  const targetCollection: EditableCollection = collection || 'pages'

  if (!slug) {
    return Response.json({ found: false })
  }

  const payload = await getPayload({ config: configPromise })
  const doc = collection
    ? await findByCollection(payload, targetCollection, slug)
    : await findPageBySlug(payload, slug)

  if (!doc) {
    return Response.json({ found: false })
  }

  return Response.json({
    found: true,
    collection: targetCollection,
    editUrl: makeEditUrl(targetCollection, doc.id),
    title: doc.title || null,
    slug: doc.slug || slug,
  } satisfies AdminEditTarget)
}
