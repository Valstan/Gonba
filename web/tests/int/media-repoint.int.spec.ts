import { describe, it, expect } from 'vitest'

import { replaceUploads, MEDIA_FIELDS, CAROUSEL_FIELDS } from '@/server/media-usage/repoint'

// `replaceUploads` — чистая рекурсивная замена value в Lexical upload-узлах
// (from → to). Импорт repoint.ts не поднимает Payload/БД (только type-импорт
// `Payload` + чистые функции), поэтому гоняется без локального Postgres:
//   corepack pnpm exec vitest run tests/int/media-repoint.int.spec.ts

// Минимальный Lexical-документ с одним upload-узлом media.
const lexical = (mediaId: number) => ({
  root: {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'привет' }] },
      { type: 'upload', relationTo: 'media', value: mediaId },
      {
        type: 'block',
        children: [{ type: 'upload', relationTo: 'media', value: mediaId }],
      },
    ],
  },
})

describe('replaceUploads', () => {
  it('заменяет value во всех вложенных upload-узлах media from → to', () => {
    const { value, changed } = replaceUploads(lexical(287), 287, 166)
    expect(changed).toBe(true)
    const root = (value as ReturnType<typeof lexical>).root
    expect(root.children[1].value).toBe(166)
    // вложенный в block узел тоже перепривязан
    expect((root.children[2].children as Array<{ value: number }>)[0].value).toBe(166)
  })

  it('понимает upload-value как объект {id} (depth>0), сравнение по id', () => {
    const node = { type: 'upload', relationTo: 'media', value: { id: 287, url: '/x' } }
    const { value, changed } = replaceUploads(node, 287, 166)
    expect(changed).toBe(true)
    expect((value as { value: unknown }).value).toBe(166)
  })

  it('не трогает чужие id и не-media upload-узлы', () => {
    const node = {
      type: 'root',
      children: [
        { type: 'upload', relationTo: 'media', value: 999 },
        { type: 'upload', relationTo: 'documents', value: 287 },
      ],
    }
    const { value, changed } = replaceUploads(node, 287, 166)
    expect(changed).toBe(false)
    const children = (value as { children: Array<{ value: number }> }).children
    expect(children[0].value).toBe(999)
    expect(children[1].value).toBe(287)
  })

  it('null / примитивы возвращаются без изменений', () => {
    expect(replaceUploads(null, 1, 2)).toEqual({ value: null, changed: false })
    expect(replaceUploads('текст', 1, 2)).toEqual({ value: 'текст', changed: false })
  })
})

describe('repoint field-map (инвариант fail-safe)', () => {
  it('pages и media намеренно вне MEDIA_FIELDS (их media — в блоках; репойнт бросит, а не осиротит)', () => {
    expect(MEDIA_FIELDS.pages).toBeUndefined()
    expect(MEDIA_FIELDS.media).toBeUndefined()
  })

  it('покрытые коллекции имеют непустые спеки', () => {
    for (const key of ['posts', 'projects', 'events', 'services', 'products', 'vkImportQueue']) {
      expect(Array.isArray(MEDIA_FIELDS[key]), `нет спеков для ${key}`).toBe(true)
      expect(MEDIA_FIELDS[key].length).toBeGreaterThan(0)
    }
  })

  it('глобал карусели покрывает center + items', () => {
    const kinds = CAROUSEL_FIELDS.map((s) => s.kind)
    expect(kinds).toContain('group')
    expect(kinds).toContain('array')
  })
})
