import { describe, it, expect } from 'vitest'

import { messagesPublicRead } from '@/access/messagesPublicRead'

// Чистый юнит-тест документ-уровневого read-доступа Messages: не поднимает
// Payload/БД (читает только req.user), гоняется без локального Postgres:
//   corepack pnpm exec vitest run tests/int/messages-read-access.int.spec.ts
//
// Контракт: staff (admin|editor) видят всё (true); все остальные — Where-фильтр,
// исключающий скрытые модерацией сообщения (isModerated != true).

const HIDDEN_FILTER = { isModerated: { not_equals: true } }

// Хелпер: вызвать access с заданным user (минимальный req-shape, остальное не читается).
function callAccess(user: unknown) {
  return messagesPublicRead({ req: { user } } as never)
}

describe('messagesPublicRead', () => {
  it('админ видит всё (включая скрытые модерацией)', () => {
    expect(callAccess({ id: 1, roles: ['admin'] })).toBe(true)
  })

  it('редактор видит всё', () => {
    expect(callAccess({ id: 2, roles: ['editor'] })).toBe(true)
  })

  it('админ среди нескольких ролей — всё равно полный read', () => {
    expect(callAccess({ id: 3, roles: ['user', 'admin'] })).toBe(true)
  })

  it('аноним (нет user) получает Where-фильтр по isModerated', () => {
    expect(callAccess(null)).toEqual(HIDDEN_FILTER)
  })

  it('обычный аккаунт (role user) получает Where-фильтр', () => {
    expect(callAccess({ id: 4, roles: ['user'] })).toEqual(HIDDEN_FILTER)
  })

  it('manager (инфра-роль, не staff контента) получает Where-фильтр', () => {
    expect(callAccess({ id: 5, roles: ['manager'] })).toEqual(HIDDEN_FILTER)
  })

  it('user без массива roles — defensive Where-фильтр', () => {
    expect(callAccess({ id: 6 })).toEqual(HIDDEN_FILTER)
  })
})
