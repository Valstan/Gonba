import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { FeedFilters } from '@/components/Feed/FeedFilters'
import { FeedItem } from '@/components/Feed/FeedItem'
import { FEED_FILTERS, type FeedEntry, type FeedTypeFilter } from '@/components/Feed/types'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Args = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ type?: string }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return { title: 'Проект не найден' }
  return { title: `${project.title} — Жизнь проекта` }
}

const PAST_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 1 day grace

const VALID_FILTERS = new Set<FeedTypeFilter>(['all', 'news', 'blog', 'announcement', 'story', 'event'])

function isValidFilter(value: string | undefined): FeedTypeFilter {
  if (value && VALID_FILTERS.has(value as FeedTypeFilter)) return value as FeedTypeFilter
  return 'all'
}

export default async function ProjectFeedPage({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const sp = await searchParamsPromise
  const filter = isValidFilter(sp?.type)

  const payload = await getPayload({ config: configPromise })
  const wantPosts = filter !== 'event'
  const wantEvents = filter === 'all' || filter === 'event'
  const postTypeFilter: FeedTypeFilter | null = ['news', 'blog', 'announcement', 'story'].includes(filter as never) ? filter : null

  const [postsResult, eventsResult] = await Promise.all([
    wantPosts
      ? payload.find({
          collection: 'posts',
          depth: 1,
          limit: 50,
          sort: '-publishedAt',
          overrideAccess: false,
          where: {
            project: { equals: project.id },
            ...(postTypeFilter ? { postType: { equals: postTypeFilter } } : {}),
          },
          select: { title: true, slug: true, heroImage: true, publishedAt: true, postType: true, meta: true },
        })
      : Promise.resolve({ docs: [] as never[] }),
    wantEvents
      ? payload.find({
          collection: 'events',
          depth: 1,
          limit: 50,
          sort: 'startDate',
          overrideAccess: false,
          where: { project: { equals: project.id } },
        })
      : Promise.resolve({ docs: [] as never[] }),
  ])

  const now = Date.now()
  const postEntries: FeedEntry[] = (postsResult.docs as never[]).map((p) => ({
    kind: 'post',
    sortKey: p['publishedAt'] ? new Date(p['publishedAt']).getTime() : 0,
    isUpcoming: false,
    item: p,
  }))

  const eventEntries: FeedEntry[] = (eventsResult.docs as never[]).map((e) => {
    const startTs = e['startDate'] ? new Date(e['startDate']).getTime() : 0
    const isUpcoming = startTs >= now - PAST_THRESHOLD_MS
    return {
      kind: 'event',
      sortKey: startTs,
      isUpcoming,
      item: e,
    }
  })

  // Сначала будущие события — по возрастанию startDate (ближайшее сверху).
  const upcomingEvents = eventEntries
    .filter((e) => e.kind === 'event' && e.isUpcoming)
    .sort((a, b) => a.sortKey - b.sortKey)

  // Затем посты + прошедшие события — по убыванию.
  const past = [...postEntries, ...eventEntries.filter((e) => !e.isUpcoming)].sort((a, b) => b.sortKey - a.sortKey)

  const entries = [...upcomingEvents, ...past]

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <div className="hidden md:block">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/projects', label: 'Проекты' },
              { href: `/projects/${project.slug}`, label: project.title },
              { label: 'Жизнь проекта' },
            ]}
          />
        </div>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Жизнь проекта</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Новости и события — всё, что происходит в проекте «{project.shortLabel || project.title}».
        </p>
        <div className="mt-6">
          <FeedFilters current={filter} />
        </div>
      </section>

      <section className="container mt-6">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            Пока в этой ленте ничего нет — заглядывайте позже.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {entries.map((entry) => (
              <FeedItem
                key={`${entry.kind}-${entry.item.id}`}
                entry={entry}
                projectSlug={project.slug as string}
              />
            ))}
          </div>
        )}
        {/* избегаем unused-warning для FEED_FILTERS */}
        <span className="sr-only">{FEED_FILTERS.length} фильтров</span>
      </section>
    </main>
  )
}
