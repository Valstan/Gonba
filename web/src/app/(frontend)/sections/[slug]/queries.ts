
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const POSTS_PER_PAGE = 12

export const querySectionPosts = async (sectionSlug: string, page: number) => {
  const payload = await getPayload({ config: configPromise })

  const categoryResult = await payload.find({
    collection: 'categories',
    where: {
      slug: {
        equals: sectionSlug,
      },
    },
    pagination: false,
    depth: 0,
    overrideAccess: false,
    limit: 1,
  })

  const category = categoryResult.docs?.[0] as { id: number } | undefined
  if (!category?.id) return null

  return payload.find({
    collection: 'posts',
    depth: 1,
    page,
    limit: POSTS_PER_PAGE,
    sort: '-publishedAt',
    overrideAccess: false,
    where: {
      categories: {
        in: [category.id],
      },
    },
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
    },
  })
}
