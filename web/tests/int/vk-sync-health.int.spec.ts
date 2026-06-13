import { describe, it, expect } from 'vitest'

import { summarizeVkSyncHealth } from '@/server/integrations/vk-sync-health'

// Чистая функция-сводка для health-флага VK в /api/health. Без Payload/БД:
//   corepack pnpm exec vitest run tests/int/vk-sync-health.int.spec.ts
const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-06-13T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('summarizeVkSyncHealth', () => {
  it('нет включённых источников → healthy (нечего ломаться)', () => {
    const h = summarizeVkSyncHealth([], NOW)
    expect(h).toMatchObject({ healthy: true, enabledSources: 0, erroredSources: 0, staleSources: 0 })
    expect(h.lastSyncAt).toBeNull()
    expect(h.details).toBeUndefined()
  })

  it('все источники свежи и успешны → healthy', () => {
    const h = summarizeVkSyncHealth(
      [
        { lastSyncStatus: 'success', lastSyncAt: ago(HOUR), syncIntervalHours: 3 },
        { lastSyncStatus: 'no-new-posts', lastSyncAt: ago(2 * HOUR), syncIntervalHours: 3 },
      ],
      NOW,
    )
    expect(h.healthy).toBe(true)
    expect(h.enabledSources).toBe(2)
    expect(h.erroredSources).toBe(0)
    expect(h.lastSyncAt).toBe(ago(HOUR))
  })

  it('ВСЕ опрошенные в ошибке → unhealthy (зеркало VK_SYNC_ALERT, майский кейс)', () => {
    const h = summarizeVkSyncHealth(
      [
        { lastSyncStatus: 'error', lastSyncAt: ago(HOUR), syncIntervalHours: 3 },
        { lastSyncStatus: 'error', lastSyncAt: ago(2 * HOUR), syncIntervalHours: 3 },
      ],
      NOW,
    )
    expect(h.healthy).toBe(false)
    expect(h.erroredSources).toBe(2)
    expect(h.details).toContain('в ошибке')
  })

  it('частичный провал (1 из 2 в ошибке, свежие) → healthy, но erroredSources виден', () => {
    const h = summarizeVkSyncHealth(
      [
        { lastSyncStatus: 'error', lastSyncAt: ago(HOUR), syncIntervalHours: 3 },
        { lastSyncStatus: 'success', lastSyncAt: ago(HOUR), syncIntervalHours: 3 },
      ],
      NOW,
    )
    expect(h.healthy).toBe(true)
    expect(h.erroredSources).toBe(1)
  })

  it('просрочен (sync старше 2× интервала +буфер) → unhealthy, staleSources', () => {
    const h = summarizeVkSyncHealth(
      // интервал 3ч → порог 2*3+1=7ч; 8ч назад = просрочен
      [{ lastSyncStatus: 'success', lastSyncAt: ago(8 * HOUR), syncIntervalHours: 3 }],
      NOW,
    )
    expect(h.healthy).toBe(false)
    expect(h.staleSources).toBe(1)
    expect(h.details).toContain('просрочен')
  })

  it('один пропущенный прогон в пределах буфера → ещё healthy (нет ложной тревоги)', () => {
    // порог 7ч; 6ч назад — не просрочен
    const h = summarizeVkSyncHealth(
      [{ lastSyncStatus: 'no-new-posts', lastSyncAt: ago(6 * HOUR), syncIntervalHours: 3 }],
      NOW,
    )
    expect(h.healthy).toBe(true)
    expect(h.staleSources).toBe(0)
  })

  it('pending/никогда не синканный → не считается опрошенным и не просрочен', () => {
    const h = summarizeVkSyncHealth(
      [
        { lastSyncStatus: 'pending', lastSyncAt: null, syncIntervalHours: 3 },
        { lastSyncStatus: 'success', lastSyncAt: ago(HOUR), syncIntervalHours: 3 },
      ],
      NOW,
    )
    // attempted=1 (только success), не «все в ошибке» → healthy
    expect(h.healthy).toBe(true)
    expect(h.staleSources).toBe(0)
    expect(h.enabledSources).toBe(2)
  })

  it('дефолт интервала = 3ч, если поле пустое', () => {
    const h = summarizeVkSyncHealth(
      [{ lastSyncStatus: 'success', lastSyncAt: ago(8 * HOUR), syncIntervalHours: null }],
      NOW,
    )
    // null → 3ч → порог 7ч → 8ч просрочен
    expect(h.staleSources).toBe(1)
    expect(h.healthy).toBe(false)
  })

  it('большой интервал (24ч) не считается просроченным на 8ч', () => {
    const h = summarizeVkSyncHealth(
      [{ lastSyncStatus: 'success', lastSyncAt: ago(8 * HOUR), syncIntervalHours: 24 }],
      NOW,
    )
    expect(h.staleSources).toBe(0)
    expect(h.healthy).toBe(true)
  })
})
