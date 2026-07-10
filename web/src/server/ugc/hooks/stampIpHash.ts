import type { CollectionBeforeChangeHook } from 'payload'

import { clientIp, hashIp, ownerHashFromHeaders } from '../ugc'
import { visitorFromHeaders } from '../visitorSession'

// Проставляет необратимый хеш IP на создании (дедуп лайков/жалоб/просмотров; не PII)
// и ownerHash (хеш браузерного токена — по нему автор отменяет «свой» лайк).
// beforeChange — ПОСЛЕ field-access, которое отбрасывает присланный анонимом ipHash →
// значение, выставленное здесь, доходит до БД. Для реакций/просмотров/жалоб (без UA);
// у submissions/comments отдельный stampSubmissionMeta (ipHash + userAgent + ownerHash).
// У content-reports поля ownerHash нет → лишний ключ Payload отбрасывает (жалобы
// «своими» не считаем, отменять нечего).
export const stampIpHash: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data
  data.ipHash = hashIp(clientIp(req.headers))
  const owner = ownerHashFromHeaders(req.headers)
  if (owner) data.ownerHash = owner
  // VK-вход (этап 5): закрепляем лайк за аккаунтом → отмена с любого устройства.
  const visitor = visitorFromHeaders(req.headers)
  if (visitor) data.ownerVisitor = visitor.visitorId
  return data
}
