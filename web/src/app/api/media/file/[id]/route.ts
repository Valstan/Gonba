import configPromise from '@payload-config'
import { createReadStream, createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { getPayload } from 'payload'

import { checkRateLimit } from '@/server/rate-limit/inMemory'
import { getDownloadUrl, YandexDiskError } from '@/server/integrations/yandex-disk'
import { getRequestIpHash } from '@/utilities/getRequestIpHash'

/**
 * Media file proxy endpoint.
 *
 * Strategy:
 *   1. Look up the Media doc by id via Local API.
 *   2. Check on-disk cache in two locations:
 *        a. MEDIA_CACHE_DIR (new cache, configurable)
 *        b. LEGACY media dir (web/public/media — where Payload's staticDir
 *           wrote all existing files before this endpoint existed)
 *      On hit: bump atime and stream the file directly.
 *   3. On miss: fetch a fresh private download URL from Yandex Disk
 *      (NOT yandexPublicUrl, which can rotate), tee the stream into both
 *      the HTTP response and a write to the cache directory.
 *
 * Concurrent writers: each write goes to a unique <name>.tmp.<random> file
 * and is atomically renamed into place. If another writer wins the race,
 * the loser silently discards its tmp file.
 *
 * Plan reference: docs/plans/media-to-yadisk.md → Фаза 1.
 */

// Next.js runs with cwd = web project root. Anchor paths from there so we
// don't have to count `..` segments through the App Router file structure.
const WEB_ROOT = process.cwd()

// Legacy: Payload's existing staticDir — `web/public/media/` — where all 333
// existing files live as of baseline 2026-05-22.
const LEGACY_MEDIA_DIR = path.resolve(WEB_ROOT, 'public/media')

const CACHE_DIR = process.env.MEDIA_CACHE_DIR
  ? path.resolve(process.env.MEDIA_CACHE_DIR)
  : path.resolve(WEB_ROOT, 'public/media-cache')

const RATE_LIMIT_COUNT = Number(process.env.MEDIA_FILE_RATE_LIMIT_COUNT || 240)
const RATE_LIMIT_WINDOW_MS = Number(process.env.MEDIA_FILE_RATE_LIMIT_WINDOW_MS || 60_000)
const CACHE_CONTROL = 'public, max-age=2592000, immutable'

type RouteParams = { params: Promise<{ id: string }> }

type CachedFile = { fullPath: string; isLegacy: boolean }

async function findCached(filenameOnDisk: string): Promise<CachedFile | null> {
  const cachePath = path.join(CACHE_DIR, filenameOnDisk)
  try {
    await fs.access(cachePath)
    return { fullPath: cachePath, isLegacy: false }
  } catch {
    // not in new cache, try legacy
  }
  const legacyPath = path.join(LEGACY_MEDIA_DIR, filenameOnDisk)
  try {
    await fs.access(legacyPath)
    return { fullPath: legacyPath, isLegacy: true }
  } catch {
    return null
  }
}

async function bumpAtime(fullPath: string) {
  const now = new Date()
  try {
    await fs.utimes(fullPath, now, now)
  } catch {
    // best-effort; on some FS this can fail without harm
  }
}

function buildHeaders(mimeType: string | null | undefined, filesize: number | null | undefined): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': mimeType && mimeType.length > 0 ? mimeType : 'application/octet-stream',
    'Cache-Control': CACHE_CONTROL,
    'X-Media-Source': 'gonba-media-proxy',
  }
  if (typeof filesize === 'number' && filesize > 0) {
    headers['Content-Length'] = String(filesize)
  }
  return headers
}

async function streamFromCache(cached: CachedFile, mimeType: string | null) {
  // Get the actual on-disk size (more authoritative than doc.filesize, which
  // could drift if a file was replaced manually). Also bumps atime.
  let actualSize: number | null = null
  try {
    const st = await fs.stat(cached.fullPath)
    actualSize = st.size
  } catch {
    // proceed without Content-Length
  }
  await bumpAtime(cached.fullPath)
  const nodeStream = createReadStream(cached.fullPath)
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
  return new Response(webStream, {
    status: 200,
    headers: {
      ...buildHeaders(mimeType, actualSize),
      'X-Cache': cached.isLegacy ? 'HIT-LEGACY' : 'HIT',
    },
  })
}

async function tryStoreInCache(filenameOnDisk: string, webStream: ReadableStream<Uint8Array>) {
  // Write to tmp file then atomically rename.
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const tmpName = `${filenameOnDisk}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
  const tmpPath = path.join(CACHE_DIR, tmpName)
  const finalPath = path.join(CACHE_DIR, filenameOnDisk)
  const nodeReadable = Readable.fromWeb(webStream as never)
  const writeStream = createWriteStream(tmpPath)
  try {
    await pipeline(nodeReadable, writeStream)
    await fs.rename(tmpPath, finalPath)
  } catch (err) {
    // best-effort cache; clean up tmp on failure
    try {
      await fs.rm(tmpPath, { force: true })
    } catch {
      // ignore
    }
    throw err
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  // Rate limit per IP — generous for image-heavy pages
  const ipHash = getRequestIpHash(request.headers)
  const rl = checkRateLimit(`media-file:${ipHash}`, RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS)
  if (!rl.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  const { id } = await params
  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  let doc
  try {
    doc = await payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      overrideAccess: true,
      // Skip our own afterRead Yandex-url-rewrite so we get raw fields.
      context: { skipYandexCheck: true },
    })
  } catch {
    return Response.json({ error: 'Media not found' }, { status: 404 })
  }
  if (!doc || !doc.filename) {
    return Response.json({ error: 'Media not found' }, { status: 404 })
  }

  const mimeType = (doc.mimeType as string | undefined) ?? null

  // 1. Cache hit (new dir or legacy)
  const cached = await findCached(doc.filename)
  if (cached) {
    return streamFromCache(cached, mimeType)
  }

  // 2. Cache miss — fetch from Yandex.
  // Prefer yandexPath (canonical disk path). If only resource_id was stored,
  // YDisk API also accepts URN, so the same helper handles both.
  const yandexPath = (doc.yandexPath as string | undefined) || (doc.yandexResourceId as string | undefined) || null
  if (!yandexPath) {
    // No remote source. Should never happen for new uploads (afterChange hook
    // syncs), but baseline showed 0 such records → log + 404.
    payload.logger.warn(`media/file/${id}: no yandexPath, no local cache`)
    return Response.json({ error: 'Media file unavailable' }, { status: 404 })
  }

  let downloadHref: string | undefined
  try {
    const dl = await getDownloadUrl(yandexPath)
    downloadHref = dl.href
  } catch (err) {
    if (err instanceof YandexDiskError) {
      payload.logger.error(`media/file/${id}: yandex getDownloadUrl ${err.status}: ${err.message}`)
      return Response.json({ error: 'Upstream storage error' }, { status: 502 })
    }
    throw err
  }
  if (!downloadHref) {
    return Response.json({ error: 'No download URL from upstream' }, { status: 502 })
  }

  const upstream = await fetch(downloadHref)
  if (!upstream.ok || !upstream.body) {
    payload.logger.error(`media/file/${id}: upstream fetch ${upstream.status}`)
    return Response.json({ error: `Upstream fetch failed (${upstream.status})` }, { status: 502 })
  }

  // Tee the stream: one branch → HTTP response, another → cache writer
  const [responseBranch, cacheBranch] = upstream.body.tee()

  // Kick off cache write in background. Errors logged but don't fail the response.
  tryStoreInCache(doc.filename, cacheBranch).catch((err) => {
    payload.logger.warn(`media/file/${id}: cache write failed: ${(err as Error).message}`)
  })

  // For MISS path, trust upstream's Content-Length if provided (it's the
  // authoritative remote size). doc.filesize from DB could be stale.
  const upstreamLengthHeader = upstream.headers.get('content-length')
  const upstreamLength = upstreamLengthHeader ? Number(upstreamLengthHeader) : null
  return new Response(responseBranch, {
    status: 200,
    headers: {
      ...buildHeaders(
        mimeType ?? upstream.headers.get('content-type'),
        Number.isFinite(upstreamLength) ? upstreamLength : null,
      ),
      'X-Cache': 'MISS',
    },
  })
}
