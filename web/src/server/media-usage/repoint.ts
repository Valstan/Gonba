import type { Payload } from 'payload'

import { findMediaUsage, type MediaUsageResult } from './findMediaUsage'

/**
 * Shared media-reference repoint engine (plan media-library-integrity.md Phase D/C.2).
 *
 * Re-points every reference from one Media id to another across all docs/globals
 * via the Payload Local API — NOT raw SQL. Content collections are versioned
 * (drafts): a raw UPDATE would desync the main table from `_<coll>_v` and the
 * next publish would clobber it (CLAUDE.md lesson). Local API writes both tables
 * and triggers hooks / search sync.
 *
 * Two consumers share this:
 *   - `web/scripts/dedupe-media.ts` (Phase D) — merge sha256 duplicates.
 *   - `POST /api/media/replace` (Phase C.2 UI) — admin "replace with another".
 */

export type FieldSpec =
  | { kind: 'fk'; field: string }
  | { kind: 'group'; group: string; field: string }
  | { kind: 'array'; array: string; field: string }
  | { kind: 'richtext'; field: string }

/** Map of media-bearing fields per collection (API names) for version-correct repoint. */
export const MEDIA_FIELDS: Record<string, FieldSpec[]> = {
  posts: [
    { kind: 'fk', field: 'heroImage' },
    { kind: 'group', group: 'meta', field: 'image' },
    { kind: 'richtext', field: 'content' },
  ],
  projects: [
    { kind: 'fk', field: 'heroImage' },
    { kind: 'fk', field: 'logo' },
    { kind: 'array', array: 'gallery', field: 'image' },
    { kind: 'richtext', field: 'description' },
  ],
  events: [
    { kind: 'fk', field: 'heroImage' },
    { kind: 'array', array: 'gallery', field: 'image' },
    { kind: 'richtext', field: 'content' },
  ],
  services: [
    { kind: 'fk', field: 'heroImage' },
    { kind: 'richtext', field: 'description' },
  ],
  products: [
    { kind: 'array', array: 'images', field: 'image' },
    { kind: 'richtext', field: 'description' },
  ],
  vkImportQueue: [{ kind: 'fk', field: 'heroImage' }],
  // NB: `pages` and `media` are intentionally absent — their media lives inside
  // `layout` blocks (and a media `caption`), which the flat buildPatch model does
  // not traverse. repointMediaReferences therefore THROWS for those collections
  // rather than silently missing a reference — fail-safe (never orphan). Replace
  // surfaces that as a clear "remove the reference manually" error. Matches the
  // prod-validated Phase D dedupe script.
}

export const CAROUSEL_FIELDS: FieldSpec[] = [
  { kind: 'group', group: 'center', field: 'image' },
  { kind: 'array', array: 'items', field: 'image' },
]

const VERSIONED = new Set(['posts', 'projects', 'events', 'services', 'pages'])

const idEq = (v: unknown, id: number) => {
  const n = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return Number(n) === id
}

/** Recursively replace `value` in Lexical upload nodes from → to. */
export function replaceUploads(
  node: unknown,
  from: number,
  to: number,
): { value: unknown; changed: boolean } {
  if (Array.isArray(node)) {
    let changed = false
    const arr = node.map((n) => {
      const r = replaceUploads(n, from, to)
      changed = changed || r.changed
      return r.value
    })
    return { value: arr, changed }
  }
  if (node && typeof node === 'object') {
    const src = node as Record<string, unknown>
    const out: Record<string, unknown> = { ...src }
    let changed = false
    // Match the usage engine's predicate exactly: only `relationTo: 'media'`
    // upload nodes (a different upload collection could share a numeric id).
    if (src.type === 'upload' && src.relationTo === 'media' && idEq(src.value, from)) {
      out.value = to
      changed = true
    }
    for (const k of Object.keys(src)) {
      if (k === 'value' && src.type === 'upload') continue
      const r = replaceUploads(src[k], from, to)
      if (r.changed) {
        out[k] = r.value
        changed = true
      }
    }
    return { value: out, changed }
  }
  return { value: node, changed: false }
}

/** Minimal Local-API patch: only affected media fields; groups/arrays sent whole. */
function buildPatch(specs: FieldSpec[], doc: Record<string, unknown>, from: number, to: number) {
  const patch: Record<string, unknown> = {}
  let changed = false
  for (const s of specs) {
    if (s.kind === 'fk') {
      if (idEq(doc[s.field], from)) {
        patch[s.field] = to
        changed = true
      }
    } else if (s.kind === 'group') {
      const g = doc[s.group] as Record<string, unknown> | null | undefined
      if (g && idEq(g[s.field], from)) {
        patch[s.group] = { ...g, [s.field]: to }
        changed = true
      }
    } else if (s.kind === 'array') {
      const arr = doc[s.array] as Array<Record<string, unknown>> | null | undefined
      if (Array.isArray(arr) && arr.some((it) => idEq(it?.[s.field], from))) {
        patch[s.array] = arr.map((it) => (idEq(it?.[s.field], from) ? { ...it, [s.field]: to } : it))
        changed = true
      }
    } else if (s.kind === 'richtext') {
      const r = replaceUploads(doc[s.field], from, to)
      if (r.changed) {
        patch[s.field] = r.value
        changed = true
      }
    }
  }
  return { patch, changed }
}

/**
 * Re-point every reference from media `fromId` to `toId` across all docs/globals.
 * Returns the number of docs/globals actually patched. Does NOT delete anything.
 * Throws on an unknown collection (refuses to silently orphan content).
 */
export async function repointMediaReferences(
  payload: Payload,
  fromId: number,
  toId: number,
  opts: { usage?: MediaUsageResult; disableRevalidate?: boolean } = {},
): Promise<number> {
  const found = opts.usage ?? (await findMediaUsage(payload, fromId))
  // Standalone tsx (dedupe script) runs outside a Next request scope where
  // revalidateTag is a swallowed no-op anyway — pass disableRevalidate to keep
  // it quiet. The HTTP endpoint runs inside a request scope and WANTS the
  // repointed docs' pages to refresh, so it leaves this off.
  const ctx = opts.disableRevalidate ? { disableRevalidate: true } : undefined
  let repointed = 0

  for (const u of found.usages) {
    if (u.isGlobal) {
      const g = (await payload.findGlobal({
        slug: 'homeCarousel' as never,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>
      const { patch, changed } = buildPatch(CAROUSEL_FIELDS, g, fromId, toId)
      if (changed) {
        await payload.updateGlobal({
          slug: 'homeCarousel' as never,
          data: patch as never,
          overrideAccess: true,
          context: ctx,
        })
        repointed++
      }
      continue
    }

    const specs = MEDIA_FIELDS[u.collection]
    if (!specs) {
      throw new Error(
        `Нет field-map для коллекции "${u.collection}" (doc ${u.docId}) — отказ, чтобы не осиротить контент`,
      )
    }
    const doc = (await payload.findByID({
      collection: u.collection as never,
      id: u.docId as number,
      depth: 0,
      overrideAccess: true,
      context: { skipYandexCheck: true },
    })) as Record<string, unknown>
    const { patch, changed } = buildPatch(specs, doc, fromId, toId)
    if (changed) {
      if (VERSIONED.has(u.collection)) patch._status = doc._status ?? 'published'
      await payload.update({
        collection: u.collection as never,
        id: u.docId as number,
        data: patch as never,
        overrideAccess: true,
        context: ctx,
      })
      repointed++
    }
  }

  return repointed
}

/**
 * Replace `fromId` with `toId` everywhere, then delete `fromId`.
 *
 * Safety invariant: after repointing, `findMediaUsage(fromId)` MUST be 0 — else
 * the delete is aborted (throw), so we never orphan content. Deletion uses the
 * `forceDelete` escape hatch (the safe-delete hook would otherwise block it).
 *
 * @param opts.keepRemote - skip Yandex.Disk resource deletion (shared-disk dev runs).
 * @param opts.usage      - pre-fetched usage of `fromId` (avoids a re-query).
 */
export async function mergeMediaInto(
  payload: Payload,
  fromId: number,
  toId: number,
  opts: { keepRemote?: boolean; usage?: MediaUsageResult; disableRevalidate?: boolean } = {},
): Promise<{ repointed: number }> {
  if (fromId === toId) throw new Error('Нельзя заменить медиафайл на самого себя')

  const repointed = await repointMediaReferences(payload, fromId, toId, {
    usage: opts.usage,
    disableRevalidate: opts.disableRevalidate,
  })

  const after = await findMediaUsage(payload, fromId)
  if (after.total !== 0) {
    throw new Error(`После репойнта #${fromId} всё ещё используется (${after.total}) — удаление отменено`)
  }

  await payload.delete({
    collection: 'media',
    id: fromId,
    overrideAccess: true,
    context: { forceDelete: true, skipYandexDelete: opts.keepRemote },
  })

  return { repointed }
}
