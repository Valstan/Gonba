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
// На локальном прод-дампе обязателен --keep-remote: Я.Диск шарится с продом,
// afterDelete иначе удалит РЕАЛЬНЫЙ файл (сломает прод до его собственного прогона).
const KEEP_REMOTE = argv.includes('--keep-remote')
const limitArg = argv.find((a) => a.startsWith('--limit'))
const LIMIT = limitArg ? Number(limitArg.split('=')[1] ?? argv[argv.indexOf(limitArg) + 1]) : undefined
// --group <sha-prefix> — обработать только одну группу (для точечной валидации).
const groupArg = argv.find((a) => a.startsWith('--group'))
const GROUP = groupArg ? (groupArg.split('=')[1] ?? argv[argv.indexOf(groupArg) + 1]) : undefined

// ── Карта медиа-полей по коллекциям (API-имена) для версионно-корректного репойнта ──
type FieldSpec =
  | { kind: 'fk'; field: string }
  | { kind: 'group'; group: string; field: string }
  | { kind: 'array'; array: string; field: string }
  | { kind: 'richtext'; field: string }

const MEDIA_FIELDS: Record<string, FieldSpec[]> = {
  posts: [{ kind: 'fk', field: 'heroImage' }, { kind: 'group', group: 'meta', field: 'image' }, { kind: 'richtext', field: 'content' }],
  projects: [{ kind: 'fk', field: 'heroImage' }, { kind: 'fk', field: 'logo' }, { kind: 'array', array: 'gallery', field: 'image' }, { kind: 'richtext', field: 'description' }],
  events: [{ kind: 'fk', field: 'heroImage' }, { kind: 'array', array: 'gallery', field: 'image' }, { kind: 'richtext', field: 'content' }],
  services: [{ kind: 'fk', field: 'heroImage' }, { kind: 'richtext', field: 'description' }],
  products: [{ kind: 'array', array: 'images', field: 'image' }, { kind: 'richtext', field: 'description' }],
  vkImportQueue: [{ kind: 'fk', field: 'heroImage' }],
}
const CAROUSEL_FIELDS: FieldSpec[] = [{ kind: 'group', group: 'center', field: 'image' }, { kind: 'array', array: 'items', field: 'image' }]
const VERSIONED = new Set(['posts', 'projects', 'events', 'services', 'pages'])

const idEq = (v: unknown, id: number) => {
  const n = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return Number(n) === id
}

/** Рекурсивно заменяет value в Lexical upload-узлах dup → canonical. */
function replaceUploads(node: unknown, dup: number, canonical: number): { value: unknown; changed: boolean } {
  if (Array.isArray(node)) {
    let changed = false
    const arr = node.map((n) => {
      const r = replaceUploads(n, dup, canonical)
      changed = changed || r.changed
      return r.value
    })
    return { value: arr, changed }
  }
  if (node && typeof node === 'object') {
    const src = node as Record<string, unknown>
    const out: Record<string, unknown> = { ...src }
    let changed = false
    if (src.type === 'upload' && idEq(src.value, dup)) {
      out.value = canonical
      changed = true
    }
    for (const k of Object.keys(src)) {
      if (k === 'value' && src.type === 'upload') continue
      const r = replaceUploads(src[k], dup, canonical)
      if (r.changed) {
        out[k] = r.value
        changed = true
      }
    }
    return { value: out, changed }
  }
  return { value: node, changed: false }
}

/** Минимальный патч для Local API: только затронутые медиа-поля, группы/массивы — целиком. */
function buildPatch(specs: FieldSpec[], doc: Record<string, unknown>, dup: number, canonical: number) {
  const patch: Record<string, unknown> = {}
  let changed = false
  for (const s of specs) {
    if (s.kind === 'fk') {
      if (idEq(doc[s.field], dup)) {
        patch[s.field] = canonical
        changed = true
      }
    } else if (s.kind === 'group') {
      const g = doc[s.group] as Record<string, unknown> | null | undefined
      if (g && idEq(g[s.field], dup)) {
        patch[s.group] = { ...g, [s.field]: canonical }
        changed = true
      }
    } else if (s.kind === 'array') {
      const arr = doc[s.array] as Array<Record<string, unknown>> | null | undefined
      if (Array.isArray(arr) && arr.some((it) => idEq(it?.[s.field], dup))) {
        patch[s.array] = arr.map((it) => (idEq(it?.[s.field], dup) ? { ...it, [s.field]: canonical } : it))
        changed = true
      }
    } else if (s.kind === 'richtext') {
      const r = replaceUploads(doc[s.field], dup, canonical)
      if (r.changed) {
        patch[s.field] = r.value
        changed = true
      }
    }
  }
  return { patch, changed }
}

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

/** Перепривязывает все ссылки копии dup → canonical, проверяет 0 ссылок, удаляет копию. */
async function mergeDup(
  payload: PayloadInstance,
  dup: number,
  canonical: number,
  usage: Awaited<ReturnType<typeof findMediaUsage>>,
): Promise<number> {
  let repointed = 0
  for (const u of usage.usages) {
    if (u.isGlobal) {
      const g = (await payload.findGlobal({ slug: 'homeCarousel' as never, depth: 0, overrideAccess: true })) as Record<string, unknown>
      const { patch, changed } = buildPatch(CAROUSEL_FIELDS, g, dup, canonical)
      if (changed) {
        await payload.updateGlobal({ slug: 'homeCarousel' as never, data: patch as never, overrideAccess: true, context: { disableRevalidate: true } })
        repointed++
      }
      continue
    }
    const specs = MEDIA_FIELDS[u.collection]
    if (!specs) throw new Error(`Нет field-map для коллекции "${u.collection}" (doc ${u.docId}) — отказ, чтобы не осиротить контент`)
    const doc = (await payload.findByID({
      collection: u.collection as never,
      id: u.docId as number,
      depth: 0,
      overrideAccess: true,
      context: { skipYandexCheck: true },
    })) as Record<string, unknown>
    const { patch, changed } = buildPatch(specs, doc, dup, canonical)
    if (changed) {
      if (VERSIONED.has(u.collection)) patch._status = doc._status ?? 'published'
      await payload.update({
        collection: u.collection as never,
        id: u.docId as number,
        data: patch as never,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      repointed++
    }
  }

  // Инвариант безопасности: после репойнта копия НЕ должна нигде использоваться.
  const after = await findMediaUsage(payload, dup)
  if (after.total !== 0) {
    throw new Error(`После репойнта #${dup} всё ещё используется (${after.total}) — удаление отменено`)
  }

  await payload.delete({
    collection: 'media',
    id: dup,
    overrideAccess: true,
    context: { forceDelete: true, skipYandexDelete: KEEP_REMOTE },
  })
  return repointed
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
        repointedDocs += await mergeDup(payload, dup, canonical, usage)
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
