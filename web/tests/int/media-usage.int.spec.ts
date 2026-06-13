import { describe, it, expect } from 'vitest'

import { buildUsageQuery, type MediaUsageResult } from '@/server/media-usage/findMediaUsage'
import { buildInUseMessage } from '@/server/media-usage/preventDeleteHook'
import { ALL_MEDIA_SOURCES, COLLECTION_META, MEDIA_SOURCES, MEDIA_VERSION_SOURCES } from '@/server/media-usage/sources'

const usage = (over: Partial<MediaUsageResult['usages'][number]> = {}) => ({
  collection: 'posts',
  label: 'Запись',
  isGlobal: false,
  docId: 26,
  title: 'Привет',
  fields: ['Обложка'],
  adminUrl: null,
  frontendUrl: null,
  ...over,
})

// Чистый билдер SQL карты использований media. Импорт findMediaUsage.ts не
// поднимает Payload/БД (только type-импорт `Payload` + чистый билдер), поэтому
// гоняется без локального Postgres:
//   corepack pnpm exec vitest run tests/int/media-usage.int.spec.ts
describe('media-usage source map', () => {
  it('каждый источник ссылается на известную коллекцию (инвариант полноты)', () => {
    for (const src of ALL_MEDIA_SOURCES) {
      expect(COLLECTION_META[src.collection], `нет COLLECTION_META для ${src.collection}`).toBeTruthy()
    }
  })

  it('hops===2 всегда несут промежуточную таблицу via, hops<2 — нет', () => {
    for (const src of ALL_MEDIA_SOURCES) {
      if (src.hops === 2) expect(src.via, `hops:2 без via: ${src.table}`).toBeTruthy()
      else expect(src.via, `via у hops<2: ${src.table}`).toBeUndefined()
    }
  })

  it('нет дублей (table+col+collection) в карте', () => {
    const keys = ALL_MEDIA_SOURCES.map((s) => `${s.collection}|${s.table}|${s.col}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('версионные (_v) источники — draft-only ссылки (Phase C.2 хвост «а»)', () => {
  it('все версионные источники несут versionTable из versioned-коллекций', () => {
    const versioned = new Set(['posts', 'pages', 'projects', 'events', 'services'])
    expect(MEDIA_VERSION_SOURCES.length).toBeGreaterThan(0)
    for (const src of MEDIA_VERSION_SOURCES) {
      expect(src.versionTable, `версионный источник без versionTable: ${src.table}`).toBeTruthy()
      expect(versioned.has(src.collection), `${src.collection} не versioned`).toBe(true)
      // hops:0 → table === versionTable; иначе table — вложенная _v-таблица.
      if (src.hops === 0) expect(src.table).toBe(src.versionTable)
    }
  })

  it('обычные источники НЕ версионные (versionTable отсутствует)', () => {
    for (const src of MEDIA_SOURCES) expect(src.versionTable).toBeUndefined()
  })
})

describe('buildUsageQuery', () => {
  const sql = buildUsageQuery()

  it('один SELECT на источник (main + версионные), склеены через UNION ALL', () => {
    const selects = sql.match(/\bSELECT\b/g) ?? []
    expect(selects.length).toBe(ALL_MEDIA_SOURCES.length)
    const unions = sql.match(/UNION ALL/g) ?? []
    expect(unions.length).toBe(ALL_MEDIA_SOURCES.length - 1)
  })

  it('единственный bind-параметр — $1 (нет конкатенации пользовательского ввода)', () => {
    // Все $N в запросе должны быть либо $1 (media id), либо $mid (jsonpath-переменная).
    const params = sql.match(/\$\w+/g) ?? []
    for (const p of params) expect(['$1', '$mid']).toContain(p)
    expect(params.some((p) => p === '$1')).toBe(true)
  })

  it('FK-источники матчат по колонке = $1', () => {
    for (const src of ALL_MEDIA_SOURCES.filter((s) => s.match === 'fk')) {
      expect(sql).toContain(`t.${src.col} = $1`)
    }
  })

  it('richtext-источники сканируют jsonb рекурсивным upload-предикатом', () => {
    for (const src of ALL_MEDIA_SOURCES.filter((s) => s.match === 'richtext')) {
      expect(sql).toContain(`jsonb_path_exists(t.${src.col},`)
    }
    expect(sql).toContain('@.type == "upload" && @.relationTo == "media" && @.value == $mid')
  })

  it('обычные hops:2 строят JOIN через via с резолвом doc id из v._parent_id', () => {
    for (const src of MEDIA_SOURCES.filter((s) => s.hops === 2)) {
      expect(sql).toContain(`FROM ${src.table} t JOIN ${src.via} v ON t._parent_id = v.id`)
    }
  })

  it('версионные источники: считают latest и резолвят doc через parent_id', () => {
    // hops:0 — сама _<coll>_v несёт latest/parent_id.
    expect(sql).toContain('FROM _posts_v t WHERE t.latest IS TRUE AND t.parent_id IS NOT NULL AND t.version_hero_image_id = $1')
    // hops:1 — массив на доке джойнит _<coll>_v как vv, latest на vv.
    expect(sql).toContain('JOIN _projects_v vv ON t._parent_id = vv.id WHERE vv.latest IS TRUE AND vv.parent_id IS NOT NULL')
    // hops:2 — блок-айтемы джойнят via, затем _<coll>_v как vv.
    expect(sql).toContain('JOIN _pages_v_blocks_gallery v ON t._parent_id = v.id JOIN _pages_v vv ON v._parent_id = vv.id WHERE vv.latest IS TRUE')
    // doc_id у версионных источников берётся из parent_id (главный документ), не из id строки версии.
    expect(sql).toContain('t.parent_id::int AS doc_id')
    expect(sql).toContain('vv.parent_id::int AS doc_id')
    // версионный richtext тоже сканируется в jsonb (version_-колонка).
    expect(sql).toContain('jsonb_path_exists(t.version_content,')
  })

  it('кириллические подписи полей экранированы как SQL-литералы', () => {
    // Подписи оборачиваются в '...'; апострофы (если появятся) удваиваются.
    expect(sql).toContain("'Обложка'::text")
    expect(sql).toContain("'В тексте'::text")
  })
})

describe('buildInUseMessage (safe-delete C.2)', () => {
  it('перечисляет место с полями и заголовком', () => {
    const msg = buildInUseMessage({
      mediaId: 5,
      total: 1,
      usages: [usage({ fields: ['Обложка', 'В тексте'] })],
    })
    expect(msg).toContain('используется (1)')
    expect(msg).toContain('Запись «Привет» (Обложка, В тексте)')
  })

  it('глобал показывается без doc-заголовка', () => {
    const msg = buildInUseMessage({
      mediaId: 5,
      total: 1,
      usages: [
        usage({ collection: 'home_carousel', label: 'Карусель (глобал)', isGlobal: true, docId: null, title: 'Карусель (глобал)', fields: ['Центр карусели'] }),
      ],
    })
    expect(msg).toContain('Карусель (глобал) (Центр карусели)')
  })

  it('пустой title → #id', () => {
    const msg = buildInUseMessage({ mediaId: 5, total: 1, usages: [usage({ docId: 42, title: null })] })
    expect(msg).toContain('Запись «#42»')
  })

  it('обрезает список после 15 с «и ещё N»', () => {
    const usages = Array.from({ length: 20 }, (_, i) => usage({ docId: i, title: `T${i}` }))
    const msg = buildInUseMessage({ mediaId: 5, total: 20, usages })
    expect(msg).toContain('и ещё 5')
  })
})
