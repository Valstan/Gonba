import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'

type QueueDoc = {
  id: number
  status: 'queued' | 'published' | 'discarded'
  title?: string
  text?: string
  previewText?: string
  sourceGroupId?: number
  sourcePostId?: number
  sourceUrl?: string
  heroImage?: { id?: number } | number | null
}

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const toSlug = (text: string) => {
  const base = text
    .toLowerCase()
    .split('')
    .map((char) => translitMap[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `vk-${Date.now()}`
}

const richTextFromText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

const ensureAdminOnly = (auth: Awaited<ReturnType<typeof requireAdmin>>) => {
  const roles = Array.isArray(auth?.user?.roles) ? auth.user.roles : []
  return auth.authorized && roles.includes('admin')
}

const getQueueEntry = async (payload: Awaited<ReturnType<typeof getPayload>>, id: number) => {
  const result = await payload.find({
    collection: 'vkImportQueue',
    limit: 1,
    overrideAccess: true,
    where: { id: { equals: id } },
    depth: 2,
  })

  if (!result.docs.length) return null
  return result.docs[0] as unknown as QueueDoc
}

const ensureCategory = async (payload: Awaited<ReturnType<typeof getPayload>>, slug: string) => {
  const existing = await payload.find({
    collection: 'categories',
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: slug } },
  })

  if (existing.docs.length && existing.docs[0]?.id) {
    return Number(existing.docs[0].id)
  }

  const created = await payload.create({
    collection: 'categories',
    overrideAccess: true,
    data: {
      slug,
      title: slug,
    },
  })

  return Number(created.id)
}

const normalizeSectionSlug = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const toHeroImageId = (heroImage?: QueueDoc['heroImage']) => {
  if (!heroImage) return undefined
  if (typeof heroImage === 'number') return heroImage
  if (typeof heroImage === 'object' && !Array.isArray(heroImage) && Number.isFinite(Number(heroImage.id))) {
    return Number(heroImage.id)
  }

  return undefined
}

type QueueRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: QueueRouteContext) {
  const payload = await getPayload({ config: configPromise })
  const auth = await requireAdmin(request)

  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  if (!ensureAdminOnly(auth)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const queueId = Number(id)
  if (!Number.isFinite(queueId) || queueId <= 0) {
    return Response.json({ error: 'Invalid queue id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    targetSectionSlug?: string
  }
  const targetSectionSlug = normalizeSectionSlug(body.targetSectionSlug)
  if (!targetSectionSlug) {
    return Response.json({ error: 'targetSectionSlug is required' }, { status: 400 })
  }

  const queueEntry = await getQueueEntry(payload, queueId)
  if (!queueEntry) {
    return Response.json({ error: 'Queue entry not found' }, { status: 404 })
  }

  if (queueEntry.status !== 'queued') {
    return Response.json({ error: 'Queue item is not in queued state' }, { status: 409 })
  }

  const categoryId = await ensureCategory(payload, targetSectionSlug)
  if (!Number.isFinite(categoryId)) {
    return Response.json({ error: 'Failed to resolve section category' }, { status: 500 })
  }

  const baseSlug = toSlug(`${queueEntry.sourceGroupId || 'vk'}-${queueEntry.sourcePostId || queueEntry.id}-${queueEntry.title || 'vk-post'}`)
  let slug = baseSlug
  let suffix = 1
  while (true) {
    const existing = await payload.find({
      collection: 'posts',
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: slug } },
    })
    if (!existing.docs.length) break
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const heroImageId = toHeroImageId(queueEntry.heroImage)
  const text = queueEntry.text || ''
  const post = await payload.create({
    collection: 'posts',
    overrideAccess: true,
    data: {
      title: queueEntry.title || 'Пост VK',
      slug,
      postType: 'news',
      categories: [categoryId],
      content: richTextFromText(text),
      heroImage: heroImageId,
      meta: {
        title: queueEntry.title || 'Пост VK',
        description: queueEntry.previewText || '',
        ...(heroImageId ? { image: heroImageId } : {}),
      },
      _status: 'published',
      publishedAt: new Date().toISOString(),
    },
    context: {
      disableRevalidate: true,
    },
  })

  await payload.update({
    collection: 'vkImportQueue',
    id: queueEntry.id,
    overrideAccess: true,
    data: {
      status: 'published',
      publishedPostId: Number(post.id),
    },
  })

  return Response.json({ ok: true, queueId, postId: post.id })
}
