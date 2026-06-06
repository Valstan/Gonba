import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { findMediaUsage, type MediaUsage } from '../src/server/media-usage/findMediaUsage'

/**
 * Слияние дублей медиа-библиотеки — план media-library-integrity.md Phase D.
 *
 * Дубли = записи Media с одинаковым `yandexSha256` (одно и то же содержимое,
 * залитое повторно до dedup-логики #107). В каждой группе оставляем «канонную»
 * (самую раннюю — наименьший id), перепривязываем все ссылки прочих копий на
 * неё, затем удаляем лишние (вместе с их Я.Диск-ресурсами).
 *
 * РЕЖИМЫ:
 *   (по умолчанию)  --dry  — НИЧЕГО не пишет. Группирует дубли, выбирает канонную,
 *                            перечисляет все ссылки каждой копии (через usage-движок
 *                            C.1) и печатает полный план + сводку. Безопасно.
 *   --apply                — выполняет слияние (см. ниже). Деструктивно. ⚠️
 *
 * Перепривязка (--apply) идёт через Payload Local API (`payload.update`), НЕ сырым
 * SQL: контент-коллекции версионируемы (drafts) — сырой UPDATE разъедет main и
 * `_<coll>_v`, а следующая публикация затрёт правку (урок CLAUDE.md). Local API
 * пишет обе таблицы + триггерит хуки/синк поиска. Удаление копии — через
 * `payload.delete({ context: { forceDelete: true } })` (обходит safe-delete-хук C.2
 * намеренно; afterDelete чистит Я.Диск-ресурс).
 *
 * Запуск (Windows dev / прод):
 *   corepack pnpm tsx scripts/dedupe-media.ts                 # dry, все группы
 *   corepack pnpm tsx scripts/dedupe-media.ts --limit 5       # dry, первые 5 групп
 *   corepack pnpm tsx scripts/dedupe-media.ts --apply         # СЛИЯНИЕ (после dry + pg_dump!)
 */

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const limitArg = argv.find((a) => a.startsWith('--limit'))
const LIMIT = limitArg ? Number(limitArg.split('=')[1] ?? argv[argv.indexOf(limitArg) + 1]) : undefined

if (APPLY) {
  // Перепривязка (per-doc Local API трансформ для версионируемых доков) — следующий
  // инкремент Phase D, после ревью dry-вывода и теста на прод-дампе. Пока только --dry.
  console.error('--apply ещё не реализован. Сперва ревью --dry, затем репойнт-логика + тест на дампе.')
  process.exit(2)
}

type DupGroup = { sha: string; ids: number[] }

const fmtUsage = (u: MediaUsage) => {
  const what = u.isGlobal ? u.label : `${u.label} «${u.title ?? `#${u.docId}`}»`
  return u.fields.length ? `${what} [${u.fields.join(', ')}]` : what
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  const pool = (
    payload.db as unknown as { pool: { query: (t: string, p?: unknown[]) => Promise<{ rows: DupGroup[] }> } }
  ).pool

  const { rows } = await pool.query(
    `SELECT yandex_sha256 AS sha, array_agg(id ORDER BY id) AS ids
       FROM media
      WHERE yandex_sha256 IS NOT NULL
      GROUP BY yandex_sha256
     HAVING count(*) > 1
      ORDER BY count(*) DESC, min(id) ASC`,
  )

  const groups = typeof LIMIT === 'number' && !Number.isNaN(LIMIT) ? rows.slice(0, LIMIT) : rows

  console.log(`\n${APPLY ? '⚠️  APPLY' : '🔍 DRY-RUN'} — групп дублей: ${groups.length}${LIMIT ? ` (limit ${LIMIT})` : ''}\n`)

  let totalDups = 0
  let totalRefs = 0
  let dupsWithRefs = 0
  let dupsZeroRefs = 0

  for (const g of groups) {
    const ids = g.ids
    const canonical = ids[0] // наименьший id = самая ранняя загрузка
    const dups = ids.slice(1)

    const lines: string[] = []
    for (const dup of dups) {
      totalDups++
      const usage = await findMediaUsage(payload, dup)
      totalRefs += usage.total
      if (usage.total > 0) {
        dupsWithRefs++
        lines.push(`    #${dup} → ${usage.total} ссыл.: ${usage.usages.map(fmtUsage).join('; ')}`)
      } else {
        dupsZeroRefs++
        lines.push(`    #${dup} → 0 ссылок (удалить)`)
      }
    }

    if (dups.length) {
      console.log(`  sha ${g.sha.slice(0, 12)} | канон #${canonical} | дублей ${dups.length}`)
      for (const l of lines) console.log(l)
    }
  }

  console.log(`\n──────── СВОДКА ────────`)
  console.log(`Групп дублей:           ${groups.length}`)
  console.log(`Дублей (к удалению):    ${totalDups}`)
  console.log(`  из них без ссылок:    ${dupsZeroRefs}`)
  console.log(`  из них со ссылками:   ${dupsWithRefs}`)
  console.log(`Всего ссылок-привязок:  ${totalRefs}`)
  console.log(`\n(dry-run — изменений нет. Для слияния: --apply, ПОСЛЕ pg_dump.)`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
