import { describe, expect, it } from 'vitest'

import { selectNextVkPost } from '@/server/integrations/vk-auto-sync'

const post = (id: number, text = `Пост ${id}`) => ({
  id,
  date: 0,
  text,
  owner_id: -1,
  from_id: -1,
})

describe('selectNextVkPost', () => {
  it('разбирает накопившиеся посты от старого к новому', () => {
    expect(selectNextVkPost([post(15), post(14), post(13)], 12)?.id).toBe(13)
  })

  it('пропускает пустые и уже импортированные записи', () => {
    expect(selectNextVkPost([post(15, '  '), post(14), post(13)], 13)?.id).toBe(14)
  })

  it('возвращает undefined, когда новых текстовых постов нет', () => {
    expect(selectNextVkPost([post(12), post(11)], 12)).toBeUndefined()
  })
})
