import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'

type QueueDoc = {
  id: number
  status: 'queued' | 'published' | 'discarded'
}

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
  })
  if (!result.docs.length) return null
  return result.docs[0] as unknown as QueueDoc
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

  const queueEntry = await getQueueEntry(payload, queueId)
  if (!queueEntry) {
    return Response.json({ error: 'Queue entry not found' }, { status: 404 })
  }

  if (queueEntry.status === 'discarded') {
    return Response.json({ ok: true, queueId, alreadyDiscarded: true })
  }

  await payload.update({
    collection: 'vkImportQueue',
    id: queueEntry.id,
    overrideAccess: true,
    data: {
      status: 'discarded',
      publishedPostId: null,
    },
  })

  return Response.json({ ok: true, queueId })
}
