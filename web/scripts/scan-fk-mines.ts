import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { classifyFkMines, type AllowEntry, type FkMine } from '../src/utilities/classifyFkMines'

import allowlist from './fk-mines-allowlist.json'

/**
 * Гейт FK-мин G135: ищет в схеме БД пары «NOT NULL + ON DELETE SET NULL».
 *
 * Зачем. Payload 3 / drizzle на relationship с `required: true` генерит колонку
 * NOT NULL и FK с действием SET NULL — то есть жёсткое удаление родителя
 * (Project / Product / Form / Media из /admin) падает `PG 23502`, как только у
 * него есть дочерняя строка. Мина не всплывает при создании: CREATE проходит,
 * приложение живёт; ловится она в момент удаления, то есть на бою.
 *
 * Почему гейтом, а не списком в backlog. Пункт техдолга фиксировал число мин
 * текстом; за время, пока он лежал, счёт сам вырос 6 → 9 (re-триаж 18.09
 * насчитал девять). Значит фиксировать число в prose бесполезно — новая
 * коллекция с `required: true` relationship добавит десятую молча. Правило:
 *   - известные мины — в allowlist (см. fk-mines-allowlist.json, у каждой своя
 *     причина и статус лечения; все ждут прод-DDL — человеческий гейт #025);
 *   - НОВАЯ мина (есть в БД, нет в allowlist) → exit 1. Красный PR = сигнал:
 *     либо лечим моделью (nullable / RESTRICT / CASCADE миграцией), либо
 *     осознанно дописываем в allowlist строкой с обоснованием — на виду в диффе;
 *   - мина из allowlist исчезла → информационно (её вылечили), exit не меняет.
 *
 * Гейт проверяет свойство («такая пара в схеме есть?»), а не состав файлов
 * (класс #228 — гейт, который не исполняет то, что охраняет).
 *
 * Где считается: любая БД по DATABASE_URL. В CI — та, что поднимает job
 * (схему туда кладёт push из модели; см. шаг в ci.yml ПОСЛЕ Integration tests).
 * Против прод-копии: DATABASE_URL=… npx tsx scripts/scan-fk-mines.ts.
 *
 * `PAYLOAD_MIGRATING=true` выставляет скрипт сам — на connect авто-push выключен
 * (мы только читаем information_schema).
 *
 * Exit code: 0 — мин ровно столько, сколько в allowlist; 1 — есть новые.
 */

process.env.PAYLOAD_MIGRATING = 'true'

const FK_MINES_SQL = `
  SELECT tc.table_name AS table_name,
         kcu.column_name AS column_name,
         ccu.table_name AS ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
  JOIN information_schema.columns col
    ON col.table_schema = kcu.table_schema
   AND col.table_name = kcu.table_name
   AND col.column_name = kcu.column_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND rc.delete_rule = 'SET NULL'
    AND col.is_nullable = 'NO'
  ORDER BY tc.table_name, kcu.column_name;
`

type Row = { table_name: string; column_name: string; ref_table: string }

const main = async () => {
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as unknown as {
    drizzle: { $client: { query: (sql: string) => Promise<{ rows: Row[] }> } }
  }

  const dbName = (process.env.DATABASE_URL || '').split('/').pop()?.split('?')[0] ?? '(unknown)'
  console.log(`[fk-mines] БД: ${dbName}`)

  const { rows } = await adapter.drizzle.$client.query(FK_MINES_SQL)
  const found: FkMine[] = rows.map((r) => ({
    id: `${r.table_name}.${r.column_name}`,
    table: r.table_name,
    column: r.column_name,
    refTable: r.ref_table,
  }))

  const { known, fresh, healed } = classifyFkMines(found, allowlist as readonly AllowEntry[])

  console.log(`[fk-mines] в схеме: ${found.length}; в allowlist: ${allowlist.length}`)
  if (known.length) {
    console.log(`[fk-mines] известные мины (${known.length}) — ждут прод-DDL (#025):`)
    known.forEach((m) => {
      const note = (allowlist as readonly AllowEntry[]).find((a) => a.id === m.id)?.note
      console.log(`    · ${m.id} -> ${m.refTable}${note ? ` — ${note}` : ''}`)
    })
  }
  if (healed.length) {
    console.log(`[fk-mines] вылеченные (есть в allowlist, в схеме уже нет): ${healed.map((h) => h.id).join(', ')}`)
  }

  if (fresh.length) {
    console.log(`\n[fk-mines] ⛔ НОВАЯ FK-мина (NOT NULL + ON DELETE SET NULL): ${fresh.length}`)
    fresh.forEach((m) => console.log(`    + ${m.id} -> ${m.refTable}`))
    console.log('\nУдаление родителя упадёт PG 23502, пока у него есть дочерние строки.')
    console.log('Варианты: (1) осмысленное лечение — nullable, RESTRICT или CASCADE миграцией;')
    console.log('(2) осознанный допуск — строка в web/scripts/fk-mines-allowlist.json с обоснованием.')
    process.exit(1)
  }

  console.log('[fk-mines] ✅ новых мин нет: состав схемы совпадает с allowlist')
  process.exit(0)
}

void main()
