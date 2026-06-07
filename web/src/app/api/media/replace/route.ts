import configPromise from '@payload-config'
import { createPayloadRequest } from 'payload'

import { mergeMediaInto } from '@/server/media-usage/repoint'

/**
 * POST /api/media/replace   body: { from: number, to: number }
 *
 * Replaces media `from` with media `to` everywhere: re-points every reference
 * (FK columns, gallery/block arrays, Lexical rich-text upload nodes) to `to` via
 * the Local API (version-correct), verifies `from` is no longer used, then
 * deletes `from` (and its Yandex.Disk resource). Phase C.2 "replace with another".
 *
 * Safer than force-delete — content keeps a valid image instead of a broken one.
 * If `from` is used in a collection without a repoint field-map (Pages blocks,
 * media caption), the merge aborts before deleting — the response explains why.
 *
 * Destructive → admin / editor only (collection `delete` access; `overrideAccess`
 * is used internally so the gate lives here).
 */
export async function POST(request: Request) {
  const req = await createPayloadRequest({ config: configPromise, request })

  const user = req.user
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const roles = Array.isArray(user.roles) ? user.roles : []
  if (!roles.some((r) => r === 'admin' || r === 'editor')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { from?: unknown; to?: unknown }
  try {
    body = (await request.json()) as { from?: unknown; to?: unknown }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fromId = Number(body?.from)
  const toId = Number(body?.to)
  if (!Number.isInteger(fromId) || fromId <= 0 || !Number.isInteger(toId) || toId <= 0) {
    return Response.json({ error: 'Invalid from/to id' }, { status: 400 })
  }
  if (fromId === toId) {
    return Response.json({ error: 'Нельзя заменить медиафайл на самого себя' }, { status: 400 })
  }

  // Target must exist before we repoint anything to it.
  try {
    await req.payload.findByID({ collection: 'media', id: toId, depth: 0, overrideAccess: true })
  } catch {
    return Response.json({ error: `Целевой медиафайл #${toId} не найден` }, { status: 400 })
  }

  try {
    const { repointed } = await mergeMediaInto(req.payload, fromId, toId)
    return Response.json({ ok: true, from: fromId, to: toId, repointed })
  } catch (err) {
    const message = (err as Error).message || 'Не удалось заменить медиафайл'
    req.payload.logger.error(`media/replace from=${fromId} to=${toId} failed: ${message}`)
    // The repoint engine throws human-readable Russian messages (unknown
    // collection / residual usage) — surface them so the admin knows what to do.
    return Response.json({ error: message }, { status: 409 })
  }
}
