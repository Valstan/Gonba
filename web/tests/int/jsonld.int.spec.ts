import { describe, it, expect, beforeAll } from 'vitest'

import { serializeJsonLd } from '@/components/seo/JsonLd'

// SEO/GEO JSON-LD билдеры (pool #051) — чистые функции, без БД/Payload.
// Фиксируем NEXT_PUBLIC_SERVER_URL для детерминированных абсолютных URL.
const BASE = 'https://example.test'

let jsonld: typeof import('@/seo/jsonld')

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SERVER_URL = BASE
  jsonld = await import('@/seo/jsonld')
})

describe('absoluteUrl', () => {
  it('относительный путь → абсолютный от BASE', () => {
    expect(jsonld.absoluteUrl('/posts/x')).toBe(`${BASE}/posts/x`)
  })
  it('путь без ведущего слэша получает слэш', () => {
    expect(jsonld.absoluteUrl('posts/x')).toBe(`${BASE}/posts/x`)
  })
  it('уже абсолютный http(s) URL не трогается', () => {
    expect(jsonld.absoluteUrl('https://cdn.example/i.jpg')).toBe('https://cdn.example/i.jpg')
  })
  it('пусто → undefined', () => {
    expect(jsonld.absoluteUrl(null)).toBeUndefined()
    expect(jsonld.absoluteUrl('')).toBeUndefined()
  })
})

describe('organizationJsonLd / websiteJsonLd', () => {
  it('Organization: тип, абсолютные url/logo, @id', () => {
    const org = jsonld.organizationJsonLd()
    expect(org['@type']).toBe('Organization')
    expect(org['@id']).toBe(`${BASE}/#organization`)
    expect(org.url).toBe(BASE)
    expect(String(org.logo)).toMatch(/^https:\/\/example\.test\/.+\.svg$/)
    expect(typeof org.name).toBe('string')
  })
  it('WebSite: SearchAction с плейсхолдером запроса + publisher ссылается на Organization', () => {
    const ws = jsonld.websiteJsonLd() as Record<string, any>
    expect(ws['@type']).toBe('WebSite')
    expect(ws.potentialAction['@type']).toBe('SearchAction')
    expect(ws.potentialAction.target.urlTemplate).toContain('{search_term_string}')
    expect(ws.publisher['@id']).toBe(`${BASE}/#organization`)
  })
})

describe('breadcrumbJsonLd', () => {
  it('позиции 1..n; последний элемент без href не получает поле item', () => {
    const bc = jsonld.breadcrumbJsonLd([
      { href: '/', label: 'Главная' },
      { href: '/posts', label: 'Посты' },
      { label: 'Текущая' },
    ]) as Record<string, any>
    expect(bc['@type']).toBe('BreadcrumbList')
    expect(bc.itemListElement).toHaveLength(3)
    expect(bc.itemListElement[0]).toMatchObject({ position: 1, item: `${BASE}/` })
    expect(bc.itemListElement[1]).toMatchObject({ position: 2, item: `${BASE}/posts` })
    expect(bc.itemListElement[2].position).toBe(3)
    expect(bc.itemListElement[2].item).toBeUndefined()
  })
})

describe('articleJsonLd', () => {
  it('BlogPosting: headline/даты/абсолютные url+image; авторы как Person[]', () => {
    const a = jsonld.articleJsonLd(
      {
        title: 'Заголовок',
        publishedAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
        meta: { description: 'опис' },
        heroImage: { url: '/api/media/file/1' },
        populatedAuthors: [{ name: 'Автор' }],
      },
      '/posts/zagolovok',
    ) as Record<string, any>
    expect(a['@type']).toBe('BlogPosting')
    expect(a.headline).toBe('Заголовок')
    expect(a.datePublished).toBe('2026-01-02T00:00:00.000Z')
    expect(a.dateModified).toBe('2026-01-03T00:00:00.000Z')
    expect(a.url).toBe(`${BASE}/posts/zagolovok`)
    expect(a.image).toEqual([`${BASE}/api/media/file/1`])
    expect(a.author).toEqual([{ '@type': 'Person', name: 'Автор' }])
  })
  it('без авторов → publisher-организация как author fallback', () => {
    const a = jsonld.articleJsonLd({ title: 'X' }, '/posts/x') as Record<string, any>
    expect(a.author['@type']).toBe('Organization')
  })
})

describe('eventJsonLd / productJsonLd / serviceJsonLd', () => {
  it('Event: тип, startDate, Place-локация', () => {
    const e = jsonld.eventJsonLd({ title: 'Ярмарка', startDate: '2026-07-01' }, '/events/y') as Record<string, any>
    expect(e['@type']).toBe('Event')
    expect(e.startDate).toBe('2026-07-01')
    expect(e.location['@type']).toBe('Place')
    expect(e.url).toBe(`${BASE}/events/y`)
  })
  it('Product: offers при наличии цены', () => {
    const p = jsonld.productJsonLd({ title: 'Горшок', price: 500, currency: 'RUB' }, '/shop/g') as Record<string, any>
    expect(p['@type']).toBe('Product')
    expect(p.offers).toMatchObject({ '@type': 'Offer', price: 500, priceCurrency: 'RUB' })
  })
  it('Product: без цены offers отсутствует (после JSON.stringify)', () => {
    const p = jsonld.productJsonLd({ title: 'Горшок' }, '/shop/g')
    expect(JSON.parse(JSON.stringify(p)).offers).toBeUndefined()
  })
  it('Service: тип + provider-ссылка + offers при цене', () => {
    const s = jsonld.serviceJsonLd({ title: 'Баня', price: 1000 }, '/services/b') as Record<string, any>
    expect(s['@type']).toBe('Service')
    expect(s.provider['@id']).toBe(`${BASE}/#organization`)
    expect(s.offers.price).toBe(1000)
  })
})

describe('serializeJsonLd (XSS-safe)', () => {
  it('экранирует </script>, < и &; вывод обратимо парсится в исходные данные', () => {
    const data = { name: '</script><img src=x onerror=alert(1)> & co' }
    const out = serializeJsonLd(data)
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<img')
    expect(out).toContain('\\u003c')
    expect(out).toContain('\\u0026')
    expect(JSON.parse(out)).toEqual(data) // \uXXXX парсится назад в исходные символы
  })

  it('экранирует разделители строк U+2028 / U+2029', () => {
    const data = { a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` }
    const out = serializeJsonLd(data)
    expect(out).toContain('\\u2028')
    expect(out).toContain('\\u2029')
    expect(JSON.parse(out)).toEqual(data)
  })

  it('обычные пробелы НЕ трогаются (регрессия на ошибочный матч пробела)', () => {
    const out = serializeJsonLd({ a: 'два слова' })
    expect(out).toContain('два слова')
  })
})
