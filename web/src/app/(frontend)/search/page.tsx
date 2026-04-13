import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { Search } from '@/search/Component'
import PageClient from './page.client'
import { CardPostData } from '@/components/Card'
import { Breadcrumbs } from '@/components/Breadcrumbs'

type Args = {
  searchParams: Promise<{
    q: string
  }>
}
export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'search',
    depth: 1,
    limit: 12,
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
    },
    // pagination: false reduces overhead if you don't need totalDocs
    pagination: false,
    ...(query
      ? {
          where: {
            or: [
              {
                title: {
                  like: query,
                },
              },
              {
                'meta.description': {
                  like: query,
                },
              },
              {
                'meta.title': {
                  like: query,
                },
              },
              {
                slug: {
                  like: query,
                },
              },
            ],
          },
        }
      : {}),
  })

  const slugs = posts.docs
    .map((doc) => (typeof doc.slug === 'string' ? doc.slug : null))
    .filter((slug): slug is string => Boolean(slug))

  const heroMap = new Map<string, unknown>()
  if (slugs.length) {
    const postsWithHero = await payload.find({
      collection: 'posts',
      depth: 1,
      limit: slugs.length,
      overrideAccess: false,
      where: {
        slug: {
          in: slugs,
        },
      },
      select: {
        slug: true,
        heroImage: true,
      },
    })

    for (const doc of postsWithHero.docs) {
      const slug = typeof doc.slug === 'string' ? doc.slug : null
      if (!slug) continue
      heroMap.set(slug, doc.heroImage)
    }
  }

  const archiveDocs = posts.docs.map((doc) => {
    const slug = typeof doc.slug === 'string' ? doc.slug : null
    if (!slug) return doc
    return {
      ...doc,
      heroImage: heroMap.get(slug) || null,
    }
  })

  return (
    <div className="pt-24 pb-24">
      <PageClient />
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Поиск' }]} />
      </div>
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none text-center">
          <h1 className="mb-8 lg:mb-16">Поиск</h1>

          <div className="max-w-[50rem] mx-auto">
            <Search />
          </div>
        </div>
      </div>

      {archiveDocs.length > 0 ? (
        <CollectionArchive posts={archiveDocs as CardPostData[]} />
      ) : (
        <div className="container">Ничего не найдено.</div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Поиск — Жемчужина Вятки',
  }
}
