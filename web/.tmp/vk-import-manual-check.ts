import configPromise from '../src/payload.config'
import { getPayload } from 'payload'

const ADMIN_EMAIL = `vk-import-check-${Date.now()}@example.com`
const ADMIN_PASSWORD = 'CheckPass123!'

const coerceNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

async function removeQueueItems(payload: Awaited<ReturnType<typeof getPayload>>, queueIds: number[]) {
  const ids = queueIds.filter((id) => Number.isFinite(id) && id > 0)
  if (!ids.length) return

  await payload.delete({
    collection: 'vkImportQueue',
    where: { id: { in: ids } },
    overrideAccess: true,
  })
}

async function removeUser(payload: Awaited<ReturnType<typeof getPayload>>, email: string) {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: email } },
    overrideAccess: true,
  })
}

async function removePost(payload: Awaited<ReturnType<typeof getPayload>>, postId?: unknown) {
  const id = coerceNumber(postId)
  if (!id) return

  await payload.delete({
    collection: 'posts',
    where: { id: { equals: id } },
    overrideAccess: true,
  })
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  await payload.create({
    collection: 'users',
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      roles: ['admin'],
      name: 'VK Import Queue Check',
    },
    overrideAccess: true,
  })

  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  })

  if (!loginResult.token) {
    throw new Error('Login result did not contain token')
  }

  const authHeader = `JWT ${loginResult.token}`

  const publishQueueItem = await payload.create({
    collection: 'vkImportQueue',
    data: {
      status: 'queued',
      sourceGroupId: 999,
      sourcePostId: 111,
      sourceUrl: 'https://vk.com/wall-999_111',
      title: 'Тестовый импорт',
      text: 'Тестовый текст для проверки публикации в очередь VK',
      previewText: 'Превью',
      suggestedSections: [{ slug: 'posts' }],
      suggestedDestination: 'posts',
      suggestedDestinationScore: 1,
      suggestedDestinationHints: [{ item: 'manual-check' }],
      detectedDate: 0,
      sourceMeta: { __manualCheck: true },
    },
    overrideAccess: true,
  })

  const discardQueueItem = await payload.create({
    collection: 'vkImportQueue',
    data: {
      status: 'queued',
      sourceGroupId: 999,
      sourcePostId: 222,
      sourceUrl: 'https://vk.com/wall-999_222',
      title: 'Тестовый импорт для удаления',
      text: 'Будет удален',
      previewText: 'Удаление',
      suggestedSections: [{ slug: 'posts' }],
      suggestedDestination: 'posts',
      suggestedDestinationScore: 1,
      suggestedDestinationHints: [{ item: 'manual-check-discard' }],
      detectedDate: 0,
      sourceMeta: { __manualCheck: true },
    },
    overrideAccess: true,
  })

  const { GET: routeQueueGet } = await import('../src/app/api/vk-import/queue/route')
  const { POST: routePublish } = await import('../src/app/api/vk-import/queue/[id]/publish/route')
  const { POST: routeDiscard } = await import('../src/app/api/vk-import/queue/[id]/discard/route')

  const listResBefore = await routeQueueGet(
    new Request('http://127.0.0.1/api/vk-import/queue?status=queued&limit=50', {
      headers: { Authorization: authHeader },
    }),
  )

  const listBefore = (await listResBefore.json()) as { docs: Array<{ id: number }> }
  const foundPublish = listBefore.docs.some((item) => Number(item.id) === Number(publishQueueItem.id))
  const foundDiscard = listBefore.docs.some((item) => Number(item.id) === Number(discardQueueItem.id))

  if (!foundPublish || !foundDiscard) {
    throw new Error('Setup queue items are not visible with status=queued filter')
  }

  const publishRes = await routePublish(
    new Request(`https://127.0.0.1/api/vk-import/queue/${publishQueueItem.id}/publish`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetSectionSlug: 'posts' }),
    }),
    { params: { id: String(publishQueueItem.id) } },
  )

  if (!publishRes.ok) {
    const publishBody = await publishRes.text()
    throw new Error(`Publish route failed: ${publishRes.status} ${publishBody}`)
  }

  const publishedItemRes = await payload.find({
    collection: 'vkImportQueue',
    where: { id: { equals: Number(publishQueueItem.id) } },
    overrideAccess: true,
    limit: 1,
  })

  const publishedEntry = publishedItemRes.docs[0] as {
    status?: string
    publishedPostId?: unknown
  } | undefined

  const publishedPostId = coerceNumber(
    typeof publishedEntry?.publishedPostId === 'object' &&
      publishedEntry.publishedPostId !== null &&
      'id' in (publishedEntry.publishedPostId as Record<string, unknown>)
      ? (publishedEntry.publishedPostId as { id?: unknown }).id
      : publishedEntry?.publishedPostId,
  )

  if (!publishedEntry || publishedEntry.status !== 'published' || !publishedPostId) {
    throw new Error('Queue item was not marked as published with post link')
  }

  const createdPost = await payload.find({
    collection: 'posts',
    where: { id: { equals: publishedPostId } },
    overrideAccess: true,
    limit: 1,
  })

  if (createdPost.totalDocs !== 1) {
    throw new Error('Published post for queue item was not created')
  }

  const discardRes = await routeDiscard(
    new Request(`https://127.0.0.1/api/vk-import/queue/${discardQueueItem.id}/discard`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    }),
    { params: { id: String(discardQueueItem.id) } },
  )

  if (!discardRes.ok) {
    const discardBody = await discardRes.text()
    throw new Error(`Discard route failed: ${discardRes.status} ${discardBody}`)
  }

  const discardedItemRes = await payload.find({
    collection: 'vkImportQueue',
    where: { id: { equals: Number(discardQueueItem.id) } },
    overrideAccess: true,
    limit: 1,
  })

  const discardedEntry = discardedItemRes.docs[0] as {
    status?: string
    publishedPostId?: unknown
  } | undefined

  if (!discardedEntry || discardedEntry.status !== 'discarded' || discardedEntry.publishedPostId !== null) {
    throw new Error('Queue item was not marked as discarded')
  }

  const listResAfter = await routeQueueGet(
    new Request('http://127.0.0.1/api/vk-import/queue?status=queued&limit=50', {
      headers: { Authorization: authHeader },
    }),
  )

  const listAfter = (await listResAfter.json()) as { docs: Array<{ id: number; status: string }> }
  const remainingPublish = listAfter.docs.some((item) => Number(item.id) === Number(publishQueueItem.id))
  const remainingDiscard = listAfter.docs.some((item) => Number(item.id) === Number(discardQueueItem.id))

  if (remainingPublish || remainingDiscard) {
    throw new Error('Processed items still visible in queued list')
  }

  console.log(
    JSON.stringify({
      ok: true,
      admin: ADMIN_EMAIL,
      publishedQueueItemId: publishQueueItem.id,
      discardedQueueItemId: discardQueueItem.id,
      createdPostId: publishedPostId,
      queuedCountAfter: listAfter.docs.length,
    }),
  )

  await removeQueueItems(payload, [Number(publishQueueItem.id), Number(discardQueueItem.id)])
  await removePost(payload, publishedPostId)
  await removeUser(payload, ADMIN_EMAIL)

  await payload.db.destroy()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
