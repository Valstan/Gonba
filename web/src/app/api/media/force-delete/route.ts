import configPromise from '@payload-config'
import { createPayloadRequest } from 'payload'

/**
 * POST /api/media/force-delete   body: { id: number }
 *
 * Deletes a Media file even though it is still referenced somewhere, bypassing
 * the safe-delete guard (Phase C.2). References are NOT repointed — they become
 * broken/NULL. This is the explicit "delete anyway" escape hatch behind a clear
 * warning in the admin UI (`MediaActions`). `afterDelete` cascades to remove the
 * Yandex.Disk resource.
 *
 * Destructive → admin / editor only (same as the collection's `delete` access;
 * `overrideAccess` is used internally so the gate must live here).
 */
export async function POST(request: Request) {
  const req = await createPayloadRequest({ config: configPromise, request })

  const user = req.user
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const roles = Array.isArray(user.roles) ? user.roles : []
  if (!roles.some((r) => r === 'admin' || r === 'editor')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: unknown }
  try {
    body = (await request.json()) as { id?: unknown }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const mediaId = Number(body?.id)
  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    await req.payload.delete({
      collection: 'media',
      id: mediaId,
      overrideAccess: true,
      context: { forceDelete: true },
    })
    return Response.json({ ok: true, deleted: mediaId })
  } catch (err) {
    req.payload.logger.error(`media/force-delete id=${mediaId} failed: ${(err as Error).message}`)
    return Response.json({ error: 'Не удалось удалить медиафайл' }, { status: 500 })
  }
}
