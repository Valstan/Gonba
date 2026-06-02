/**
 * Клиентский upload медиа с дедупликацией по содержимому (Phase B плана
 * docs/plans/media-library-integrity.md).
 *
 * Перед загрузкой считаем SHA-256 файла и ищем существующую Media с тем же
 * `yandexSha256` (Я.Диск отдаёт sha256 содержимого; изображения не
 * трансформируются — `imageSizes: []`, поэтому хэш загруженного == хэш
 * оригинала). Если дубль найден — переиспользуем его, НЕ заливая копию в
 * Я.Облако. Так не плодим дубли.
 */

export type UploadedMedia = { id: number | string; url: string | null; reused: boolean }

/** SHA-256 файла в виде lowercase-hex. */
export async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

/** Ищет уже загруженную Media с таким же sha256 (или null). */
export async function findMediaByHash(hash: string): Promise<UploadedMedia | null> {
  try {
    const params = new URLSearchParams({ limit: '1', depth: '0' })
    params.set('where[yandexSha256][equals]', hash)
    const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as { docs?: Array<{ id: number | string; url?: string | null }> }
    const doc = data.docs?.[0]
    if (!doc) return null
    return { id: doc.id, url: doc.url ?? null, reused: true }
  } catch {
    return null
  }
}

/**
 * Загружает файл ИЛИ переиспользует существующий дубль (по sha256).
 * Бросает Error при неудаче — вызывающий показывает сообщение.
 */
export async function uploadOrReuseMedia(file: File, alt: string): Promise<UploadedMedia> {
  // 1. Дедуп: если такой файл уже есть на Я.Диске — переиспользуем.
  const hash = await sha256Hex(file)
  if (hash) {
    const existing = await findMediaByHash(hash)
    if (existing) return existing
  }

  // 2. Иначе — обычная загрузка через Payload REST.
  const fd = new FormData()
  fd.append('file', file)
  fd.append('_payload', JSON.stringify({ alt: alt || file.name }))
  const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Не удалось загрузить картинку (${res.status}): ${txt.slice(0, 160)}`)
  }
  const data = await res.json()
  const doc = data?.doc || data
  const id = doc?.id ?? null
  if (!id) throw new Error('Не получен id загруженного файла')
  return { id, url: doc?.url ?? null, reused: false }
}
