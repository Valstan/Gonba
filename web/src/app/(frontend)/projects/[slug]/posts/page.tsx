import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'

import { CollectionArchive } from '@/components/CollectionArchive'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { PageRange } from '@/components/PageRange'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    page?: string
  }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) {
    return {
      title: 'Проект не найден',
    }
  }

  return {
    title: `${project.title} — Блог`,
  }
}

export default async function ProjectPostsPage({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const { page: pageParam } = await searchParamsPromise
  const page = Number.parseInt(pageParam || '1', 10)
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1

  const payload = await getPayload({ config: configPromise })
  const postsResult = await payload.find({
    collection: 'posts',
    depth: 1,
    page: currentPage,
    limit: 12,
    sort: '-publishedAt',
    overrideAccess: false,
    where: {
      project: {
        equals: project.id,
      },
    },
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
      heroImage: true,
    },
  })

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { href: `/projects/${project.slug}`, label: project.title },
            { label: 'Блог' },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold">Блог проекта</h1>
      </section>

      <section className="mt-8">
        <PageRange
          currentPage={postsResult.page || 1}
          limit={12}
          totalDocs={postsResult.totalDocs}
          collection="posts"
          className="container"
        />
        {postsResult.totalDocs > 0 ? <CollectionArchive posts={postsResult.docs} /> : <p className="container text-sm text-muted-foreground">Публикаций в этом проекте пока нет.</p>}
      </section>
    </main>
  )
}
