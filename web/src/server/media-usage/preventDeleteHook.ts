import { APIError, type CollectionBeforeDeleteHook } from 'payload'

import { findMediaUsage, type MediaUsageResult } from './findMediaUsage'

/**
 * Safe-delete (plan media-library-integrity.md Phase C.2).
 *
 * A `beforeDelete` hook on Media that refuses to delete a file still referenced
 * anywhere (FK columns, gallery/block arrays, rich-text upload nodes — via the
 * Phase C.1 usage engine) and explains where. Protects EVERY delete path
 * (admin UI + REST), not just one widget.
 *
 * Escape hatch: set `context.forceDelete = true` to bypass the check. This is
 * how server tools delete on purpose — e.g. the duplicate-merge of Phase D,
 * which deletes a redundant copy precisely because it IS in use (references get
 * repointed to the canonical id first). End-user force/replace from the admin
 * UI is the next C.2 increment.
 */

const MAX_LISTED = 15

/** Human, public error body listing where the media is used. */
export function buildInUseMessage(result: MediaUsageResult): string {
  const listed = result.usages.slice(0, MAX_LISTED).map((u) => {
    const where = u.fields.join(', ')
    const what = u.isGlobal ? u.label : `${u.label} «${u.title ?? `#${u.docId}`}»`
    return where ? `${what} (${where})` : what
  })
  const more = result.usages.length > MAX_LISTED ? ` и ещё ${result.usages.length - MAX_LISTED}` : ''
  return (
    `Этот медиафайл используется (${result.total}): ${listed.join('; ')}${more}. ` +
    `Сначала уберите ссылки или замените файл — затем удаляйте.`
  )
}

export const preventDeleteIfInUse: CollectionBeforeDeleteHook = async ({ req, id, context }) => {
  // Deliberate/forced deletion (scripts, dedup-merge) bypasses the guard.
  if (context?.forceDelete) return

  const mediaId = Number(id)
  if (!Number.isInteger(mediaId)) return

  const usage = await findMediaUsage(req.payload, mediaId)
  if (usage.total === 0) return

  // 409 Conflict, public message → surfaced in admin UI and REST responses.
  throw new APIError(buildInUseMessage(usage), 409, undefined, true)
}
