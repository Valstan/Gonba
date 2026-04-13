import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'
import {
  getPublicDownloadUrl,
  getPublicResource,
  getYandexResource,
} from '@/server/integrations/yandex-disk'

const normalizeNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

const toBool = (value: unknown) => {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const page = normalizeNumber(body.page, 1, 1, 100000)
  const limit = normalizeNumber(body.limit, 50, 1, 200)
  const dryRun = toBool(body.dryRun)

  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'media',
    page,
    limit,
    depth: 0,
    overrideAccess: true,
    context: { skipYandexCheck: true },
  })

  const scanned = result.docs.length
  let updated = 0
  let failed = 0

  for (const doc of result.docs) {
    if (!doc?.id || !doc?.filename) continue

    const primaryKey = typeof doc.yandexPath === 'string' ? doc.yandexPath : ''
    const fallbackKeyRaw = typeof doc.yandexResourceId === 'string' ? doc.yandexResourceId : ''
    const fallbackKey =
      fallbackKeyRaw.startsWith('/') ||
      fallbackKeyRaw.startsWith('disk:') ||
      fallbackKeyRaw.startsWith('app:') ||
      fallbackKeyRaw.startsWith('urn:')
        ? fallbackKeyRaw
        : ''

    if (!primaryKey && !fallbackKey && !doc.yandexPublicKey) continue

    try {
      let resource:
        | {
            path?: string
            public_key?: string
            public_url?: string
            sha256?: string
          }
        | undefined

      if (primaryKey || fallbackKey) {
        resource = await getYandexResource(primaryKey || fallbackKey, [
          'path',
          'public_key',
          'public_url',
          'sha256',
        ])
      } else if (doc.yandexPublicKey) {
        resource = await getPublicResource(doc.yandexPublicKey, [
          'path',
          'public_key',
          'public_url',
          'sha256',
        ])
      }

      if (!resource) continue

      const publicKey = resource.public_key ?? doc.yandexPublicKey ?? null
      const downloadUrl = publicKey ? (await getPublicDownloadUrl(publicKey)).href : undefined

      if (!dryRun) {
        await payload.update({
          collection: 'media',
          id: doc.id,
          data: {
            yandexPath: resource.path ?? doc.yandexPath ?? null,
            yandexPublicKey: publicKey,
            yandexPublicUrl: downloadUrl ?? resource.public_url ?? doc.yandexPublicUrl ?? null,
            yandexSha256: resource.sha256 ?? doc.yandexSha256 ?? null,
            yandexCheckedAt: new Date().toISOString(),
            yandexError: null,
          },
          overrideAccess: true,
          context: { skipYandexSync: true },
        })
      }

      updated += 1
    } catch (error) {
      failed += 1
      if (!dryRun) {
        const message = error instanceof Error ? error.message : 'Unknown sync error'
        await payload.update({
          collection: 'media',
          id: doc.id,
          data: {
            yandexCheckedAt: new Date().toISOString(),
            yandexError: message,
          },
          overrideAccess: true,
          context: { skipYandexSync: true },
        })
      }
    }
  }

  return Response.json({
    ok: true,
    page,
    limit,
    totalPages: result.totalPages,
    scanned,
    updated,
    failed,
    dryRun,
  })
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const page = normalizeNumber(searchParams.get('page'), 1, 1, 100000)
  const limit = normalizeNumber(searchParams.get('limit'), 50, 1, 200)
  const dryRun = toBool(searchParams.get('dryRun'))

  return POST(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ page, limit, dryRun }),
    }),
  )
}
