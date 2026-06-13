import { describe, it, expect } from 'vitest'

import { matchesStableVkSlug } from '@/server/integrations/vk-auto-sync'

// Чистая функция — без БД/Payload:
//   corepack pnpm exec vitest run tests/int/vk-idempotency.int.spec.ts
describe('matchesStableVkSlug — идемпотентность VK по стабильному ключу', () => {
  const stable = 'vk-123-41'

  it('точное совпадение со стабильным ключом', () => {
    expect(matchesStableVkSlug('vk-123-41', stable)).toBe(true)
  })

  it('совпадение при наличии text-suffix (URL-читаемость)', () => {
    expect(matchesStableVkSlug('vk-123-41-privet-mir', stable)).toBe(true)
    expect(matchesStableVkSlug('vk-123-41-', stable)).toBe(true)
  })

  it('НЕ матчит более длинный postId с тем же префиксом (главный анти-дубль-инвариант)', () => {
    // Без обязательного хвостового "-" это была бы ложная склейка 41 ↔ 417.
    expect(matchesStableVkSlug('vk-123-417', stable)).toBe(false)
    expect(matchesStableVkSlug('vk-123-417-bar', stable)).toBe(false)
    expect(matchesStableVkSlug('vk-123-410', stable)).toBe(false)
  })

  it('НЕ матчит другую группу при том же postId', () => {
    expect(matchesStableVkSlug('vk-999-41', stable)).toBe(false)
    expect(matchesStableVkSlug('vk-999-41-privet', stable)).toBe(false)
  })

  it('НЕ матчит, если стабильный ключ — внутри/в конце чужого slug (не префикс)', () => {
    expect(matchesStableVkSlug('post-vk-123-41', stable)).toBe(false)
    expect(matchesStableVkSlug('xvk-123-41', stable)).toBe(false)
  })

  it('пустой / null / undefined slug → false', () => {
    expect(matchesStableVkSlug('', stable)).toBe(false)
    expect(matchesStableVkSlug(null, stable)).toBe(false)
    expect(matchesStableVkSlug(undefined, stable)).toBe(false)
  })
})
