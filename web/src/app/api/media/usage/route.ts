import configPromise from '@payload-config'
import { createPayloadRequest } from 'payload'

import { findMediaUsage } from '@/server/media-usage/findMediaUsage'

/**
 * GET /api/media/usage?id=<mediaId>
 *
 * Returns every document/global that references the given Media file (FK
 * columns, gallery/block arrays, and Lexical upload nodes in rich-text).
 * Backs safe-delete and duplicate-merge — see media-library-integrity.md.
 *
 * Read-only. Admin / editor / manager only (same roles that can manage media).
 */
export async function GET(request: Request) {
  const req = await createPayloadRequest({ config: configPromise, request })

  const user = req.user
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const roles = Array.isArray(user.roles) ? user.roles : []
  if (!roles.some((r) => r === 'admin' || r === 'editor' || r === 'manager')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const idParam = new URL(request.url).searchParams.get('id')
  const mediaId = Number(idParam)
  if (!idParam || !Number.isInteger(mediaId) || mediaId <= 0) {
    return Response.json({ error: 'Invalid or missing id' }, { status: 400 })
  }

  try {
    const result = await findMediaUsage(req.payload, mediaId)
    return Response.json(result)
  } catch (err) {
    req.payload.logger.error(`media/usage?id=${mediaId} failed: ${(err as Error).message}`)
    return Response.json({ error: 'Usage lookup failed' }, { status: 500 })
  }
}
