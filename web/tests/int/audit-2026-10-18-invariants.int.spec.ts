import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Инварианты, заведённые состязательным аудитом 2026-10-18. Каждый — про класс,
 * который в коде уже был: не «опечатка», а системное чтение «аутентифицирован» как
 * «персонал» и «черновики включены, но read публичный».
 *
 * Тест читает исходники (без Payload и БД), потому что проверяет **конфигурацию**,
 * а не рантайм: импорт конфигов коллекций тянет редакторы и хуки Next-сборки.
 */

const SRC = join(__dirname, '..', '..', 'src')

const walk = (dir: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full)
  }
  return found
}

const read = (file: string) => readFileSync(file, 'utf8')

describe('черновики не отдаются публично', () => {
  const collectionFiles = walk(join(SRC, 'collections'))

  it('обход коллекций что-то нашёл — иначе проверка ниже декоративна', () => {
    expect(collectionFiles.length).toBeGreaterThan(5)
  })

  it('у каждой коллекции с drafts включённым read фильтрует статус публикации', () => {
    const offenders = collectionFiles.filter((file) => {
      const source = read(file)
      const draftsEnabled = /drafts\s*:\s*(true|\{)/.test(source)
      if (!draftsEnabled) return false
      // Публичный read без фильтра статуса: черновик уезжает в анонимный REST.
      return /read\s*:\s*anyone\b/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('набор с drafts непуст — иначе инвариант ничего не охраняет', () => {
    const withDrafts = collectionFiles.filter((file) =>
      /drafts\s*:\s*(true|\{)/.test(read(file)),
    )
    expect(withDrafts.length).toBeGreaterThanOrEqual(3)
  })
})

describe('UGC-хуки пропускают анти-абуз только персоналу', () => {
  const ugcFiles = walk(join(SRC, 'server', 'ugc'))

  it('обход модулей UGC что-то нашёл', () => {
    expect(ugcFiles.length).toBeGreaterThan(10)
  })

  it('ни один хук не выходит по «любому аутентифицированному»', () => {
    // Раньше здесь было `if (req.user) return data`: одна легитимная учётка любой роли
    // отключала лимиты, дедуп и проверку формата ключей объектов. Комментарии, которые
    // цитируют старый код как урок, из проверки исключены — охраняем код, не прозу.
    const withoutComments = (source: string) =>
      source
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n')

    const offenders = ugcFiles.filter((file) =>
      /if\s*\(\s*req\.user\s*\)\s*return\b/.test(withoutComments(read(file))),
    )
    expect(offenders).toEqual([])
  })

  it('гейт персонала на месте и он общий', () => {
    const source = read(join(SRC, 'server', 'ugc', 'ugc.ts'))
    expect(source).toMatch(/export function isContentStaff/)
    expect(source).toMatch(/CONTENT_STAFF_ROLES\s*=\s*\['admin',\s*'editor'\]/)
  })
})

describe('права на запись у плагинных коллекций не отданы «любому аутентифицированному»', () => {
  const plugins = read(join(SRC, 'plugins', 'index.ts'))

  const blockAfter = (marker: string, length = 1600) => {
    const index = plugins.indexOf(marker)
    expect(index, `маркер ${marker} не найден — тест устарел`).toBeGreaterThan(-1)
    return plugins.slice(index, index + length)
  }

  it('redirects: create/update/delete ограничены персоналом', () => {
    const block = blockAfter('redirectsPlugin(')
    expect(block).toMatch(/access:\s*{[\s\S]*?create:\s*adminOrEditor/)
    expect(block).toMatch(/update:\s*adminOrEditor/)
    expect(block).toMatch(/delete:\s*adminOrEditor/)
  })

  it('forms: запись (адресаты уведомлений) ограничена персоналом', () => {
    const block = blockAfter('formOverrides:', 2200)
    expect(block).toMatch(/access:\s*{[\s\S]*?update:\s*adminOrEditor/)
  })

  it('form-submissions: чтение ПДн и удаление заявок — только персонал', () => {
    const block = blockAfter('formSubmissionOverrides:', 900)
    expect(block).toMatch(/read:\s*adminOrEditor/)
    expect(block).toMatch(/delete:\s*adminOrEditor/)
  })

  it('search: правка и удаление индекса — только персонал', () => {
    const block = blockAfter('searchOverrides:', 900)
    expect(block).toMatch(/update:\s*adminOrEditor/)
    expect(block).toMatch(/delete:\s*adminOrEditor/)
  })
})
