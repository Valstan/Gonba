import { describe, expect, it } from 'vitest'

import {
  boundedLevenshtein,
  buildHighlightSegments,
  switchKeyboardLayout,
  tieredSearch,
} from '@/utilities/tieredSearch'

// Чистый юнит-тест tieredSearch (pool #035): не поднимает Payload/БД, поэтому
// гоняется отдельным файлом и без локального Postgres:
//   corepack pnpm exec vitest run tests/int/tiered-search.int.spec.ts

type Doc = { id: number; text: string }
const doc = (id: number, text: string): Doc => ({ id, text })
const getText = (d: Doc) => d.text

const ids = (results: Array<{ item: Doc }>) => results.map((r) => r.item.id)

describe('tieredSearch — уровень 1 (substring)', () => {
  it('находит фрагмент в любом месте строки, без учёта регистра', () => {
    const docs = [doc(1, 'IMG_20260601_усадьба.jpg'), doc(2, 'orbit-hero.png')]
    expect(ids(tieredSearch(docs, 'усадьб', getText))).toEqual([1])
    expect(ids(tieredSearch(docs, 'HERO', getText))).toEqual([2])
  })

  it('многотокенный AND: все токены обязаны совпасть', () => {
    const docs = [doc(1, 'мастер-класс гончарный 2026'), doc(2, 'гончарный круг')]
    expect(ids(tieredSearch(docs, 'гончар мастер', getText))).toEqual([1])
    // совпадение ближе к началу строки ранжируется выше
    expect(ids(tieredSearch(docs, 'гончар', getText))).toEqual([2, 1])
  })

  it('ё и е эквивалентны', () => {
    const docs = [doc(1, 'пчёлы на пасеке')]
    expect(ids(tieredSearch(docs, 'пчелы', getText))).toEqual([1])
  })

  it('номерная нормализация: цифры с разделителями находят слитный номер', () => {
    const docs = [doc(1, 'wall-229392127_417.jpg'), doc(2, 'photo-001.png')]
    expect(ids(tieredSearch(docs, '229 392127', getText))).toEqual([1])
  })

  it('возвращает диапазоны подсветки для точных совпадений', () => {
    const [r] = tieredSearch([doc(1, 'orbit-hero.png')], 'hero', getText)
    expect(r.tier).toBe(1)
    expect(r.ranges).toEqual([[6, 10]])
  })
})

describe('tieredSearch — RU↔EN раскладка', () => {
  it('switchKeyboardLayout переводит в обе стороны', () => {
    expect(switchKeyboardLayout('ujym')).toBe('гонь')
    expect(switchKeyboardLayout('гонь')).toBe('ujym')
  })

  it('запрос в неверной раскладке находит документ', () => {
    const docs = [doc(1, 'гоньба-логотип.png'), doc(2, 'hero.png')]
    // «ujym» = «гонь» в EN-раскладке
    expect(ids(tieredSearch(docs, 'ujym', getText))).toEqual([1])
    // и наоборот: «рукщ» = «hero» в RU-раскладке
    expect(ids(tieredSearch(docs, 'рукщ', getText))).toEqual([2])
  })
})

describe('tieredSearch — уровни 2/3 (subsequence / fuzzy)', () => {
  it('subsequence: буквы по порядку с разрывами, когда substring не совпал', () => {
    const docs = [doc(1, 'мастер-класс.jpg')]
    const [r] = tieredSearch(docs, 'мкласс', getText)
    expect(r.item.id).toBe(1)
    expect(r.tier).toBe(2)
    expect(r.ranges).toEqual([]) // подсветка только на точных совпадениях
  })

  it('fuzzy: опечатка в одну букву находит слово', () => {
    const docs = [doc(1, 'усадьба вечером')]
    const [r] = tieredSearch(docs, 'усадбьа', getText)
    expect(r.item.id).toBe(1)
    expect(r.tier).toBe(3)
  })

  it('точные совпадения ранжируются выше похожих', () => {
    const docs = [doc(1, 'усадба.jpg'), doc(2, 'усадьба.jpg')]
    const results = tieredSearch(docs, 'усадьба', getText)
    expect(ids(results)).toEqual([2, 1])
    expect(results[0].tier).toBe(1)
    expect(results[1].tier).toBe(3)
  })

  it('мусорный запрос не находит ничего', () => {
    const docs = [doc(1, 'усадьба.jpg'), doc(2, 'hero.png')]
    expect(tieredSearch(docs, 'qqqzzzqqq', getText)).toEqual([])
  })

  it('пустой запрос — пустой результат (min-chars забота вызывающего)', () => {
    expect(tieredSearch([doc(1, 'a')], '   ', getText)).toEqual([])
  })
})

describe('boundedLevenshtein', () => {
  it('считает точную дистанцию в пределах порога', () => {
    expect(boundedLevenshtein('кот', 'кит', 1)).toBe(1)
    expect(boundedLevenshtein('hero', 'hero', 1)).toBe(0)
  })

  it('обрывается за порогом', () => {
    expect(boundedLevenshtein('абвгд', 'xyz', 1)).toBe(2) // maxDist+1
  })
})

describe('buildHighlightSegments', () => {
  it('режет текст на сегменты с пометкой hit', () => {
    expect(buildHighlightSegments('orbit-hero.png', [[6, 10]])).toEqual([
      { text: 'orbit-', hit: false },
      { text: 'hero', hit: true },
      { text: '.png', hit: false },
    ])
  })

  it('сливает пересекающиеся диапазоны', () => {
    expect(
      buildHighlightSegments('abcdef', [
        [1, 3],
        [2, 5],
      ]),
    ).toEqual([
      { text: 'a', hit: false },
      { text: 'bcde', hit: true },
      { text: 'f', hit: false },
    ])
  })

  it('без диапазонов — один обычный сегмент', () => {
    expect(buildHighlightSegments('abc', [])).toEqual([{ text: 'abc', hit: false }])
  })
})
