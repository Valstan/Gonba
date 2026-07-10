// Клиентские утилиты «Народной ленты» (только браузер): валидация, даунскейл фото
// (canvas, экономия egress), измерение видео, presigned-PUT напрямую в Object Storage
// (минуя наш бокс), создание записи, владение «своим» по браузерному токену.
// Портировано из Sabantuy (этап 1 sabantuy-borrowings; фазы/VK/фотобитва убраны).
//
// Лимиты — UX-предпроверка; СЕРВЕР перепроверяет на sign-upload и create (источник
// правды). Значения совпадают с дефолтами сервера (server/ugc/ugc.ts).
export const CLIENT_MAX_PHOTO_MB = 12
export const CLIENT_MAX_VIDEO_MB = 100
export const CLIENT_MAX_VIDEO_SEC = 60
export const CLIENT_MAX_FILES = 20 // макс. файлов в одном посте (зеркало UGC_MAX_FILES)
const MAX_IMAGE_DIM = 1600 // даунскейл больших фото до этого по длинной стороне

export type UgcKind = 'photo' | 'video'

// Коды ошибок (UI маппит в русские сообщения).
export type UploadErrorCode = 'bad_type' | 'too_large' | 'too_long' | 'degraded' | 'failed'
export class UploadError extends Error {
  code: UploadErrorCode
  constructor(code: UploadErrorCode) {
    super(code)
    this.code = code
  }
}

export const UPLOAD_ERROR_TEXT: Record<string, string> = {
  bad_type: 'Такой формат файла не поддерживается (фото: JPG/PNG/WebP/HEIC; видео: MP4/MOV/WebM).',
  too_large: `Файл слишком большой (фото до ${CLIENT_MAX_PHOTO_MB} МБ, видео до ${CLIENT_MAX_VIDEO_MB} МБ).`,
  too_long: `Видео слишком длинное (до ${CLIENT_MAX_VIDEO_SEC} секунд).`,
  degraded: 'Загрузка временно недоступна — хранилище ещё не настроено.',
  failed: 'Не получилось загрузить. Проверьте связь и попробуйте ещё раз.',
  too_many: `Слишком много файлов (максимум ${CLIENT_MAX_FILES} в одном посте).`,
  consent: 'Нужно согласие на публикацию.',
}

const PHOTO_MIME = /^image\/(jpeg|png|webp|heic|heif)$/
const VIDEO_MIME = /^video\/(mp4|quicktime|webm)$/

/** Базовый MIME без `;codecs=…` (MediaRecorder отдаёт полную строку). */
export function baseMime(type: string): string {
  return (type || '').split(';')[0].trim().toLowerCase()
}

/** Лучший поддерживаемый MIME для MediaRecorder. mp4/h264 — первым ради совместимости
 *  с iOS (vp8/vp9 webm Safari не проигрывает). undefined → встроенный дефолт. */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'video/mp4',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* ignore */
    }
  }
  return undefined
}

/** Тип файла → kind, либо null если не поддерживается. */
export function kindOf(file: File): UgcKind | null {
  if (PHOTO_MIME.test(file.type)) return 'photo'
  if (VIDEO_MIME.test(file.type)) return 'video'
  return null
}

export type Prepared = {
  kind: UgcKind
  blob: Blob
  mime: string
  bytes: number
  width: number | null
  height: number | null
  durationSec: number | null
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })
}

// Фото: если длинная сторона > MAX_IMAGE_DIM — ужать через canvas в JPEG (q0.85),
// иначе отдать исходник. Если декодировать не удалось (напр. HEIC на iOS без
// поддержки canvas) — грузим исходник как есть (размеры неизвестны).
async function prepareImage(file: File): Promise<{ blob: Blob; width: number | null; height: number | null }> {
  try {
    const img = await loadImage(file)
    const { naturalWidth: w0, naturalHeight: h0 } = img
    if (Math.max(w0, h0) <= MAX_IMAGE_DIM) return { blob: file, width: w0, height: h0 }
    const scale = MAX_IMAGE_DIM / Math.max(w0, h0)
    const w = Math.round(w0 * scale)
    const h = Math.round(h0 * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: file, width: w0, height: h0 }
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob) return { blob: file, width: w0, height: h0 }
    return { blob, width: w, height: h }
  } catch {
    return { blob: file, width: null, height: null }
  }
}

function measureVideo(file: File): Promise<{ durationSec: number; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        durationSec: Number.isFinite(v.duration) ? Math.round(v.duration) : 0,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
      })
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ durationSec: 0, width: null, height: null })
    }
    v.src = url
  })
}

/** Валидация + подготовка файла (даунскейл/измерение). Бросает UploadError. */
export async function measureAndPrepare(file: File): Promise<Prepared> {
  const kind = kindOf(file)
  if (!kind) throw new UploadError('bad_type')

  if (kind === 'photo') {
    const { blob, width, height } = await prepareImage(file)
    if (blob.size > CLIENT_MAX_PHOTO_MB * 1024 * 1024) throw new UploadError('too_large')
    return { kind, blob, mime: blob.type || file.type, bytes: blob.size, width, height, durationSec: null }
  }

  const { durationSec, width, height } = await measureVideo(file)
  if (durationSec > CLIENT_MAX_VIDEO_SEC) throw new UploadError('too_long')
  if (file.size > CLIENT_MAX_VIDEO_MB * 1024 * 1024) throw new UploadError('too_large')
  return { kind, blob: file, mime: file.type, bytes: file.size, width, height, durationSec }
}

function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (frac: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError('failed'))
    xhr.onerror = () => reject(new UploadError('failed'))
    xhr.send(blob)
  })
}

export type UploadOpts = {
  caption: string
  authorName: string
  onProgress: (frac: number) => void
}

// Одно загруженное медиа поста (для оптимистичного показа карточки сразу после отправки).
export type UploadedMedia = {
  kind: UgcKind
  mediaUrl: string
  posterUrl: string | null
  width: number | null
  height: number | null
}
export type UploadResult = { id: number; media: UploadedMedia[] }

// Получить presigned PUT-ссылку для одного файла. Сервер 503 (ключи не заданы) → 'degraded'.
async function signOne(prepared: Prepared): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const signRes = await fetch('/api/ugc/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: prepared.kind,
      contentType: prepared.mime,
      sizeBytes: prepared.bytes,
    }),
  })
  if (signRes.status === 503) throw new UploadError('degraded')
  if (!signRes.ok) throw new UploadError('failed')
  return (await signRes.json()) as { uploadUrl: string; objectKey: string; publicUrl: string }
}

// Полный цикл публикации поста (1..N файлов, одна подпись — стиль ВК): по очереди для
// каждого файла presigned-ссылка → прямой PUT в S3 (файлы через наш Node НЕ идут) →
// ОДНА запись в коллекцию (обложка = файл №1, media = остальные). Прогресс — общий,
// взвешен по байтам, чтобы бар шёл плавно по всем файлам.
export async function uploadPost(prepareds: Prepared[], opts: UploadOpts): Promise<UploadResult> {
  if (prepareds.length === 0) throw new UploadError('failed')
  const totalBytes = prepareds.reduce((s, p) => s + (p.bytes || 0), 0) || 1
  let doneBytes = 0
  const uploaded: { p: Prepared; objectKey: string; publicUrl: string }[] = []

  for (const p of prepareds) {
    const { uploadUrl, objectKey, publicUrl } = await signOne(p)
    await putWithProgress(uploadUrl, p.blob, p.mime, (frac) => {
      opts.onProgress(Math.min(1, (doneBytes + frac * (p.bytes || 0)) / totalBytes))
    })
    doneBytes += p.bytes || 0
    opts.onProgress(Math.min(1, doneBytes / totalBytes))
    uploaded.push({ p, objectKey, publicUrl })
  }

  const descriptor = (u: { p: Prepared; objectKey: string }) => ({
    kind: u.p.kind,
    objectKey: u.objectKey,
    mime: u.p.mime,
    bytes: u.p.bytes,
    width: u.p.width ?? undefined,
    height: u.p.height ?? undefined,
    durationSec: u.p.durationSec ?? undefined,
  })
  const [cover, ...rest] = uploaded

  const subRes = await fetch('/api/submissions', {
    method: 'POST',
    headers: ugcHeaders(), // + X-UGC-Owner → сервер стампит ownerHash (владение)
    body: JSON.stringify({
      ...descriptor(cover),
      consent: true,
      authorName: opts.authorName || undefined,
      caption: opts.caption || undefined,
      media: rest.map(descriptor),
    }),
  })
  if (!subRes.ok) throw new UploadError('failed')
  const json = (await subRes.json()) as { doc?: { id?: number } }
  const id = Number(json.doc?.id) || 0
  if (id) markMine('submission', id) // помним «моё» → покажем кнопку удаления

  return {
    id,
    media: uploaded.map((u) => ({
      kind: u.p.kind,
      mediaUrl: u.publicUrl,
      posterUrl: null,
      width: u.p.width,
      height: u.p.height,
    })),
  }
}

// --- Владение контентом в браузере («удалить/править своё») ---
// Секрет ownerToken генерится один раз на браузер (localStorage) и шлётся в заголовке
// X-UGC-Owner при создании/мутациях. Сервер хранит лишь его хеш (ownerHash) и по
// совпадению разрешает автору удалять/править своё. «Моё» помним тоже локально
// (ugc-mine:*) — лента статическая (ISR), сервер без токена не знает, что именно твоё.
const OWNER_KEY = 'ugc-owner'
const MINE_PREFIX = 'ugc-mine'

function randomToken(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `o-${crypto.randomUUID()}`
  } catch {
    /* ignore */
  }
  return `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/** Токен владельца этого браузера (создаётся при первом обращении). '' на сервере. */
export function getOwnerToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    let tok = localStorage.getItem(OWNER_KEY)
    if (!tok || tok.length < 16) {
      tok = randomToken()
      localStorage.setItem(OWNER_KEY, tok)
    }
    return tok
  } catch {
    return ''
  }
}

/** Заголовки UGC-запроса: JSON + X-UGC-Owner (если токен доступен). */
export function ugcHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const tok = getOwnerToken()
  if (tok) h['X-UGC-Owner'] = tok
  return h
}

type MineKind = 'submission' | 'comment'
const mineKey = (kind: MineKind, id: number) => `${MINE_PREFIX}:${kind}:${id}`

/** Пометить контент «моим» (создан в этом браузере) — для показа кнопок удалить/править. */
export function markMine(kind: MineKind, id: number): void {
  try {
    localStorage.setItem(mineKey(kind, id), '1')
  } catch {
    /* ignore */
  }
}

/** Мой ли это контент (создан в этом браузере). Только клиент. */
export function isMine(kind: MineKind, id: number): boolean {
  try {
    return localStorage.getItem(mineKey(kind, id)) === '1'
  } catch {
    return false
  }
}

function clearMine(kind: MineKind, id: number): void {
  try {
    localStorage.removeItem(mineKey(kind, id))
  } catch {
    /* ignore */
  }
}

/** Удалить свою (по токену) ИЛИ любую (персонал) публикацию. true — успех. */
export async function deleteSubmission(id: number): Promise<boolean> {
  const res = await fetch('/api/ugc/delete-submission', {
    method: 'POST',
    headers: ugcHeaders(),
    body: JSON.stringify({ id }),
  })
  if (res.ok) clearMine('submission', id)
  return res.ok
}

/** Удалить свой/любой (персонал) комментарий. */
export async function deleteComment(id: number): Promise<boolean> {
  const res = await fetch('/api/ugc/delete-comment', {
    method: 'POST',
    headers: ugcHeaders(),
    body: JSON.stringify({ id }),
  })
  if (res.ok) clearMine('comment', id)
  return res.ok
}

/** Править свой/любой (персонал) комментарий. Возвращает новый текст или null. */
export async function editComment(id: number, body: string): Promise<string | null> {
  const res = await fetch('/api/ugc/edit-comment', {
    method: 'POST',
    headers: ugcHeaders(),
    body: JSON.stringify({ id, body }),
  })
  if (!res.ok) return null
  const j = (await res.json()) as { body?: string }
  return typeof j.body === 'string' ? j.body : null
}

// --- Просмотры (засчитываются при открытии медиа) ---
// Один просмотр на браузер: помним в localStorage (ugc-viewed:<id>), сервер дополнительно
// дедупит по токену/IP. Возвращает true, если сервер засчитал просмотр сейчас (для
// оптимистичного счётчика); false — уже было/недоступно.
export function hasViewed(id: number): boolean {
  try {
    return localStorage.getItem(`ugc-viewed:${id}`) === '1'
  } catch {
    return false
  }
}

export async function viewSubmission(id: number): Promise<boolean> {
  if (typeof window === 'undefined' || hasViewed(id)) return false
  try {
    localStorage.setItem(`ugc-viewed:${id}`, '1')
  } catch {
    /* приватный режим — всё равно пингуем (сервер дедупит по токену/IP) */
  }
  try {
    const res = await fetch('/api/submission-views', {
      method: 'POST',
      headers: ugcHeaders(), // + X-UGC-Owner → дедуп «один просмотр на браузер»
      body: JSON.stringify({ submission: id }),
    })
    return res.ok // 409 (уже считали) → false, это нормально
  } catch {
    return false
  }
}

/** Отменить свой лайк. true — лайк был и удалён (или его уже не было). */
export async function unlikeSubmission(id: number): Promise<boolean> {
  const res = await fetch('/api/ugc/unlike', {
    method: 'POST',
    headers: ugcHeaders(),
    body: JSON.stringify({ submissionId: id }),
  })
  return res.ok
}
