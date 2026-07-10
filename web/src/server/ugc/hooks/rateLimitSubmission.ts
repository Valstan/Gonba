import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

import { containsProfanity } from '../profanity'
import { rateLimit } from '../rateLimit'
import { isAllowedMime } from '../s3'
import {
  clampText,
  clientIp,
  OBJECT_KEY_RE,
  UGC_MAX_AUTHOR,
  UGC_MAX_CAPTION,
  UGC_MAX_FILES,
  UGC_MAX_PHOTO_MB,
  UGC_MAX_VIDEO_MB,
} from '../ugc'

// Анти-спам + валидация + санитайз публичной отправки в «Народную ленту»
// (POST /api/submissions). Контент анонимный (без аккаунтов); постмодерация → этот
// хук лишь отсекает грубый флуд и явный мусор/мат на входе. Персонал (ручной ввод
// в /admin) не ограничиваем.
//
// Серверная перепроверка НЕ доверяет клиент-валидации: objectKey должен иметь наш
// формат (media/lenta/<yyyymm>/<uuid>.<ext> — не чужой путь в бакете), mime
// разрешён для kind, размер в пределах лимита. consent проверяется validate-полем.

const MAX = 15 // отправок
const WINDOW_MS = 15 * 60 * 1000 // за 15 минут на IP

// Валидация одного медиа-дескриптора (обложка ИЛИ элемент массива media): тип, формат
// ключа объекта (анти-подмена чужого пути в бакете), mime для типа, размер в лимите.
// Бросает APIError с понятным сообщением. `where` — для текста ошибки (какой файл).
function validateMediaDescriptor(m: unknown, where: string): void {
  if (!m || typeof m !== 'object') throw new APIError(`Некорректный файл (${where}).`, 400)
  const d = m as Record<string, unknown>
  const kind = d.kind
  if (kind !== 'photo' && kind !== 'video') {
    throw new APIError(`Тип должен быть photo или video (${where}).`, 400)
  }
  if (typeof d.objectKey !== 'string' || !OBJECT_KEY_RE.test(d.objectKey)) {
    throw new APIError(`Некорректный ключ объекта (${where}).`, 400)
  }
  if (
    d.posterKey != null &&
    (typeof d.posterKey !== 'string' || !OBJECT_KEY_RE.test(d.posterKey))
  ) {
    throw new APIError(`Некорректный ключ постера (${where}).`, 400)
  }
  if (typeof d.mime !== 'string' || !isAllowedMime(kind, d.mime)) {
    throw new APIError(`Неподдерживаемый формат файла (${where}).`, 400)
  }
  const maxBytes = (kind === 'photo' ? UGC_MAX_PHOTO_MB : UGC_MAX_VIDEO_MB) * 1024 * 1024
  const bytes = Number(d.bytes)
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytes) {
    const mb = kind === 'photo' ? UGC_MAX_PHOTO_MB : UGC_MAX_VIDEO_MB
    throw new APIError(`Файл слишком большой (максимум ${mb} МБ, ${where}).`, 413)
  }
}

export const rateLimitSubmission: CollectionBeforeValidateHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.user) return data
  if (!data || typeof data !== 'object') throw new APIError('Некорректный запрос.', 400)

  // 1) rate-limit по IP — до обращения к БД. Одна публикация = один POST, даже если в
  //    ней много файлов (файлы грузятся прямо в S3 пресайн-PUT'ами, минуя этот хук).
  const ip = clientIp(req.headers)
  const { ok, retryAfterMs } = rateLimit(`ugc-submit:${ip}`, MAX, WINDOW_MS)
  if (!ok) {
    const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    throw new APIError(`Слишком много загрузок. Попробуйте ещё раз через ${mins} мин.`, 429)
  }

  // 2) обложка (верхнеуровневые поля = файл №1) + доп. файлы (массив media = №2…№N).
  validateMediaDescriptor(data, 'обложка')
  const extra = data.media
  if (extra != null) {
    if (!Array.isArray(extra)) throw new APIError('Некорректный список файлов.', 400)
    if (extra.length > UGC_MAX_FILES - 1) {
      throw new APIError(`Слишком много файлов (максимум ${UGC_MAX_FILES}).`, 400)
    }
    extra.forEach((m, i) => validateMediaDescriptor(m, `файл ${i + 2}`))
  }

  // 3) санитайз текста + стоп-фильтр мата.
  data.authorName = clampText(data.authorName, UGC_MAX_AUTHOR)
  data.caption = clampText(data.caption, UGC_MAX_CAPTION)
  if (
    (data.authorName && containsProfanity(data.authorName)) ||
    (data.caption && containsProfanity(data.caption))
  ) {
    throw new APIError('Текст содержит недопустимые выражения. Поправьте, пожалуйста.', 400)
  }

  return data
}
