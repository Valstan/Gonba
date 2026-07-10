import type { CollectionAfterChangeHook } from 'payload'

import { UGC_REPORT_HIDE_THRESHOLD } from '../ugc'

// По факту новой жалобы: пересчитать число жалоб на цель и при достижении порога
// авто-скрыть её (status='hidden' + hiddenReason) до разбора персоналом. Пересчёт
// COUNT'ом (источник правды — таблица жалоб), не ±1. overrideAccess — серверная
// операция в обход field-access.
export const applyContentReport: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const targetType = doc?.targetType
  const targetId = Number(doc?.targetId)
  if ((targetType !== 'submission' && targetType !== 'comment') || !Number.isInteger(targetId)) {
    return doc
  }
  const collection = targetType === 'submission' ? 'submissions' : 'submission-comments'

  try {
    // req во всех вызовах — иначе count/findByID/update идут вне текущей транзакции и
    // не видят только что вставленную жалобу (счётчик отставал бы на 1).
    const { totalDocs } = await req.payload.count({
      collection: 'content-reports',
      where: {
        and: [{ targetType: { equals: targetType } }, { targetId: { equals: targetId } }],
      },
      overrideAccess: true,
      req,
    })

    const target = await req.payload.findByID({
      collection,
      id: targetId,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const data: Record<string, unknown> = { reportCount: totalDocs }
    // Авто-скрытие на пороге — только из видимого (не трогаем уже скрытое/удалённое
    // и ручные решения персонала).
    if (totalDocs >= UGC_REPORT_HIDE_THRESHOLD && target?.status === 'visible') {
      data.status = 'hidden'
      data.hiddenReason = 'авто: жалобы посетителей'
    }

    await req.payload.update({ collection, id: targetId, data, overrideAccess: true, req })
  } catch (err) {
    req.payload.logger.error({ err, targetType, targetId }, 'applyContentReport failed')
  }

  return doc
}
