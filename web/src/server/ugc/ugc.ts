import { createHash } from 'node:crypto'

// Общие константы и утилиты «Народной ленты» (UGC фото/видео). Портировано из Sabantuy
// (docs/plans/sabantuy-borrowings.md, этап 1); фазы фестиваля убраны — GONBA без сезона.
// Разделяемы между коллекциями, хуками и роутами — единый источник правды по лимитам.

export const UGC_KINDS = ['photo', 'video'] as const
export const UGC_STATUSES = ['visible', 'hidden', 'removed'] as const

export type UgcKind = (typeof UGC_KINDS)[number]
export type UgcStatus = (typeof UGC_STATUSES)[number]

// Порог авто-скрытия по жалобам. Постмодерация: контент виден сразу, но при накоплении
// жалоб система прячет до разбора персоналом.
export const UGC_REPORT_HIDE_THRESHOLD = Number(process.env.UGC_REPORT_HIDE_THRESHOLD) || 3

// Лимиты размера (МБ) — те же, что в endpoint sign-upload. Сервер перепроверяет на
// создании записи, не доверяя только клиент-валидации.
export const UGC_MAX_PHOTO_MB = Number(process.env.UGC_MAX_PHOTO_MB) || 12
export const UGC_MAX_VIDEO_MB = Number(process.env.UGC_MAX_VIDEO_MB) || 100

// Длина текстовых полей (дублируется в maxLength полей — здесь для хук-санитайза).
export const UGC_MAX_AUTHOR = 64
export const UGC_MAX_CAPTION = 500

// Максимум файлов в одной публикации (пост-в-стиле-ВК: одна подпись — много медиа).
// Обложка (верхнеуровневые поля) + массив media (≤ UGC_MAX_FILES-1) = ≤ UGC_MAX_FILES.
export const UGC_MAX_FILES = Number(process.env.UGC_MAX_FILES) || 20

// Ключ объекта, который выдаёт buildObjectKey: media/lenta/<yyyymm>/<uuid>.<ext>.
// Проверяем формат при создании записи, чтобы аноним не подсунул произвольный путь
// (напр. ссылку на чужой объект бакета).
export const OBJECT_KEY_RE =
  /^media\/[a-z0-9-]+\/\d{6}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/

/** IP клиента из заголовков прокси (на проде nginx ставит X-Forwarded-For / X-Real-IP). */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

// Соль для хеша IP: отдельный UGC_IP_SALT, иначе PAYLOAD_SECRET (всегда задан).
// Хеш нужен для дедупа лайков/жалоб и трассировки абьюза — храним необратимо (sha256,
// усечён до 128 бит), сам IP в БД не пишем (минимизация ПДн, 152-ФЗ).
const IP_SALT = process.env.UGC_IP_SALT || process.env.PAYLOAD_SECRET || 'gonba-ugc'

/** Необратимый хеш IP (для дедупа реакций/жалоб, не PII). */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex').slice(0, 32)
}

// --- Владение контентом анонимом («удалить/править своё») ---
// Браузер генерит секрет ownerToken (localStorage) и шлёт его в заголовке X-UGC-Owner
// при создании. Сервер хранит лишь необратимый ownerHash (как ipHash) → по нему хук
// стампит запись, а эндпоинты /api/ugc/* подтверждают «это моё» (хеш токена совпал).
// Не PII: сам токен в БД не пишем, только хеш.
const OWNER_SALT = process.env.UGC_OWNER_SALT || process.env.PAYLOAD_SECRET || 'gonba-ugc-owner'

/** Заголовок с браузерным токеном владельца (строчными — Headers.get регистр-независим). */
export const OWNER_TOKEN_HEADER = 'x-ugc-owner'

/** Необратимый хеш токена владельца (привязка контента к браузеру/аккаунту, не PII). */
export function hashOwner(token: string): string {
  return createHash('sha256').update(`owner:${OWNER_SALT}:${token}`).digest('hex').slice(0, 32)
}

/** Токен владельца из заголовка (минимальная валидация: UUID-подобная длина). */
export function ownerTokenFromHeaders(headers: Headers): string | null {
  const raw = headers.get(OWNER_TOKEN_HEADER)
  if (!raw) return null
  const token = raw.trim()
  if (token.length < 16 || token.length > 200) return null
  return token
}

/** ownerHash из запроса (null, если токена нет/он невалиден). */
export function ownerHashFromHeaders(headers: Headers): string | null {
  const token = ownerTokenFromHeaders(headers)
  return token ? hashOwner(token) : null
}

// Цели жалоб (content-reports): на что можно пожаловаться.
export const UGC_REPORT_TARGETS = ['submission', 'comment'] as const
export type UgcReportTarget = (typeof UGC_REPORT_TARGETS)[number]

// Управляющие символы (кроме \t=09, \n=0A) — вырезаем из пользовательского текста.
// Строка-форма RegExp с \u-escape (не литеральные control-символы в исходнике).
const CONTROL_CHARS = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', 'g')

/** Санитайз пользовательского текста: убрать управляющие символы, схлопнуть пробелы/
 *  переводы строк, trim, ограничить длину. Пусто → undefined. */
export function clampText(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const cleaned = v
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned ? cleaned.slice(0, max) : undefined
}

/** id из значения relationship-поля Payload (число-id или populated-объект). */
export function relId(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    return typeof id === 'number' ? id : undefined
  }
  return undefined
}
