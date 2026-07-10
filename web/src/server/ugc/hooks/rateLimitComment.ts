import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

import { containsProfanity } from '../profanity'
import { rateLimit } from '../rateLimit'
import { clampText, clientIp, relId, UGC_MAX_AUTHOR } from '../ugc'
import { assertVisibleTarget } from './ugcHelpers'

// Комментарий к публикации (POST /api/submission-comments). Анонимно, постмодерация
// (виден сразу). Хук: rate-limit + публикация видима + санитайз + стоп-фильтр мата.
// ipHash/userAgent ставит stampSubmissionMeta (beforeChange).
const MAX = 10 // комментариев
const WINDOW_MS = 10 * 60 * 1000 // за 10 минут на IP
const MAX_BODY = 1000

export const rateLimitComment: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.user) return data
  if (!data || typeof data !== 'object') throw new APIError('Некорректный запрос.', 400)

  const ip = clientIp(req.headers)
  const { ok, retryAfterMs } = rateLimit(`ugc-comment:${ip}`, MAX, WINDOW_MS)
  if (!ok) {
    const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    throw new APIError(`Слишком много комментариев. Попробуйте ещё раз через ${mins} мин.`, 429)
  }

  const submissionId = relId(data.submission)
  if (!submissionId) throw new APIError('Не указана публикация.', 400)
  await assertVisibleTarget(req, 'submissions', submissionId)

  data.authorName = clampText(data.authorName, UGC_MAX_AUTHOR)
  data.body = clampText(data.body, MAX_BODY)
  if (!data.body) throw new APIError('Комментарий пуст.', 400)
  if (containsProfanity(data.body) || (data.authorName && containsProfanity(data.authorName))) {
    throw new APIError('Текст содержит недопустимые выражения. Поправьте, пожалуйста.', 400)
  }

  return data
}
