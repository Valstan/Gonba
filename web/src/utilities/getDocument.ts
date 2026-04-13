import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Collection = keyof Config['collections']

async function getDocumentBySlug(collection: Collection, slug: string, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  const page = await payload.find({
    collection,
    depth,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return page.docs[0]
}

async function getDocumentByID(collection: Collection, id: string, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  return payload.findByID({
    collection,
    id,
    depth,
    disableErrors: true,
  })
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedDocumentBySlug = (collection: Collection, slug: string) =>
  unstable_cache(async () => getDocumentBySlug(collection, slug), ['slug', collection, slug], {
    tags: [`${collection}_${slug}`],
  })

/**
 * Returns a unstable_cache function mapped with the cache tag for the document id
 */
export const getCachedDocumentByID = (collection: Collection, id: string) =>
  unstable_cache(async () => getDocumentByID(collection, id), ['id', collection, id], {
    tags: [`${collection}_${id}`],
  })
