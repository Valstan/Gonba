import type { PayloadRequest } from 'payload'

import { APIError } from 'payload'

// Помощники для хуков «Народной ленты»: загрузка цели реакции/коммента/жалобы и
// проверка её существования/видимости. overrideAccess — серверная проверка целостности.

type UgcCollection = 'submissions' | 'submission-comments'

/** Статус документа по id, либо null если не найден. */
export async function loadStatus(
  req: PayloadRequest,
  collection: UgcCollection,
  id: number,
): Promise<string | null> {
  try {
    // req — чтобы запрос шёл в той же транзакции (видел незакоммиченные изменения).
    const doc = await req.payload.findByID({ collection, id, depth: 0, overrideAccess: true, req })
    return (doc?.status as string) ?? null
  } catch {
    return null
  }
}

/** Цель должна существовать и быть видимой (status='visible'), иначе APIError. */
export async function assertVisibleTarget(
  req: PayloadRequest,
  collection: UgcCollection,
  id: number,
): Promise<void> {
  const status = await loadStatus(req, collection, id)
  if (status === null) throw new APIError('Публикация не найдена.', 404)
  if (status !== 'visible') throw new APIError('Действие недоступно для этой публикации.', 409)
}
