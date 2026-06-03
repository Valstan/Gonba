import type { Access } from 'payload'

/**
 * Read-доступ к коллекции Messages.
 *
 * Чат публичный — любой посетитель видит сообщения, поэтому read открыт для всех.
 * Но сообщения, скрытые модерацией (`isModerated = true`), не должны утекать через
 * raw `GET /api/messages`: публичные endpoint'ы чата фильтруют их сами
 * (`overrideAccess: true` + `isModerated: { not_equals: true }`), а вот прямой
 * REST-запрос без фильтра отдавал бы их тела наружу.
 *
 * Решение: админам/редакторам — полный read (видят скрытые для модерации); всем
 * остальным (включая анонимов и не-staff аккаунты) — Where-фильтр, исключающий
 * скрытые сообщения. Серверные пути чата идут с `overrideAccess` и не затрагиваются.
 *
 * Поле-уровневый аналог для метаданных (`ipHash`/`userAgent`/`hiddenReason`) —
 * `adminOrEditorField`; этот же документ-уровневый фильтр закрывает само тело.
 */
export const messagesPublicRead: Access = ({ req: { user } }) => {
  if (
    user &&
    Array.isArray(user.roles) &&
    (user.roles.includes('admin') || user.roles.includes('editor'))
  ) {
    return true
  }
  return {
    isModerated: { not_equals: true },
  }
}
