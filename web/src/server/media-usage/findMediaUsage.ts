import type { Payload } from 'payload'

import { ALL_MEDIA_SOURCES, COLLECTION_META, type MediaSource } from './sources'

/**
 * Usage engine — finds every document/global that references a given Media id.
 *
 * Strategy: one parameterized `UNION ALL` over the verified source map
 * (`sources.ts`), run via `payload.db.pool` (same raw-SQL escape hatch the FTS
 * search uses). Covers FK columns, gallery/block arrays, and Lexical upload
 * nodes inside `jsonb` rich-text (which Payload does NOT track in `*_rels`) —
 * both in main tables AND in `_<coll>_v` version tables (draft-only ссылки, что
 * не попали в main, пока черновик не опубликован; считается latest-версия).
 * Doc titles are then hydrated through the Local API.
 *
 * Only `$1` (the media id, validated as an integer by the caller) is dynamic —
 * all table/column/label literals come from the static config map, so the
 * assembled SQL is injection-safe.
 */

// Recursive Lexical upload-node match. `$mid` is bound from the `vars` arg.
const UPLOAD_PREDICATE = `'$.** ? (@.type == "upload" && @.relationTo == "media" && @.value == $mid)'`

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`

function selectFor(src: MediaSource): string {
  const cond =
    src.match === 'fk'
      ? `t.${src.col} = $1`
      : `jsonb_path_exists(t.${src.col}, ${UPLOAD_PREDICATE}, jsonb_build_object('mid', $1::int))`

  const c = sqlStr(src.collection)
  const f = sqlStr(src.field)

  // Версионный (`_v`) источник: doc_id берётся из `<versionTable>.parent_id`, и
  // считается только latest-версия (текущее состояние черновика). `hops` здесь —
  // шаги от `table` до строки `_<coll>_v`, а не до документа.
  if (src.versionTable) {
    const vt = src.versionTable
    if (src.hops === 0) {
      // table === versionTable: сама `_<coll>_v` несёт и version_-колонку, и parent_id/latest.
      return `SELECT ${c}::text AS collection, t.parent_id::int AS doc_id, ${f}::text AS field FROM ${src.table} t WHERE t.latest IS TRUE AND t.parent_id IS NOT NULL AND ${cond}`
    }
    if (src.hops === 1) {
      return `SELECT ${c}::text AS collection, vv.parent_id::int AS doc_id, ${f}::text AS field FROM ${src.table} t JOIN ${vt} vv ON t._parent_id = vv.id WHERE vv.latest IS TRUE AND vv.parent_id IS NOT NULL AND ${cond}`
    }
    // hops === 2: items -> via (block) -> _<coll>_v -> doc
    return `SELECT ${c}::text AS collection, vv.parent_id::int AS doc_id, ${f}::text AS field FROM ${src.table} t JOIN ${src.via} v ON t._parent_id = v.id JOIN ${vt} vv ON v._parent_id = vv.id WHERE vv.latest IS TRUE AND vv.parent_id IS NOT NULL AND ${cond}`
  }

  if (src.hops === 0) {
    return `SELECT ${c}::text AS collection, t.id::int AS doc_id, ${f}::text AS field FROM ${src.table} t WHERE ${cond}`
  }
  if (src.hops === 1) {
    return `SELECT ${c}::text AS collection, t._parent_id::int AS doc_id, ${f}::text AS field FROM ${src.table} t WHERE t._parent_id IS NOT NULL AND ${cond}`
  }
  // hops === 2: items -> via (block) -> doc
  return `SELECT ${c}::text AS collection, v._parent_id::int AS doc_id, ${f}::text AS field FROM ${src.table} t JOIN ${src.via} v ON t._parent_id = v.id WHERE v._parent_id IS NOT NULL AND ${cond}`
}

/** The full UNION ALL query (exported for unit testing — no DB needed). */
export function buildUsageQuery(): string {
  return ALL_MEDIA_SOURCES.map(selectFor).join('\nUNION ALL\n')
}

export type MediaUsage = {
  collection: string
  label: string
  isGlobal: boolean
  docId: number | null
  title: string | null
  /** distinct places within the doc, e.g. ['Обложка', 'В тексте'] */
  fields: string[]
  adminUrl: string | null
  frontendUrl: string | null
}

export type MediaUsageResult = {
  mediaId: number
  /** number of distinct referencing docs/globals */
  total: number
  usages: MediaUsage[]
}

type RawRow = { collection: string; doc_id: number | null; field: string }

export async function findMediaUsage(payload: Payload, mediaId: number): Promise<MediaUsageResult> {
  const pool = (
    payload.db as unknown as {
      pool: {
        query: (text: string, params: unknown[]) => Promise<{ rows: RawRow[] }>
      }
    }
  ).pool

  const { rows } = await pool.query(buildUsageQuery(), [mediaId])

  // Group raw hits by (collection, docId), collecting distinct field labels.
  const grouped = new Map<string, { collection: string; docId: number | null; fields: Set<string> }>()
  const docIdsByCollection = new Map<string, Set<number>>()

  for (const row of rows) {
    const meta = COLLECTION_META[row.collection]
    if (!meta) continue
    const docId = meta.isGlobal ? null : row.doc_id
    const groupKey = `${row.collection}:${docId ?? 'global'}`
    let entry = grouped.get(groupKey)
    if (!entry) {
      entry = { collection: row.collection, docId, fields: new Set() }
      grouped.set(groupKey, entry)
    }
    entry.fields.add(row.field)
    if (!meta.isGlobal && typeof docId === 'number') {
      if (!docIdsByCollection.has(row.collection)) docIdsByCollection.set(row.collection, new Set())
      docIdsByCollection.get(row.collection)!.add(docId)
    }
  }

  // Hydrate titles/slugs per collection in one query each.
  const docMeta = new Map<string, { title: string | null; slug: string | null }>()
  for (const [collection, idSet] of docIdsByCollection) {
    const ids = Array.from(idSet)
    try {
      const res = await payload.find({
        collection: collection as never,
        where: { id: { in: ids } },
        depth: 0,
        limit: ids.length,
        pagination: false,
        overrideAccess: true,
      })
      const titleField = COLLECTION_META[collection]?.titleField ?? 'title'
      for (const doc of res.docs as Array<Record<string, unknown>>) {
        const title =
          (doc[titleField] as string | undefined) ||
          (doc.title as string | undefined) ||
          (doc.filename as string | undefined) ||
          (doc.slug as string | undefined) ||
          null
        docMeta.set(`${collection}:${doc.id}`, { title, slug: (doc.slug as string | undefined) ?? null })
      }
    } catch {
      // Unknown/!queryable collection — degrade gracefully to no title.
    }
  }

  const usages: MediaUsage[] = []
  for (const entry of grouped.values()) {
    const meta = COLLECTION_META[entry.collection]!
    const dm = entry.docId != null ? docMeta.get(`${entry.collection}:${entry.docId}`) : undefined
    const slug = dm?.slug ?? null
    usages.push({
      collection: entry.collection,
      label: meta.label,
      isGlobal: !!meta.isGlobal,
      docId: entry.docId,
      title: meta.isGlobal ? meta.label : (dm?.title ?? null),
      fields: Array.from(entry.fields),
      adminUrl: meta.isGlobal
        ? `/admin/globals/${meta.key}`
        : entry.docId != null
          ? `/admin/collections/${entry.collection}/${entry.docId}`
          : null,
      frontendUrl: !meta.isGlobal && meta.frontend && slug ? meta.frontend(slug) : null,
    })
  }

  // Stable order: by collection label, then title.
  usages.sort((a, b) => a.label.localeCompare(b.label, 'ru') || (a.title || '').localeCompare(b.title || '', 'ru'))

  return { mediaId, total: usages.length, usages }
}
