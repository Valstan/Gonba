import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Инвариант источника VK: любой **здоровый** исход прогона (`success` /
 * `no-new-posts`) обязан вместе со статусом погасить `lastError`.
 *
 * Зачем тест читает исходник, а не вызывает `syncVkSource`: тому нужны живой
 * Payload, БД и шлюз VK — то есть ни один прогон в тестах не проходит. А
 * историческая ошибка живёт не в логике, а в раскладке: «успех» и «зачистка»
 * стоят в разных ветках, и из четырёх здоровых веток две были забыты
 * (PR #66 починил две; забытые светили старым текстом до 2026-10-16 —
 * в проде это выглядело как `no-new-posts` рядом с таймаутом шлюза недельной
 * давности у источников 4/5/7).
 *
 * Поэтому тест сторожит форму: каждый `payload.update` к `vk-auto-sync`,
 * который пишет здоровый статус, должен в том же вызове содержать
 * `lastError: null`. Тест, который не может отказать, — декорация, поэтому
 * первая проверка (`разбор нашёл вызовы`) падает, если маркер переименуют:
 * иначе все остальные проверки «прошли» бы на пустом списке.
 */
const SOURCE = join(__dirname, '..', '..', 'src', 'server', 'integrations', 'vk-auto-sync.ts')

const HEALTHY_STATUSES = ["lastSyncStatus: 'success'", "lastSyncStatus: 'no-new-posts'"]

/** Режет исходник по вызовам, адресованным коллекции `vk-auto-sync`. */
const vkUpdateCalls = (source: string): string[] => {
  const marker = "collection: 'vk-auto-sync',"
  const starts: number[] = []
  for (let i = source.indexOf(marker); i !== -1; i = source.indexOf(marker, i + marker.length)) {
    starts.push(i)
  }
  return starts.map((start, idx) => source.slice(start, starts[idx + 1] ?? source.length))
}

describe('vk-auto-sync: lastError гасится на здоровых прогонах', () => {
  const calls = vkUpdateCalls(readFileSync(SOURCE, 'utf8'))

  it('разбор нашёл вызовы — иначе проверки ниже декоративны', () => {
    // В файле 10 обращений: 7 записей + чтения (findByID/find). Порог намеренно
    // низкий: он ловит переименование маркера, а не пересчёт веток.
    expect(calls.length).toBeGreaterThanOrEqual(4)
  })

  it('каждый здоровый статус идёт вместе с lastError: null', () => {
    const healthy = calls.filter((call) => HEALTHY_STATUSES.some((s) => call.includes(s)))
    // Здоровых веток в коде четыре (посты кончились / всё импортировано /
    // политика редакции skip / успешный импорт). Две — минимум, ниже которого
    // проверка перестаёт что-либо значить.
    expect(healthy.length).toBeGreaterThanOrEqual(2)
    for (const call of healthy) {
      expect(call).toContain('lastError: null')
      expect(call).not.toContain('lastError: errorMessage')
    }
  })

  it('в ветке ошибки lastError пишется, а не гасится', () => {
    const errored = calls.filter((call) => call.includes("lastSyncStatus: 'error'"))
    expect(errored.length).toBeGreaterThanOrEqual(1)
    for (const call of errored) {
      expect(call).not.toContain('lastError: null')
      expect(call).toContain('lastError: errorMessage')
    }
  })
})
