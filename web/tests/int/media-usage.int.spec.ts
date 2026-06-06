import { describe, it, expect } from 'vitest'

import { buildUsageQuery } from '@/server/media-usage/findMediaUsage'
import { COLLECTION_META, MEDIA_SOURCES } from '@/server/media-usage/sources'

// Чистый билдер SQL карты использований media. Импорт findMediaUsage.ts не
// поднимает Payload/БД (только type-импорт `Payload` + чистый билдер), поэтому
// гоняется без локального Postgres:
//   corepack pnpm exec vitest run tests/int/media-usage.int.spec.ts
describe('media-usage source map', () => {
  it('каждый источник ссылается на известную коллекцию (инвариант полноты)', () => {
    for (const src of MEDIA_SOURCES) {
      expect(COLLECTION_META[src.collection], `нет COLLECTION_META для ${src.collection}`).toBeTruthy()
    }
  })

  it('hops===2 всегда несут промежуточную таблицу via, hops<2 — нет', () => {
    for (const src of MEDIA_SOURCES) {
      if (src.hops === 2) expect(src.via, `hops:2 без via: ${src.table}`).toBeTruthy()
      else expect(src.via, `via у hops<2: ${src.table}`).toBeUndefined()
    }
  })

  it('нет дублей (table+col+collection) в карте', () => {
    const keys = MEDIA_SOURCES.map((s) => `${s.collection}|${s.table}|${s.col}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('buildUsageQuery', () => {
  const sql = buildUsageQuery()

  it('один SELECT на источник, склеены через UNION ALL', () => {
    const selects = sql.match(/\bSELECT\b/g) ?? []
    expect(selects.length).toBe(MEDIA_SOURCES.length)
    const unions = sql.match(/UNION ALL/g) ?? []
    expect(unions.length).toBe(MEDIA_SOURCES.length - 1)
  })

  it('единственный bind-параметр — $1 (нет конкатенации пользовательского ввода)', () => {
    // Все $N в запросе должны быть либо $1 (media id), либо $mid (jsonpath-переменная).
    const params = sql.match(/\$\w+/g) ?? []
    for (const p of params) expect(['$1', '$mid']).toContain(p)
    expect(params.some((p) => p === '$1')).toBe(true)
  })

  it('FK-источники матчат по колонке = $1', () => {
    for (const src of MEDIA_SOURCES.filter((s) => s.match === 'fk')) {
      expect(sql).toContain(`t.${src.col} = $1`)
    }
  })

  it('richtext-источники сканируют jsonb рекурсивным upload-предикатом', () => {
    for (const src of MEDIA_SOURCES.filter((s) => s.match === 'richtext')) {
      expect(sql).toContain(`jsonb_path_exists(t.${src.col},`)
    }
    expect(sql).toContain('@.type == "upload" && @.relationTo == "media" && @.value == $mid')
  })

  it('hops:2 строит JOIN через via с резолвом doc id из v._parent_id', () => {
    for (const src of MEDIA_SOURCES.filter((s) => s.hops === 2)) {
      expect(sql).toContain(`FROM ${src.table} t JOIN ${src.via} v ON t._parent_id = v.id`)
    }
  })

  it('кириллические подписи полей экранированы как SQL-литералы', () => {
    // Подписи оборачиваются в '...'; апострофы (если появятся) удваиваются.
    expect(sql).toContain("'Обложка'::text")
    expect(sql).toContain("'В тексте'::text")
  })
})
