import { randomUUID } from 'node:crypto'

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Yandex Object Storage (S3-совместимое) для «Народной ленты» (UGC фото/видео).
//
// Принцип (docs/plans/sabantuy-borrowings.md, этап 1; паттерн Sabantuy): медиа НЕ идёт
// через наш слабый бокс. Браузер получает presigned PUT-ссылку и кладёт файл НАПРЯМУЮ
// в бакет; просмотр — публичный URL объекта (бакет public-read), браузер тянет с Яндекса.
// Основную Media/Я.Диск (ADR-0001) НЕ трогаем — UGC живёт отдельным контуром.
//
// Секреты — только в прод-env `/etc/gonba/gonba.env` (ADR-0005). Пока ключи не заданы —
// `isS3Configured()` = false, endpoint отдаёт 503 (degraded): сборка/типы зелёные без секретов.

const ENDPOINT = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net'
const REGION = process.env.S3_REGION || 'ru-central1'
const BUCKET = process.env.S3_BUCKET || ''
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || ''
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || ''
// Базовый URL раздачи. По умолчанию path-style от endpoint+bucket (детерминированно,
// без виртуального хоста/DNS-нюансов). Можно переопределить (напр. CDN).
const PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || `${ENDPOINT}/${BUCKET}`).replace(/\/+$/, '')

const PRESIGN_EXPIRES_SEC = 300 // 5 мин — браузер должен залить сразу

/** Заданы ли все обязательные креды S3. Без них endpoint аплоада отдаёт 503. */
export function isS3Configured(): boolean {
  return Boolean(BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY)
}

let cached: S3Client | null = null
function client(): S3Client {
  if (cached) return cached
  cached = new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    forcePathStyle: true, // path-style: https://endpoint/bucket/key — без виртуального хоста
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  })
  return cached
}

/** Публичный URL объекта по ключу (бакет public-read). */
export function publicUrl(objectKey: string): string {
  return `${PUBLIC_BASE_URL}/${objectKey.replace(/^\/+/, '')}`
}

/** Хост раздачи — для next.config remotePatterns / CSP. */
export function publicHost(): string {
  try {
    return new URL(PUBLIC_BASE_URL).host
  } catch {
    return 'storage.yandexcloud.net'
  }
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

/** Разрешённый ли MIME для загрузки данного типа. */
export function isAllowedMime(kind: 'photo' | 'video', mime: string): boolean {
  if (kind === 'photo') return mime in EXT_BY_MIME && mime.startsWith('image/')
  return mime in EXT_BY_MIME && mime.startsWith('video/')
}

/** Ключ объекта: media/lenta/<yyyymm>/<uuid>.<ext> (у GONBA фаз нет — сегмент фиксирован). */
export function buildObjectKey(args: { kind: 'photo' | 'video'; mime: string }): string {
  const ext = EXT_BY_MIME[args.mime] || (args.kind === 'photo' ? 'jpg' : 'mp4')
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `media/lenta/${yyyymm}/${randomUUID()}.${ext}`
}

/** Presigned PUT-ссылка: браузер заливает файл напрямую в бакет (срок ~5 мин). */
export async function presignUpload(objectKey: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: objectKey, ContentType: contentType })
  return getSignedUrl(client(), cmd, { expiresIn: PRESIGN_EXPIRES_SEC })
}

/** Удалить объект из бакета (при удалении публикации автором/персоналом). Без ключей —
 *  no-op; ошибку (нет объекта и т.п.) глушим — удаление записи в БД важнее файла. */
export async function deleteObject(objectKey: string): Promise<void> {
  if (!isS3Configured() || !objectKey) return
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey.replace(/^\/+/, '') }))
  } catch {
    /* best-effort: запись уже помечена removed, объект подчистится при ротации */
  }
}
