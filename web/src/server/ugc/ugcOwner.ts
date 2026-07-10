import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { rateLimit } from './rateLimit'
import { clientIp, ownerHashFromHeaders } from './ugc'
import { visitorFromHeaders } from './visitorSession'

// Серверная обвязка эндпоинтов /api/ugc/* «удалить/править своё».
//
// Модель доступа: действие разрешено, если запрос пришёл (а) от ПЕРСОНАЛА (валидный
// payload-token, роль admin/editor) — тогда правит/удаляет ЛЮБОЕ; ИЛИ (б) от ВЛАДЕЛЬЦА —
// хеш браузерного токена X-UGC-Owner совпал с ownerHash записи (аноним-владение), ИЛИ
// visitorId из VK-сессии совпал с ownerVisitor записи (этап 5: «своё» с любого
// устройства). Иначе 403. Запись грузим/правим overrideAccess (коллекции закрыты на
// update/delete для анонима).

let cached: Payload | null = null
export async function getPayloadClient(): Promise<Payload> {
  if (!cached) cached = await getPayload({ config })
  return cached
}

/** true, если запрос аутентифицирован как персонал (admin/editor). */
export async function isStaffRequest(payload: Payload, headers: Headers): Promise<boolean> {
  try {
    const { user } = await payload.auth({ headers })
    const roles = (user as { roles?: unknown } | null)?.roles
    return Array.isArray(roles) && (roles.includes('admin') || roles.includes('editor'))
  } catch {
    return false
  }
}

/** ownerHash запроса из заголовка X-UGC-Owner (null, если токена нет). */
export function requestOwnerHash(headers: Headers): string | null {
  return ownerHashFromHeaders(headers)
}

/** visitorId из VK-сессии запроса (null до этапа 5 / если не вошёл через VK). */
export function requestVisitorId(headers: Headers): number | null {
  return visitorFromHeaders(headers)?.visitorId ?? null
}

/**
 * Владеет ли запрос документом: по браузерному токену (ownerHash) ИЛИ по VK-аккаунту
 * (ownerVisitor). Единая проверка для всех /api/ugc/* эндпоинтов.
 */
export function isOwnerOf(
  doc: { ownerHash?: string | null; ownerVisitor?: number | null },
  headers: Headers,
): boolean {
  const owner = requestOwnerHash(headers)
  const visitorId = requestVisitorId(headers)
  return Boolean(
    (owner && doc.ownerHash && owner === doc.ownerHash) ||
      (visitorId && doc.ownerVisitor && visitorId === doc.ownerVisitor),
  )
}

/** Скромный rate-limit на мутации (delete/edit/unlike) по IP: анти-абьюз эндпоинтов. */
export function mutateRateOk(headers: Headers): boolean {
  return rateLimit(`ugc-mutate:${clientIp(headers)}`, 60, 10 * 60 * 1000).ok
}
