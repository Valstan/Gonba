import 'server-only'

import { unstable_cache } from 'next/cache'

import { resolveDiskPath, YandexDiskError } from './yandex-disk'

const API_BASE = 'https://cloud-api.yandex.net/v1/disk'

export type YandexGalleryItem = {
  name: string
  path: string
  preview?: string
  mime?: string
  modified?: string
  resourceId?: string
}

type YandexResourceResponse = {
  _embedded?: {
    items?: Array<{
      name?: string
      path?: string
      type?: 'dir' | 'file'
      mime_type?: string
      preview?: string
      modified?: string
      resource_id?: string
    }>
    total?: number
  }
}

function getToken(): string | null {
  return process.env.YANDEX_DISK_TOKEN || null
}

async function fetchFolder(folderPath: string, limit: number): Promise<YandexGalleryItem[]> {
  const token = getToken()
  if (!token) {
    throw new YandexDiskError('YANDEX_DISK_TOKEN is not configured', 0)
  }
  const url = new URL(`${API_BASE}/resources`)
  url.searchParams.set('path', resolveDiskPath(folderPath))
  url.searchParams.set('limit', String(Math.min(limit, 200)))
  url.searchParams.set('preview_size', 'M')
  url.searchParams.set(
    'fields',
    [
      '_embedded.items.name',
      '_embedded.items.path',
      '_embedded.items.type',
      '_embedded.items.mime_type',
      '_embedded.items.preview',
      '_embedded.items.modified',
      '_embedded.items.resource_id',
      '_embedded.total',
    ].join(','),
  )
  url.searchParams.set('sort', '-modified')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new YandexDiskError(`Yandex Disk list failed: ${res.status}`, res.status, body)
  }

  const json = (await res.json()) as YandexResourceResponse
  const items = json._embedded?.items ?? []
  return items
    .filter((item) => item?.type === 'file' && typeof item.mime_type === 'string' && item.mime_type.startsWith('image/'))
    .map((item) => ({
      name: item.name || '',
      path: item.path || '',
      preview: item.preview,
      mime: item.mime_type,
      modified: item.modified,
      resourceId: item.resource_id,
    }))
}

/**
 * Кэшированный листинг папки на Я.Диске только с изображениями.
 * Кэш через unstable_cache на 10 минут (нет revalidate-by-tag, чтобы не усложнять).
 */
export const listYandexGalleryFolder = unstable_cache(
  async (folderPath: string, limit = 60): Promise<YandexGalleryItem[]> => {
    return fetchFolder(folderPath, limit)
  },
  ['yandex-gallery-folder'],
  { revalidate: 600, tags: ['yandex-gallery'] },
)
