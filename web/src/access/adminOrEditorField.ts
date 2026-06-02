import type { FieldAccess } from 'payload'

/**
 * Field-level вариант `adminOrEditor`: разрешает read поля только админам и
 * редакторам, скрывая его из публичного REST-ответа для всех остальных.
 *
 * Нужен отдельно от `adminOrEditor` (тип `Access`), потому что у field-level
 * access другая сигнатура (`FieldAccess`). Применяется к служебным/чувствительным
 * полям в коллекциях с публичным `read` (например анти-абуз метаданные чата),
 * где `admin.hidden` НЕ помогает — оно прячет поле лишь из админ-UI, но не из API.
 */
export const adminOrEditorField: FieldAccess = ({ req: { user } }) => {
  if (!user || !Array.isArray(user.roles)) return false
  return user.roles.includes('admin') || user.roles.includes('editor')
}
