import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Информер посещаемости (D-017) и его прокси. Проверяем ровно то, ради чего прокси заведён:
 * постоянный URL в разметке, работа без настроенного счётчика и отсутствие запроса к
 * третьей стороне из браузера посетителя (G80 + приватность).
 */

const ORIGINAL_COUNTER = process.env.YM_COUNTER_ID

async function loadInformerRoute() {
  vi.resetModules()
  return import('@/app/api/analytics-informer/route')
}

async function loadStatsRoute() {
  vi.resetModules()
  return import('@/app/api/analytics-stats/route')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (ORIGINAL_COUNTER === undefined) delete process.env.YM_COUNTER_ID
  else process.env.YM_COUNTER_ID = ORIGINAL_COUNTER
})

describe('informer proxy', () => {
  it('отдаёт прозрачный PNG и не ходит наружу, пока счётчик не настроен', async () => {
    delete process.env.YM_COUNTER_ID
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { GET } = await loadInformerRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('проксирует бейдж Метрики, когда счётчик задан', async () => {
    process.env.YM_COUNTER_ID = '111457955'
    const badge = new Uint8Array([1, 2, 3, 4])
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => badge.buffer,
    }))
    vi.stubGlobal('fetch', fetchSpy)

    const { GET } = await loadInformerRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/informer/111457955/')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(badge)
  })

  it('переживает недоступность Метрики — подвал не ломается битой картинкой', async () => {
    process.env.YM_COUNTER_ID = '111457955'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const { GET } = await loadInformerRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
  })
})

describe('informer click-through', () => {
  it('ведёт на публичную статистику счётчика', async () => {
    process.env.YM_COUNTER_ID = '111457955'
    const { GET } = await loadStatsRoute()
    const res = await GET(new Request('https://xn--80abf4be9f.xn--p1ai/api/analytics-stats'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://metrika.yandex.ru/stat/?id=111457955&from=informer',
    )
  })

  it('без счётчика уводит на главную, а не в никуда', async () => {
    delete process.env.YM_COUNTER_ID
    const { GET } = await loadStatsRoute()
    const res = await GET(new Request('https://xn--80abf4be9f.xn--p1ai/api/analytics-stats'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://xn--80abf4be9f.xn--p1ai/')
  })
})

describe('подвал', () => {
  it('ссылается на свой origin, а не на informer.yandex.ru напрямую', async () => {
    const { resolve } = await import('node:path')
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(resolve(process.cwd(), 'src/Footer/Component.tsx'), 'utf8'),
    )

    expect(source).toContain('/api/analytics-informer')
    expect(source).toContain('/api/analytics-stats')
    expect(source).not.toContain('informer.yandex.ru')
    // Бейдж LiveInternet вычеркнут решением владельца (D-025).
    expect(source).not.toContain('li-counter-slot')
  })
})
