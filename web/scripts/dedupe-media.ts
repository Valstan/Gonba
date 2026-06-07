import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { findMediaUsage, type MediaUsage } from '../src/server/media-usage/findMediaUsage'
import { mergeMediaInto } from '../src/server/media-usage/repoint'

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
// На локальном прод-дампе обязателен --keep-remote: Я.Диск шарится с продом,
// afterDelete иначе удалит РЕАЛЬНЫЙ файл (сломает прод до его собственного прогона).
const KEEP_REMOTE = argv.includes('--keep-remote')
const limitArg = argv.find((a) => a.startsWith('--limit'))
const LIMIT = limitArg ? Number(limitArg.split('=')[1] ?? argv[argv.indexOf(limitArg) + 1]) : undefined
// --group <sha-prefix> — обработать только одну группу (для точечной валидации).
const groupArg = argv.find((a) => a.startsWith('--group'))
const GROUP = groupArg ? (groupArg.split('=')[1] ?? argv[argv.indexOf(groupArg) + 1]) : undefined

// Логика репойнта/слияния вынесена в общий серверный модуль (его же использует
// эндпоинт C.2 «Заменить на другую»): src/server/media-usage/repoint.ts.

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

  let groups = GROUP ? rows.filter((r) => r.sha.startsWith(GROUP)) : rows
  if (typeof LIMIT === 'number' && !Number.isNaN(LIMIT)) groups = groups.slice(0, LIMIT)

  console.log(`\n${APPLY ? '⚠️  APPLY' : '🔍 DRY-RUN'} — групп дублей: ${groups.length}${LIMIT ? ` (limit ${LIMIT})` : ''}`)
  if (APPLY) console.log(`   Я.Диск-ресурсы копий: ${KEEP_REMOTE ? 'СОХРАНЯЮТСЯ (--keep-remote)' : 'УДАЛЯЮТСЯ'}`)
  console.log('')

  let totalDups = 0
  let totalRefs = 0
  let dupsWithRefs = 0
  let dupsZeroRefs = 0
  let repointedDocs = 0
  let deleted = 0

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

      if (APPLY) {
        const { repointed } = await mergeMediaInto(payload, dup, canonical, {
          keepRemote: KEEP_REMOTE,
          usage,
          disableRevalidate: true,
        })
        repointedDocs += repointed
        deleted++
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
  if (APPLY) {
    console.log(`Перепривязок (доков):   ${repointedDocs}`)
    console.log(`Удалено копий:          ${deleted}`)
  } else {
    console.log(`\n(dry-run — изменений нет. Для слияния: --apply, ПОСЛЕ pg_dump.)`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
