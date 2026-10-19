import type { CollectionConfig, Field } from 'payload'

import config from '@/payload.config'
import { describe, expect, it } from 'vitest'

/**
 * Регресс на прод-аварию 19.10 (сразу после деплоя аудита 2026-10-18).
 *
 * Закрыли чтение **всем** `yandex*`-полям медиа — и прод начал отдавать битые
 * картинки. Механика: `afterRead`-хук Media переписывает `doc.url` на прокси
 * `/api/media/file/{id}` только если **видит** `yandexPath`/`yandexResourceId`.
 * Там, где чтение идёт с соблюдением прав (публичный REST, SSR-запросы с
 * `overrideAccess: false`), поля приходили пустыми → хук не срабатывал → наружу
 * уезжал сырой payload'овский url `/api/media/file/<filename>`, а маршрут
 * `/api/media/file/[id]` принимает **id** → 404 на каждой картинке.
 *
 * Тест охраняет обе стороны: (1) хук по-прежнему переписывает url, (2) поля, от
 * которых он зависит, читаются публично, а прямая ссылка на Диск — нет.
 * Уровень — конфигурация коллекции (без БД): поведение «у реального анонима
 * пропали поля» здесь пиннится через отсутствие `read`-ограничения, потому что
 * именно оно и было причиной.
 */

const mediaConfig = (await config).collections.find((c) => c.slug === 'media') as CollectionConfig

const fieldByName = (name: string): Field | undefined =>
  (mediaConfig.fields as Field[]).find((f) => 'name' in f && f.name === name)

describe('Media: поля, нужные раздаче файлов, читаются публично', () => {
  it('yandexPath и yandexResourceId НЕ закрыты на чтение (иначе url не переписывается)', () => {
    for (const name of ['yandexPath', 'yandexResourceId']) {
      const field = fieldByName(name)
      expect(field, `поле ${name} не найдено — тест устарел`).toBeDefined()
      expect(
        (field as { access?: { read?: unknown } }).access?.read,
        `${name}.access.read ограничивает публичное чтение — хук раздачи перестанет видеть поле`,
      ).toBeUndefined()
    }
  })

  it('прямая ссылка на Диск (yandexPublicUrl) и ключ для её сборки закрыты на чтение', () => {
    for (const name of ['yandexPublicUrl', 'yandexPublicKey']) {
      const field = fieldByName(name)
      expect(field, `поле ${name} не найдено — тест устарел`).toBeDefined()
      expect(
        (field as { access?: { read?: unknown } }).access?.read,
        `${name}.access.read отсутствует — ссылка на файл в обход нашего прокси уезжает публично`,
      ).toBeDefined()
    }
  })

  it('запись служебных полей закрыта персоналу', () => {
    for (const name of ['yandexPath', 'yandexResourceId', 'yandexPublicUrl', 'yandexPublicKey']) {
      const access = (fieldByName(name) as { access?: { create?: unknown; update?: unknown } }).access
      expect(access?.create, `${name}.access.create не задан`).toBeDefined()
      expect(access?.update, `${name}.access.update не задан`).toBeDefined()
    }
  })

  it('afterRead переписывает url на прокси /api/media/file/{id}', async () => {
    const hook = mediaConfig.hooks?.afterRead?.[0]
    expect(typeof hook, 'afterRead-хук пропал — раздача файлов сломается').toBe('function')

    const doc = {
      id: 42,
      filename: 'x.jpg',
      yandexPath: '/media/42-x.jpg',
      url: '/api/media/file/x.jpg',
    }
    const result = (await (hook as (args: unknown) => Promise<typeof doc>)({
      doc,
      context: {},
      req: {},
    })) as typeof doc

    expect(result.url).toBe('/api/media/file/42')
  })

  it('без yandex-полей url остаётся как есть (запись без синка)', async () => {
    const hook = mediaConfig.hooks?.afterRead?.[0] as (args: unknown) => Promise<{ url?: string }>
    const result = await hook({
      doc: { id: 7, filename: 'x.jpg', url: '/api/media/file/x.jpg' },
      context: {},
      req: {},
    })
    expect(result.url).toBe('/api/media/file/x.jpg')
  })
})
