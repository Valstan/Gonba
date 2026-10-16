import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Инвариант сборки: шрифты сайта — свои (`public/fonts` + `fonts.css`), а не
 * загруженные из чужого CDN во время сборки.
 *
 * Зачем сторож: `next/font/google` ходит за CSS и файлами в Google **в момент
 * сборки** и разбирает чужой ответ строгим regex'ом (`find-font-files-in-css.js`
 * ищет `src: url(...)`, а `loader.js` требует, чтобы URL кончался расширением
 * шрифта). Любое отклонение формы ответа даёт `TypeError: Cannot read properties
 * of null (reading '1')` — и пайплайн краснеет не из-за кода. 16.10.2026 это
 * случилось дважды за час: сначала упал деплой (лечили повторным прогоном),
 * потом — обязательный чек CI, то есть PR стало нельзя смёржить. Шрифты перенесли
 * в репозиторий тем же байтами, что отдавал прод; тест не даёт вернуть зависимость
 * незаметно.
 *
 * `geist/font/*` — это пакет из `node_modules`, сети он не требует и под запрет
 * не попадает: правило именно про внешний CDN.
 */
const SRC = join(__dirname, '..', '..', 'src')

const walk = (dir: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (/\.(ts|tsx|css|scss|js|jsx|mjs)$/.test(entry)) found.push(full)
  }
  return found
}

describe('шрифты: сборка не ходит в CDN Google', () => {
  const files = walk(SRC)

  it('обход исходников что-то нашёл — иначе проверка ниже декоративна', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('ни один файл не импортирует next/font/google и не тянет fonts.gstatic.com', () => {
    const googleFontImport = /from\s+['"]next\/font\/google['"]/
    const googleCdn = /fonts\.(googleapis|gstatic)\.com/
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      text.split(/\r?\n/).forEach((line, index) => {
        if (googleFontImport.test(line) || googleCdn.test(line)) {
          // Печатаем путь и строку: если это проза в комментарии, видно сразу.
          offenders.push(`${file.replace(SRC, 'src')}:${index + 1}: ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('наши шрифты на месте и объявлены в fonts.css', () => {
    const css = readFileSync(join(SRC, 'app', '(frontend)', 'fonts.css'), 'utf8')
    for (const family of ['PT Serif', 'Manrope', 'JetBrains Mono']) {
      expect(css).toContain(`font-family: '${family}'`)
    }
    // Запасные метрики (size-adjust) сохраняют поведение next/font: без них
    // первый кадр рисовался бы другим шрифтом с другими метриками.
    expect(css).toContain('size-adjust')
    expect(css).toContain("--font-pt-serif: \"PT Serif\",\"PT Serif Fallback\"")
  })
})
