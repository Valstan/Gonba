import { createReadStream } from 'fs'
import path from 'path'

const API_BASE = 'https://cloud-api.yandex.net/v1/disk'
const DEFAULT_TIMEOUT_MS = Number(process.env.YANDEX_DISK_TIMEOUT_MS || 15000)
const DEFAULT_RETRIES = Number(process.env.YANDEX_DISK_RETRIES || 2)
const DEFAULT_BACKOFF_MS = Number(process.env.YANDEX_DISK_BACKOFF_MS || 400)

export class YandexDiskError extends Error {
  status: number
  body?: string

  constructor(message: string, status: number, body?: string) {
    super(message)
    this.name = 'YandexDiskError'
    this.status = status
    this.body = body
  }
}

const getYandexErrorCode = (body?: string) => {
  if (!body) return null
  try {
    const parsed = JSON.parse(body) as { error?: string }
    return parsed?.error || null
  } catch {
    return null
  }
}

export const getYandexErrorFromResponse = (error: YandexDiskError) => getYandexErrorCode(error.body)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const shouldRetryStatus = (status: number) => {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

const withRetry = async (url: string, init: RequestInit, operation: string) => {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) {
        return res
      }

      if (!shouldRetryStatus(res.status) || attempt === DEFAULT_RETRIES) {
        return res
      }
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt === DEFAULT_RETRIES) {
        break
      }
    }

    const backoff = DEFAULT_BACKOFF_MS * 2 ** attempt
    await sleep(backoff)
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error')
  throw new YandexDiskError(`${operation}: request failed`, 0, message)
}

const getHeaders = () => {
  const token = process.env.YANDEX_DISK_TOKEN
  if (!token) {
    throw new Error('YANDEX_DISK_TOKEN is not configured')
  }

  return {
    Authorization: `OAuth ${token}`,
  }
}

const getBasePath = () => {
  const base = process.env.YANDEX_DISK_BASE_PATH || '/'
  if (base === '/') return '/'
  return base.startsWith('/') ? base : `/${base}`
}

const normalizePath = (path: string) => {
  const cleaned = path.startsWith('/') ? path : `/${path}`
  return cleaned === '/' ? '' : cleaned
}

export const resolveDiskPath = (path = '/') => {
  const base = getBasePath()
  const suffix = normalizePath(path)

  if (base === '/') return suffix || '/'
  if (!suffix) return base
  if (suffix === base || suffix.startsWith(`${base}/`)) return suffix

  return `${base}${suffix}`
}

export const listYandexDisk = async (path = '/') => {
  const limit = 200
  const maxItems = 5000
  let offset = 0
  let mergedItems: unknown[] = []
  let baseResponse: Record<string, unknown> | null = null

  while (offset < maxItems) {
    const url = new URL(`${API_BASE}/resources`)
    url.searchParams.set('path', resolveDiskPath(path))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('preview_size', 'XL')
    url.searchParams.set('preview_crop', 'true')
    url.searchParams.set(
      'fields',
      [
        '_embedded.items.path',
        '_embedded.items.name',
        '_embedded.items.type',
        '_embedded.items.preview',
        '_embedded.items.mime_type',
        '_embedded.items.size',
        '_embedded.items.created',
        '_embedded.items.modified',
        '_embedded.items.resource_id',
        '_embedded.total',
        'path',
        'name',
        'type',
      ].join(','),
    )

    const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk list')
    if (!res.ok) {
      const body = await res.text()
      throw new YandexDiskError(`Yandex Disk list failed: ${res.status}`, res.status, body)
    }

    const page = (await res.json()) as Record<string, unknown>
    if (!baseResponse) baseResponse = page
    const embedded = (page._embedded || {}) as { items?: unknown[]; total?: number }
    const items = embedded.items || []
    mergedItems = mergedItems.concat(items)

    const total = Number(embedded.total || 0)
    if (items.length < limit) break
    if (total > 0 && mergedItems.length >= total) break
    offset += limit
  }

  const safeBase = baseResponse || {}
  const safeEmbedded = (safeBase._embedded || {}) as Record<string, unknown>
  return {
    ...safeBase,
    _embedded: {
      ...safeEmbedded,
      items: mergedItems.slice(0, maxItems),
      total: Number(safeEmbedded.total || mergedItems.length),
    },
  }
}

type YandexDiskListItem = {
  path?: string
  name?: string
  type?: 'dir' | 'file'
  created?: string
  modified?: string
  resource_id?: string
}

type CleanupItemError = {
  path: string
  status?: number
  code?: string | null
  message: string
}

type CleanupYandexTrashOptions = {
  onItemError?: (details: CleanupItemError) => void
}

export const listYandexDiskFolder = async (path = '/', offset = 0, limit = 200) => {
  const url = new URL(`${API_BASE}/resources`)
  url.searchParams.set('path', resolveDiskPath(path))
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  url.searchParams.set(
    'fields',
    [
      '_embedded.items.path',
      '_embedded.items.name',
      '_embedded.items.type',
      '_embedded.items.created',
      '_embedded.items.modified',
      '_embedded.items.resource_id',
      '_embedded.total',
    ].join(','),
  )

  const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk list folder')
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk list failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<{
    _embedded?: {
      items?: YandexDiskListItem[]
      total?: number
    }
  }>
}

export const cleanupYandexTrash = async (
  trashPath = '/.trash',
  retentionDays = 10,
  options?: CleanupYandexTrashOptions,
) => {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const limit = 200
  let offset = 0

  try {
    await ensureYandexPath(trashPath)
  } catch (error) {
    if (error instanceof YandexDiskError && error.status === 404) {
      return
    }
    throw error
  }

  while (true) {
    let data: Awaited<ReturnType<typeof listYandexDiskFolder>>
    try {
      data = await listYandexDiskFolder(trashPath, offset, limit)
    } catch (error) {
      if (error instanceof YandexDiskError && error.status === 404) {
        return
      }
      throw error
    }
    const items = data?._embedded?.items || []
    if (!items.length) break

    for (const item of items) {
      const timestamp = item.modified || item.created
      if (!timestamp || !item.path) continue
      const date = new Date(timestamp)
      if (Number.isNaN(date.getTime())) continue
      if (date.getTime() < cutoff) {
        try {
          await deleteYandexResource(item.path)
        } catch (error) {
          if (error instanceof YandexDiskError) {
            const code = getYandexErrorFromResponse(error)
            // Deleted or missing objects in trash should not spam logs.
            if (error.status === 404 && code === 'DiskNotFoundError') {
              continue
            }
          }

          if (options?.onItemError) {
            const status = error instanceof YandexDiskError ? error.status : undefined
            const code = error instanceof YandexDiskError ? getYandexErrorFromResponse(error) : null
            options.onItemError({
              path: item.path,
              status,
              code,
              message: error instanceof Error ? error.message : 'Unknown cleanup error',
            })
          }
        }
      }
    }

    if (items.length < limit) break
    offset += limit
  }
}

const resolveResourcePathOrId = (pathOrId: string) => {
  if (pathOrId.startsWith('urn:') || pathOrId.startsWith('disk:')) {
    return pathOrId
  }
  if (!pathOrId.startsWith('/')) {
    return pathOrId
  }
  return resolveDiskPath(pathOrId)
}

export const getYandexResource = async (pathOrId: string, fields?: string[]) => {
  const url = new URL(`${API_BASE}/resources`)
  url.searchParams.set('path', resolveResourcePathOrId(pathOrId))
  if (fields?.length) {
    url.searchParams.set('fields', fields.join(','))
  }

  const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk get resource')
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk get resource failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<{
    path?: string
    name?: string
    resource_id?: string
    public_key?: string
    public_url?: string
    sha256?: string
    md5?: string
    file?: string
    preview?: string
    mime_type?: string
    size?: number
  }>
}

export const publishYandexResource = async (path: string) => {
  const url = new URL(`${API_BASE}/resources/publish`)
  url.searchParams.set('path', resolveDiskPath(path))

  const res = await withRetry(
    url.toString(),
    {
      method: 'PUT',
      headers: getHeaders(),
    },
    'Yandex Disk publish',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk publish failed: ${res.status}`, res.status, body)
  }

  return true
}

const createYandexFolderFull = async (fullPath: string) => {
  const url = new URL(`${API_BASE}/resources`)
  url.searchParams.set('path', fullPath)

  const res = await withRetry(
    url.toString(),
    {
      method: 'PUT',
      headers: getHeaders(),
    },
    'Yandex Disk create folder',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk create folder failed: ${res.status}`, res.status, body)
  }

  return true
}

export const createYandexFolder = async (path: string) => {
  return createYandexFolderFull(resolveDiskPath(path))
}

export const ensureYandexPath = async (path = '/') => {
  const fullPath = resolveDiskPath(path)
  const parts = fullPath.split('/').filter(Boolean)
  let current = ''

  for (const part of parts) {
    current += `/${part}`
    try {
      await createYandexFolderFull(current)
    } catch (error) {
      if (error instanceof YandexDiskError) {
        const code = getYandexErrorFromResponse(error)
        if (code === 'DiskPathPointsToExistentDirectoryError' || code === 'DiskPathExistsError') {
          continue
        }
      }
      throw error
    }
  }
}

export const deleteYandexResource = async (path: string) => {
  const url = new URL(`${API_BASE}/resources`)
  url.searchParams.set('path', resolveResourcePathOrId(path))
  url.searchParams.set('permanently', 'true')

  const res = await withRetry(
    url.toString(),
    {
      method: 'DELETE',
      headers: getHeaders(),
    },
    'Yandex Disk delete',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk delete failed: ${res.status}`, res.status, body)
  }

  return true
}

export const moveYandexResource = async (from: string, to: string) => {
  const url = new URL(`${API_BASE}/resources/move`)
  url.searchParams.set('from', resolveDiskPath(from))
  url.searchParams.set('path', resolveDiskPath(to))

  const res = await withRetry(
    url.toString(),
    {
      method: 'POST',
      headers: getHeaders(),
    },
    'Yandex Disk move',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk move failed: ${res.status}`, res.status, body)
  }

  return true
}

export const copyYandexResource = async (from: string, to: string) => {
  const url = new URL(`${API_BASE}/resources/copy`)
  url.searchParams.set('from', resolveDiskPath(from))
  url.searchParams.set('path', resolveDiskPath(to))

  const res = await withRetry(
    url.toString(),
    {
      method: 'POST',
      headers: getHeaders(),
    },
    'Yandex Disk copy',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk copy failed: ${res.status}`, res.status, body)
  }

  return true
}

export const getUploadUrl = async (path: string, overwrite = true) => {
  const url = new URL(`${API_BASE}/resources/upload`)
  url.searchParams.set('path', resolveDiskPath(path))
  url.searchParams.set('overwrite', overwrite ? 'true' : 'false')

  const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk upload URL')
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk upload URL failed: ${res.status}`, res.status, body)
  }

  return res.json()
}

export const getDownloadUrl = async (path: string) => {
  const url = new URL(`${API_BASE}/resources/download`)
  url.searchParams.set('path', resolveDiskPath(path))

  const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk download URL')
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk download URL failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<{ href?: string; method?: string; templated?: boolean }>
}

export const getPublicDownloadUrl = async (publicKey: string, path?: string) => {
  const url = new URL(`${API_BASE}/public/resources/download`)
  url.searchParams.set('public_key', publicKey)
  if (path) {
    url.searchParams.set('path', path)
  }

  const res = await withRetry(
    url.toString(),
    { headers: getHeaders() },
    'Yandex Disk public download URL',
  )
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk public download URL failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<{ href?: string; method?: string; templated?: boolean }>
}

export const getPublicResource = async (publicKey: string, fields?: string[], path?: string) => {
  const url = new URL(`${API_BASE}/public/resources`)
  url.searchParams.set('public_key', publicKey)
  if (path) {
    url.searchParams.set('path', path)
  }
  if (fields?.length) {
    url.searchParams.set('fields', fields.join(','))
  }

  const res = await withRetry(url.toString(), { headers: getHeaders() }, 'Yandex Disk public resource')
  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk public resource failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<{
    path?: string
    name?: string
    public_key?: string
    public_url?: string
    sha256?: string
    md5?: string
    file?: string
    preview?: string
    mime_type?: string
    size?: number
  }>
}

export const uploadLocalFileToYandex = async (sourcePath: string, targetPath: string) => {
  const dir = path.posix.dirname(targetPath)
  if (dir && dir !== '.') {
    await ensureYandexPath(dir)
  }

  const upload = await getUploadUrl(targetPath)
  if (!upload?.href) {
    throw new Error('Yandex Disk upload URL is missing')
  }

  const stream = createReadStream(sourcePath)
  const res = await withRetry(
    upload.href,
    {
      method: 'PUT',
      body: stream as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' },
    'Yandex Disk upload',
  )

  if (!res.ok) {
    const body = await res.text()
    throw new YandexDiskError(`Yandex Disk upload failed: ${res.status}`, res.status, body)
  }

  return true
}
