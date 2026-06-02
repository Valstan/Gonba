import { describe, it, expect } from 'vitest'

import { parseVkCommunityIdentifier } from '@/server/integrations/vk-auto-sync-resolve'

// Чистый юнит-тест парсера VK-идентификатора: не поднимает Payload/БД, поэтому
// гоняется отдельным файлом и без локального Postgres:
//   corepack pnpm exec vitest run tests/int/vk-resolve.int.spec.ts
describe('parseVkCommunityIdentifier', () => {
  it('распознаёт сообщество club/public/group как group', () => {
    expect(parseVkCommunityIdentifier('https://vk.com/club229392127')).toEqual({
      kind: 'group',
      groupId: 229392127,
    })
    expect(parseVkCommunityIdentifier('https://vk.com/public229392127')).toEqual({
      kind: 'group',
      groupId: 229392127,
    })
    expect(parseVkCommunityIdentifier('group_229392127')).toEqual({
      kind: 'group',
      groupId: 229392127,
    })
    expect(parseVkCommunityIdentifier('club229392127')).toEqual({
      kind: 'group',
      groupId: 229392127,
    })
  })

  it('распознаёт личную страницу vk.com/idN как user', () => {
    expect(parseVkCommunityIdentifier('https://vk.com/id86086407')).toEqual({
      kind: 'user',
      userId: 86086407,
    })
    expect(parseVkCommunityIdentifier('id86086407')).toEqual({
      kind: 'user',
      userId: 86086407,
    })
  })

  it('просто число — исторически сообщество (group)', () => {
    expect(parseVkCommunityIdentifier('229392127')).toEqual({
      kind: 'group',
      groupId: 229392127,
    })
  })

  it('короткое имя — тип неизвестен (только screenName, без kind)', () => {
    expect(parseVkCommunityIdentifier('https://vk.com/vyatskaya_lepota')).toEqual({
      screenName: 'vyatskaya_lepota',
    })
    expect(parseVkCommunityIdentifier('@durov')).toEqual({ screenName: 'durov' })
  })

  it('idea_studio (буквы после id) — это короткое имя, НЕ user', () => {
    expect(parseVkCommunityIdentifier('https://vk.com/idea_studio')).toEqual({
      screenName: 'idea_studio',
    })
  })

  it('отсекает query/hash и протокол', () => {
    expect(parseVkCommunityIdentifier('https://vk.com/club123?w=wall-123_456')).toEqual({
      kind: 'group',
      groupId: 123,
    })
    expect(parseVkCommunityIdentifier('https://vk.com/id777#feed')).toEqual({
      kind: 'user',
      userId: 777,
    })
  })

  it('пустые/мусорные значения → null', () => {
    expect(parseVkCommunityIdentifier('')).toBeNull()
    expect(parseVkCommunityIdentifier(null)).toBeNull()
    expect(parseVkCommunityIdentifier(undefined)).toBeNull()
    expect(parseVkCommunityIdentifier('   ')).toBeNull()
    expect(parseVkCommunityIdentifier('две слова')).toBeNull()
  })
})
