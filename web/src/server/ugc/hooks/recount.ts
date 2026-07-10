import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { relId } from '../ugc'

// Пересчёт агрегатов на публикации (likeCount/commentCount/viewCount) COUNT'ом по
// таблице-источнику, а не ±1: идемпотентно и без гонок инкремента. req передаём во
// все вызовы — иначе count/update идут вне текущей транзакции и не видят только что
// вставленную/удалённую строку (off-by-one — грабля, пойманная Sabantuy).
//
// Один параметризованный конструктор вместо трёх файлов-близнецов оригинала.

type RecountSpec = {
  /** Коллекция-источник строк (лайки/комменты/просмотры). */
  source: 'submission-reactions' | 'submission-comments' | 'submission-views'
  /** Поле-агрегат на submissions. */
  counterField: 'likeCount' | 'commentCount' | 'viewCount'
  /** Считать только видимые строки (комментарии). */
  onlyVisible?: boolean
}

function makeRecount(spec: RecountSpec) {
  async function recount(req: PayloadRequest, submissionId: number) {
    try {
      const { totalDocs } = await req.payload.count({
        collection: spec.source,
        where: spec.onlyVisible
          ? { and: [{ submission: { equals: submissionId } }, { status: { equals: 'visible' } }] }
          : { submission: { equals: submissionId } },
        overrideAccess: true,
        req,
      })
      await req.payload.update({
        collection: 'submissions',
        id: submissionId,
        data: { [spec.counterField]: totalDocs },
        overrideAccess: true,
        req,
      })
    } catch (err) {
      // Сбой пересчёта не должен ронять основную операцию (строка уже создана/удалена).
      req.payload.logger.error({ err, submissionId }, `recount ${spec.counterField} failed`)
    }
  }

  const afterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
    const id = relId(doc?.submission)
    if (id) await recount(req, id)
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
    const id = relId(doc?.submission)
    if (id) await recount(req, id)
    return doc
  }
  return { afterChange, afterDelete }
}

export const recountLikes = makeRecount({ source: 'submission-reactions', counterField: 'likeCount' })
export const recountComments = makeRecount({
  source: 'submission-comments',
  counterField: 'commentCount',
  onlyVisible: true,
})
export const recountViews = makeRecount({ source: 'submission-views', counterField: 'viewCount' })
