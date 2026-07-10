import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

import { rateLimit } from '../rateLimit'
import { clientIp, hashIp, relId } from '../ugc'
import { assertVisibleTarget } from './ugcHelpers'

// Лайк публикации (POST /api/submission-reactions). Анонимно, дедуп «один лайк на
// браузер/IP» через хеш IP. Лимит отсекает грубый флуд; основной дедуп — проверка
// существующей реакции (submission, ipHash) → 409.
const MAX = 60 // лайков
const WINDOW_MS = 10 * 60 * 1000 // за 10 минут на IP

export const rateLimitReaction: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.user) return data
  if (!data || typeof data !== 'object') throw new APIError('Некорректный запрос.', 400)

  const ip = clientIp(req.headers)
  const { ok, retryAfterMs } = rateLimit(`ugc-react:${ip}`, MAX, WINDOW_MS)
  if (!ok) {
    const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    throw new APIError(`Слишком много действий. Попробуйте ещё раз через ${mins} мин.`, 429)
  }

  const submissionId = relId(data.submission)
  if (!submissionId) throw new APIError('Не указана публикация.', 400)

  // Публикация существует и видима (нельзя лайкать скрытую/удалённую).
  await assertVisibleTarget(req, 'submissions', submissionId)

  // Дедуп: одна реакция на (submission, ipHash).
  const ipHash = hashIp(ip)
  const existing = await req.payload.count({
    collection: 'submission-reactions',
    where: { and: [{ submission: { equals: submissionId } }, { ipHash: { equals: ipHash } }] },
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) throw new APIError('Вы уже оценили эту публикацию.', 409)

  return data
}
