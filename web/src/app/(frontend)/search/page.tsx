import type { Metadata } from 'next/types'

import { CollectionArchive, type ArchiveResult } from '@/components/CollectionArchive'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { Search } from '@/search/Component'
import PageClient from './page.client'
import type { CardRelationTo } from '@/components/Card'
import { Breadcrumbs } from '@/components/Breadcrumbs'

type Args = {
  searchParams: Promise<{
    q: string
  }>
}

// Маркеры подсветки ts_headline — редкие символы, не пересекаются с контентом.
// Card рендерит их как <mark> (экранированно, без XSS).
const HL = { start: '⟦', stop: '⟧' } as const

// Достаём целевую коллекцию из полиморфного `doc` синк-записи (posts/pages/projects).
const ALLOWED_RELS: readonly CardRelationTo[] = ['posts', 'pages', 'projects']
const relationOf = (doc: unknown): CardRelationTo => {
  const rel = (doc as { relationTo?: string } | null)?.relationTo
  return ALLOWED_RELS.includes(rel as CardRelationTo) ? (rel as CardRelationTo) : 'posts'
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
  doc: true,
} as const

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise
  const payload = await getPayload({ config: configPromise })

  // Хидрейченные записи + целевая коллекция/подсветка для рендера карточек.
  let archiveDocs: ArchiveResult[] = []

  if (query && query.trim()) {
    // Postgres FTS: рус. морфология (стемминг), мультислово/фразы через
    // websearch_to_tsquery, ранжирование по ts_rank. Параметризовано → без инъекций.
    // websearch_to_tsquery устойчив к мусорному вводу (не бросает на спецсимволах).
    // ts_headline даёт подсветку совпадений в описании (маркеры ⟦…⟧ → <mark>).
    const pool = (
      payload.db as unknown as {
        pool: {
          query: (
            text: string,
            params?: unknown[],
          ) => Promise<{ rows: { id: number; snippet: string }[] }>
        }
      }
    ).pool

    const { rows } = await pool.query(
      `SELECT id,
              ts_headline(
                'russian',
                coalesce(meta_description, meta_title, title, ''),
                websearch_to_tsquery('russian', $1),
                'StartSel=${HL.start}, StopSel=${HL.stop}, MaxWords=35, MinWords=15, ShortWord=2'
              ) AS snippet
       FROM search
       WHERE ${FTS_EXPR} @@ websearch_to_tsquery('russian', $1)
       ORDER BY ts_rank(${FTS_EXPR}, websearch_to_tsquery('russian', $1)) DESC,
                priority DESC NULLS LAST,
                updated_at DESC
       LIMIT 12`,
      [query],
    )

    const ids = rows.map((r) => r.id)
    // Подсветку показываем только когда совпадение реально подсвечено (есть маркеры).
    const snippetMap = new Map(
      rows
        .filter((r) => r.snippet?.includes(HL.start))
        .map((r) => [r.id, r.snippet]),
    )
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
      archiveDocs = res.docs
        .slice()
        .sort((a, b) => (order.get(a.id as number) ?? 0) - (order.get(b.id as number) ?? 0))
        .map((doc) => ({
          ...(doc as unknown as ArchiveResult),
          relationTo: relationOf(doc.doc),
          highlight: snippetMap.get(doc.id as number),
        }))
    }
  } else {
    // Пустой запрос — показываем свежие записи (как раньше), без подсветки.
    const res = await payload.find({
      collection: 'search',
      depth: 1,
      limit: 12,
      pagination: false,
      select: selectFields,
    })
    archiveDocs = res.docs.map((doc) => ({
      ...(doc as unknown as ArchiveResult),
      relationTo: relationOf(doc.doc),
    }))
  }

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
        <CollectionArchive posts={archiveDocs} />
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
