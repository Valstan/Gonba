import path from 'path'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { requireAdmin } from '@/server/auth/requireAdmin'
import {
  getYandexErrorFromResponse,
  getDownloadUrl,
  getPublicDownloadUrl,
  getYandexResource,
  listYandexDiskFolder,
  YandexDiskError,
} from '@/server/integrations/yandex-disk'

type DiskImage = {
  path: string
  name: string
  url: string
  id?: string | number
  alt?: string
  modified?: string
}

type MediaLikeDoc = {
  id: string | number
  url?: string | null
  alt?: string | null
  yandexPath?: string | null
}

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|avif)$/i

const normalizeApiPath = (value: string) => {
  let input = (value || '').trim()
  if (!input) return ''
  if (input.startsWith('/disk:') || input.startsWith('/app:') || input.startsWith('/urn:')) {
    input = input.slice(1)
  }
  if (input.startsWith('disk:')) return input.replace(/^disk:/, '')
  if (input.startsWith('app:')) return input.replace(/^app:/, '')
  return input
}

const normalizeForCompare = (value?: string | null) => {
  const normalized = normalizeApiPath(value || '')
  if (!normalized) return ''
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

const isImageByNameOrMime = (name?: string, mime?: string) => {
  if ((mime || '').toLowerCase().startsWith('image/')) return true
  return IMAGE_EXT_RE.test(name || '')
}

const getDefaultMediaRoot = () => {
  const raw = process.env.YANDEX_DISK_MEDIA_PATH || '/media'
  return raw.startsWith('/') ? raw : `/${raw}`
}

const isTokenMissingError = (error: unknown) =>
  error instanceof Error && error.message.includes('YANDEX_DISK_TOKEN is not configured')

const isMissingDiskFolderError = (error: unknown) => {
  if (!(error instanceof YandexDiskError)) return false
  if (error.status !== 404 && error.status !== 409) return false
  const code = getYandexErrorFromResponse(error)
  return !code || code === 'DiskPathDoesntExistsError'
}

const listDiskImages = async (rootPath: string): Promise<Array<{ path: string; name: string; modified?: string }>> => {
  const queue = [rootPath]
  const result: Array<{ path: string; name: string; modified?: string }> = []
  const maxFiles = 2000
  const pageLimit = 200

  while (queue.length && result.length < maxFiles) {
    const current = queue.shift() as string
    let offset = 0

    while (true) {
      const data = await listYandexDiskFolder(current, offset, pageLimit)
      const items = data?._embedded?.items || []

      for (const item of items) {
        if (item.type === 'dir' && item.path) {
          queue.push(item.path)
          continue
        }
        if (item.type !== 'file') continue
        if (!item.path || !item.name) continue
        if (!isImageByNameOrMime(item.name)) continue
        result.push({
          path: item.path,
          name: item.name,
          modified: item.modified,
        })
        if (result.length >= maxFiles) break
      }

      if (result.length >= maxFiles) break
      if (items.length < pageLimit) break
      offset += pageLimit
    }
  }

  return result.sort((a, b) => {
    const ta = a.modified ? new Date(a.modified).getTime() : 0
    const tb = b.modified ? new Date(b.modified).getTime() : 0
    return tb - ta
  })
}

const loadMediaMap = async () => {
  const payload = await getPayload({ config: configPromise })
  const docs = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 2000,
    overrideAccess: true,
    where: {
      yandexPath: {
        exists: true,
      },
    },
    context: { skipYandexCheck: true },
  })

  const map = new Map<string, MediaLikeDoc>()
  for (const doc of docs.docs as unknown as MediaLikeDoc[]) {
    const key = normalizeForCompare(doc.yandexPath)
    if (!key) continue
    if (!map.has(key)) map.set(key, doc)
  }
  return {
    map,
    docs: docs.docs as unknown as MediaLikeDoc[],
  }
}

const fromMediaDocs = (docs: MediaLikeDoc[]): DiskImage[] =>
  docs
    .filter((doc) => Boolean(doc.url))
    .map((doc) => {
      const normalizedPath = normalizeForCompare(doc.yandexPath)
      const name =
        path.posix.basename(normalizedPath || '') || String(doc.alt || `media-${doc.id}`)
      return {
        path: normalizedPath || `/media/${doc.id}`,
        name,
        id: doc.id,
        alt: doc.alt || undefined,
        url: String(doc.url),
      }
    })

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const rootPath = searchParams.get('path') || getDefaultMediaRoot()

  try {
    let mediaMap = new Map<string, MediaLikeDoc>()
    let mediaDocs: MediaLikeDoc[] = []
    try {
      const media = await loadMediaMap()
      mediaMap = media.map
      mediaDocs = media.docs
    } catch (error) {
      // Keep the picker usable even if Media query fails.
      console.error('Failed to load media map for home carousel:', error)
    }

    let diskImages: Array<{ path: string; name: string; modified?: string }> = []

    try {
      diskImages = await listDiskImages(rootPath)
    } catch (error) {
      if (isTokenMissingError(error) || isMissingDiskFolderError(error)) {
        return Response.json({ docs: fromMediaDocs(mediaDocs) })
      }
      if (error instanceof YandexDiskError) {
        return Response.json({ error: error.message, details: error.body }, { status: error.status || 502 })
      }
      throw error
    }

    const docs: DiskImage[] = diskImages.map((item) => {
      const mediaDoc = mediaMap.get(normalizeForCompare(item.path))
      return {
        path: item.path,
        name: item.name,
        id: mediaDoc?.id,
        alt: mediaDoc?.alt || undefined,
        url:
          mediaDoc?.url ||
          `/yadisk-api/preview?path=${encodeURIComponent(item.path)}`,
        modified: item.modified,
      }
    })

    return Response.json({ docs })
  } catch (error) {
    if (isTokenMissingError(error)) {
      return Response.json({ error: (error as Error).message }, { status: 503 })
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as { path?: string }
  const rawPath = body.path || ''
  if (!rawPath) {
    return Response.json({ error: 'Требуется путь к файлу' }, { status: 400 })
  }
  const normalizedRawPath = normalizeApiPath(rawPath)
  if (!normalizedRawPath) {
    return Response.json({ error: 'Некорректный путь к файлу' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })
  const normalizedInput = normalizeForCompare(normalizedRawPath)
  const matchCandidates = Array.from(
    new Set(
      [
        rawPath,
        normalizedRawPath,
        normalizedInput,
        `disk:${normalizedInput}`,
        `/disk:${normalizedInput}`,
      ].filter(Boolean),
    ),
  )

  const existing = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      or: matchCandidates.map((value) => ({
        yandexPath: {
          equals: value,
        },
      })),
    },
    context: { skipYandexCheck: true },
  })

  const existingDoc = (existing.docs?.[0] || null) as MediaLikeDoc | null
  if (existingDoc) {
    return Response.json({
      doc: {
        id: existingDoc.id,
        url: existingDoc.url || `/yadisk-api/preview?path=${encodeURIComponent(normalizedInput)}`,
        alt: existingDoc.alt || undefined,
      },
    })
  }

  try {
    const resource = await getYandexResource(normalizedRawPath, [
      'path',
      'name',
      'mime_type',
      'public_key',
      'public_url',
      'sha256',
      'resource_id',
      'size',
    ])

    const finalPath = normalizeApiPath(resource.path || normalizedRawPath) || normalizedInput
    const fileName = resource.name || path.posix.basename(normalizedInput || rawPath)
    if (!isImageByNameOrMime(fileName, resource.mime_type)) {
      return Response.json({ error: 'Можно выбрать только изображение' }, { status: 400 })
    }

    const download = await getDownloadUrl(finalPath)
    if (!download?.href) {
      return Response.json({ error: 'Не удалось получить ссылку загрузки' }, { status: 502 })
    }

    const fileRes = await fetch(download.href)
    if (!fileRes.ok) {
      return Response.json({ error: `Ошибка скачивания файла (${fileRes.status})` }, { status: 502 })
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    const publicKey = resource.public_key || null
    const publicUrl = publicKey ? (await getPublicDownloadUrl(publicKey)).href : resource.public_url || null
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')

    const created = await payload.create({
      collection: 'media',
      overrideAccess: true,
      context: { skipYandexSync: true },
      data: {
        alt: nameWithoutExt,
        yandexPath: finalPath,
        yandexResourceId: resource.resource_id ?? null,
        yandexPublicKey: publicKey,
        yandexPublicUrl: publicUrl,
        yandexSha256: resource.sha256 ?? null,
        yandexSyncedAt: new Date().toISOString(),
        yandexCheckedAt: new Date().toISOString(),
        yandexError: null,
      },
      file: {
        name: fileName,
        data: buffer,
        mimetype: resource.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream',
        size: Number(resource.size) || buffer.length,
      },
    })

    return Response.json({
      doc: {
        id: created.id,
        url: created.url || `/yadisk-api/preview?path=${encodeURIComponent(finalPath)}`,
        alt: created.alt || nameWithoutExt,
      },
    })
  } catch (error) {
    if (isTokenMissingError(error)) {
      return Response.json({ error: (error as Error).message }, { status: 503 })
    }
    if (error instanceof YandexDiskError) {
      return Response.json({ error: error.message, details: error.body }, { status: error.status || 502 })
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
