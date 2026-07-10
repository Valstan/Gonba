import type { CollectionBeforeValidateHook, Where } from 'payload'

import { APIError } from 'payload'

import { rateLimit } from '../rateLimit'
import { clientIp, hashIp, ownerHashFromHeaders, relId } from '../ugc'
import { assertVisibleTarget } from './ugcHelpers'

// Просмотр публикации (POST /api/submission-views). Анонимно, дедуп «один просмотр на
// зрителя»: по браузерному токену ownerHash при наличии (точнее при общем NAT),
// иначе по хешу IP. Лимит отсекает грубый флуд — просмотры массовее лайков, потому
// порог выше. Засчитывается при ОТКРЫТИИ медиа (не при прокрутке); повторный POST
// того же зрителя → 409 (клиент игнорирует).
const MAX = 300 // просмотров
const WINDOW_MS = 10 * 60 * 1000 // за 10 минут на IP

export const rateLimitView: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.user) return data
  if (!data || typeof data !== 'object') throw new APIError('Некорректный запрос.', 400)

  const ip = clientIp(req.headers)
  const { ok, retryAfterMs } = rateLimit(`ugc-view:${ip}`, MAX, WINDOW_MS)
  if (!ok) {
    const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    throw new APIError(`Слишком много действий. Попробуйте ещё раз через ${mins} мин.`, 429)
  }

  const submissionId = relId(data.submission)
  if (!submissionId) throw new APIError('Не указана публикация.', 400)

  // Публикация существует и видима (нельзя засчитать просмотр скрытой/удалённой).
  await assertVisibleTarget(req, 'submissions', submissionId)

  // Дедуп: один просмотр на зрителя. Ключ — ownerHash (точнее при общем NAT), иначе ipHash.
  const ownerHash = ownerHashFromHeaders(req.headers)
  const dedup: Where = ownerHash
    ? { ownerHash: { equals: ownerHash } }
    : { ipHash: { equals: hashIp(ip) } }
  const existing = await req.payload.count({
    collection: 'submission-views',
    where: { and: [{ submission: { equals: submissionId } }, dedup] },
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) throw new APIError('Просмотр уже засчитан.', 409)

  return data
}
