import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

import { rateLimit } from '../rateLimit'
import { clampText, clientIp, hashIp, UGC_REPORT_TARGETS } from '../ugc'
import { assertVisibleTarget } from './ugcHelpers'

// Жалоба на публикацию/комментарий (POST /api/content-reports). Анонимно. Хук:
// rate-limit + валидация цели (существует и видима) + дедуп (одна жалоба на
// цель+IP) + санитайз причины. afterChange (applyContentReport) считает жалобы и
// авто-скрывает цель на пороге.
const MAX = 20 // жалоб
const WINDOW_MS = 10 * 60 * 1000 // за 10 минут на IP
const MAX_REASON = 500

export const rateLimitReport: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  if (req.user) return data
  if (!data || typeof data !== 'object') throw new APIError('Некорректный запрос.', 400)

  const ip = clientIp(req.headers)
  const { ok, retryAfterMs } = rateLimit(`ugc-report:${ip}`, MAX, WINDOW_MS)
  if (!ok) {
    const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    throw new APIError(`Слишком много жалоб. Попробуйте ещё раз через ${mins} мин.`, 429)
  }

  const targetType = data.targetType
  if (targetType !== 'submission' && targetType !== 'comment') {
    throw new APIError('Неизвестный тип цели.', 400)
  }
  if (!UGC_REPORT_TARGETS.includes(targetType)) throw new APIError('Неизвестный тип цели.', 400)
  const targetId = Number(data.targetId)
  if (!Number.isInteger(targetId) || targetId < 1) throw new APIError('Некорректная цель.', 400)

  const collection = targetType === 'submission' ? 'submissions' : 'submission-comments'
  await assertVisibleTarget(req, collection, targetId)

  // Дедуп: одна жалоба на (targetType, targetId, ipHash).
  const ipHash = hashIp(ip)
  const existing = await req.payload.count({
    collection: 'content-reports',
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
        { ipHash: { equals: ipHash } },
      ],
    },
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) throw new APIError('Вы уже пожаловались на это.', 409)

  data.reason = clampText(data.reason, MAX_REASON)

  return data
}
