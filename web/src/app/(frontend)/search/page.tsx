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
// Взвешенный tsvector над синк-таблицей `search` (заголовок важнее меты).
// 2-арг `to_tsvector('russian', …)` + setweight/|| — IMMUTABLE, безопасно для индекса (Phase 2).
const FTS_EXPR = `(
  setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(meta_title, '')), 'B') ||
  setweight(to_tsvector('russian', coalesce(meta_description, '')), 'C')
)`

const selectFields = {
  title: true,
  slug: true,
  categories: true,
  meta: true,
} as const

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise
  const payload = await getPayload({ config: configPromise })

  let docs: Record<string, unknown>[] = []

  if (query && query.trim()) {
    // Postgres FTS: рус. морфология (стемминг), мультислово/фразы через
    // websearch_to_tsquery, ранжирование по ts_rank. Параметризовано → без инъекций.
    // websearch_to_tsquery устойчив к мусорному вводу (не бросает на спецсимволах).
    const pool = (
      payload.db as unknown as {
        pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: { id: number }[] }> }
      }
    ).pool

    const { rows } = await pool.query(
      `SELECT id FROM search
       WHERE ${FTS_EXPR} @@ websearch_to_tsquery('russian', $1)
       ORDER BY ts_rank(${FTS_EXPR}, websearch_to_tsquery('russian', $1)) DESC,
                priority DESC NULLS LAST,
                updated_at DESC
       LIMIT 12`,
      [query],
    )

    const ids = rows.map((r) => r.id)
    if (ids.length) {
      const res = await payload.find({
        collection: 'search',
        depth: 1,
        limit: 12,
        pagination: false,
        where: { id: { in: ids } },
        select: selectFields,
      })
      // Восстанавливаем порядок по релевантности (where:in возвращает произвольный порядок).
      const order = new Map(ids.map((id, i) => [id, i]))
      docs = res.docs
        .slice()
        .sort(
          (a, b) =>
            (order.get(a.id as number) ?? 0) - (order.get(b.id as number) ?? 0),
        ) as Record<string, unknown>[]
    }
  } else {
    // Пустой запрос — показываем свежие записи (как раньше).
    const res = await payload.find({
      collection: 'search',
      depth: 1,
      limit: 12,
      pagination: false,
      select: selectFields,
    })
    docs = res.docs as Record<string, unknown>[]
  }

  const slugs = docs
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

  const archiveDocs = docs.map((doc) => {
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
