import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const SOURCE_SLUG = 'travel-club-malmyzh'
const TARGET_SLUG = 'district-excursions'

type ProjectDoc = {
  id: number
  slug: string
  title: string
}

type CollectionSlug = 'events' | 'posts' | 'services' | 'products' | 'bookings'

const PROJECT_COLLECTIONS: CollectionSlug[] = ['events', 'posts', 'services', 'products', 'bookings']

const getProjectBySlug = async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const result = (await payload.find({
    collection: 'projects',
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  })) as { docs: ProjectDoc[] }

  return result.docs[0] || null
}

const collectRelatedIds = async (collection: CollectionSlug, projectId: string | number) => {
  const payload = await getPayload({ config: configPromise })
  const ids: Array<string | number> = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
      where: {
        project: {
          equals: projectId,
        },
      },
    })

    ids.push(...result.docs.map((doc) => doc.id))
    hasNextPage = Boolean(result.hasNextPage)
    page += 1
  }

  return ids
}

const countRelated = async (collection: CollectionSlug, projectId: string | number) => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      project: {
        equals: projectId,
      },
    },
  })

  return result.totalDocs
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const source = await getProjectBySlug(SOURCE_SLUG)
  const target = await getProjectBySlug(TARGET_SLUG)

  if (!source) {
    throw new Error(`Не найден исходный проект: ${SOURCE_SLUG}`)
  }
  if (!target) {
    throw new Error(`Не найден целевой проект: ${TARGET_SLUG}`)
  }

  const beforeCounts: Record<CollectionSlug, number> = {
    events: 0,
    posts: 0,
    services: 0,
    products: 0,
    bookings: 0,
  }

  const movedCounts: Record<CollectionSlug, number> = {
    events: 0,
    posts: 0,
    services: 0,
    products: 0,
    bookings: 0,
  }

  for (const collection of PROJECT_COLLECTIONS) {
    const ids = await collectRelatedIds(collection, source.id)
    beforeCounts[collection] = ids.length

    for (const id of ids) {
      await payload.update({
        collection,
        id,
        data: {
          project: target.id,
        },
        overrideAccess: true,
      })
      movedCounts[collection] += 1
    }
  }

  await payload.delete({
    collection: 'projects',
    id: source.id,
    overrideAccess: true,
  })

  const afterCounts: Record<CollectionSlug, number> = {
    events: 0,
    posts: 0,
    services: 0,
    products: 0,
    bookings: 0,
  }

  for (const collection of PROJECT_COLLECTIONS) {
    afterCounts[collection] = await countRelated(collection, target.id)
  }

  const sourceStillExists = await getProjectBySlug(SOURCE_SLUG)

  console.log(
    JSON.stringify(
      {
        source: { slug: source.slug, title: source.title },
        target: { slug: target.slug, title: target.title },
        movedFromSource: beforeCounts,
        movedUpdated: movedCounts,
        targetAfter: afterCounts,
        sourceDeleted: sourceStillExists === null,
      },
      null,
      2,
    ),
  )
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
