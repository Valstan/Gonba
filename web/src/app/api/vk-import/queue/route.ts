import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'

type QueueListResponse = {
  docs: unknown[]
  pagination: {
    totalDocs: number
    totalPages: number
    page: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const auth = await requireAdmin(request)

  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const roles = Array.isArray(auth.user?.roles) ? auth.user.roles : []
  if (!roles.includes('admin')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const rawStatus = url.searchParams.get('status')?.trim()
  const status = rawStatus === 'published' || rawStatus === 'discarded' ? rawStatus : 'queued'
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)))
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))

  const result = await payload.find({
    collection: 'vkImportQueue',
    limit,
    overrideAccess: true,
    where: {
      status: { equals: status },
    },
    sort: '-queuedAt',
    depth: 2,
    page,
  })

  const totalPages = Math.max(1, Math.ceil((result.totalDocs || 0) / limit))

  return Response.json({
    docs: result.docs,
    pagination: {
      totalDocs: result.totalDocs || 0,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  } as QueueListResponse)
}
