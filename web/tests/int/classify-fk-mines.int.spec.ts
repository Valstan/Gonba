import { describe, it, expect } from 'vitest'

import { classifyFkMines, type AllowEntry, type FkMine } from '@/utilities/classifyFkMines'

const mine = (id: string, refTable: string): FkMine => {
  const [table, column] = id.split('.')
  return { id, table, column, refTable }
}

const allow = (id: string, refTable?: string): AllowEntry => ({ id, refTable })

describe('classifyFkMines (G135 gate)', () => {
  it('найдено ровно столько, сколько в allowlist → всё known, fresh пуст', () => {
    const found = [mine('vk_auto_sync.project_id', 'projects'), mine('orders_items.product_id', 'products')]
    const allowed = [allow('vk_auto_sync.project_id', 'projects'), allow('orders_items.product_id', 'products')]

    const v = classifyFkMines(found, allowed)

    expect(v.known).toHaveLength(2)
    expect(v.fresh).toHaveLength(0)
    expect(v.healed).toHaveLength(0)
  })

  it('новая мина в схеме не в allowlist → fresh (гейт краснеет)', () => {
    const found = [mine('orders_items.product_id', 'products'), mine('events.speaker_id', 'speakers')]
    const allowed = [allow('orders_items.product_id', 'products')]

    const v = classifyFkMines(found, allowed)

    expect(v.known).toHaveLength(1)
    expect(v.fresh.map((m) => m.id)).toEqual(['events.speaker_id'])
  })

  it('мина из allowlist вылечена (в схеме отсутствует) → healed, fresh пуст', () => {
    const found = [mine('messages.project_id', 'projects')]
    const allowed = [allow('messages.project_id', 'projects'), allow('orders_items.product_id', 'products')]

    const v = classifyFkMines(found, allowed)

    expect(v.fresh).toHaveLength(0)
    expect(v.healed.map((h) => h.id)).toEqual(['orders_items.product_id'])
  })

  it('refTable в allowlist не совпал с фактическим → мина считается НОВОЙ', () => {
    // Защита от «допустили одну ссылку, легли под другой FK на ту же колонку».
    const found = [mine('vk_auto_sync.project_id', 'users')]
    const allowed = [allow('vk_auto_sync.project_id', 'projects')]

    const v = classifyFkMines(found, allowed)

    expect(v.fresh.map((m) => m.id)).toEqual(['vk_auto_sync.project_id'])
  })

  it('allowlist без refTable допускается (проверяется только пара table.column)', () => {
    const found = [mine('products_images.image_id', 'media')]
    const allowed = [allow('products_images.image_id')]

    const v = classifyFkMines(found, allowed)

    expect(v.known).toHaveLength(1)
    expect(v.fresh).toHaveLength(0)
  })

  it('контроль-негатив: пустая схема при непустом allowlist → все healed, гейт зелёный', () => {
    const v = classifyFkMines([], [allow('messages.project_id', 'projects')])

    expect(v.fresh).toHaveLength(0)
    expect(v.healed).toHaveLength(1)
  })
})
