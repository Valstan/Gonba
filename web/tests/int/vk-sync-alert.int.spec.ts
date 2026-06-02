import { describe, it, expect } from 'vitest'

import { decideVkSyncAlert } from '@/server/integrations/vk-auto-sync'

// Чистая функция-решение для дедупа VK_SYNC_ALERT. Импорт vk-auto-sync.ts не
// поднимает Payload/БД (только type-импорты + чистый parseVkCommunityIdentifier),
// поэтому гоняется без локального Postgres:
//   corepack pnpm exec vitest run tests/int/vk-sync-alert.int.spec.ts
describe('decideVkSyncAlert', () => {
  it('нет опрошенных источников → не алертит', () => {
    const d = decideVkSyncAlert({ attempted: 0, errored: 0, prevConsecutiveAllFail: 0 })
    expect(d.allFailing).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.consecutiveAllFail).toBe(0)
  })

  it('частичный провал (не все упали) → не алертит, счётчик сброшен', () => {
    const d = decideVkSyncAlert({ attempted: 3, errored: 2, prevConsecutiveAllFail: 5 })
    expect(d.allFailing).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.consecutiveAllFail).toBe(0)
  })

  it('первый прогон «все упали» → алертит немедленно', () => {
    const d = decideVkSyncAlert({ attempted: 3, errored: 3, prevConsecutiveAllFail: 0 })
    expect(d).toMatchObject({ allFailing: true, consecutiveAllFail: 1, emit: true })
  })

  it('промежуточные подряд-провалы (2..7) → молчит, но считает', () => {
    for (let prev = 1; prev <= 6; prev++) {
      const d = decideVkSyncAlert({ attempted: 2, errored: 2, prevConsecutiveAllFail: prev })
      expect(d.emit).toBe(false)
      expect(d.consecutiveAllFail).toBe(prev + 1)
    }
  })

  it('8-й подряд-провал → heartbeat-алерт', () => {
    const d = decideVkSyncAlert({ attempted: 2, errored: 2, prevConsecutiveAllFail: 7 })
    expect(d).toMatchObject({ consecutiveAllFail: 8, emit: true })
  })

  it('здоровый прогон сбрасывает счётчик', () => {
    const d = decideVkSyncAlert({ attempted: 4, errored: 0, prevConsecutiveAllFail: 9 })
    expect(d).toMatchObject({ allFailing: false, consecutiveAllFail: 0, emit: false })
  })

  it('симуляция серии из 10 провалов: алерты только на 1-м и 8-м', () => {
    let prev = 0
    const emittedAt: number[] = []
    for (let run = 1; run <= 10; run++) {
      const d = decideVkSyncAlert({ attempted: 3, errored: 3, prevConsecutiveAllFail: prev })
      prev = d.consecutiveAllFail
      if (d.emit) emittedAt.push(d.consecutiveAllFail)
    }
    expect(emittedAt).toEqual([1, 8])
  })
})
