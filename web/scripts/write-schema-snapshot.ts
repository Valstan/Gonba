import 'dotenv/config'

import fs from 'fs'
import path from 'path'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Пересобрать drizzle-снапшот схемы против **актуального конфига** (лечение G192, шаг ②).
 *
 * Зачем: drizzle-kit считает миграцию как дифф против последнего `.json`-снапшота рядом с
 * миграциями, а НЕ против живой БД. У нас последний снапшот был от 2026-03-03, после него
 * 9 миграций → следующий `migrate:create` диффил бы против четырёхмесячной давности и выдал
 * бы неполный, но правдоподобно выглядящий файл (GOTCHAS G192, «третий, самый тихий вариант»).
 *
 * Почему не через `payload migrate:create`: он пишет снапшот только вместе с диффом, а дифф
 * против устаревшего снапшота — это ровно та мина (плюс он уходит в интерактивные вопросы
 * «enum создан или переименован?», в headless это висяк). Здесь берётся ровно тот же вызов,
 * что и внутри Payload (`generateDrizzleJson(adapter.schema)` — состояние **конфига**),
 * и пишется только `.json`. Пара `.ts`/`.sql` не создаётся: снапшот описывает состояние,
 * а не изменение. Payload индексирует в `index.ts` только `.ts`, одинокий `.json` его не смущает —
 * `buildCreateMigration` берёт `readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse()[0]`.
 *
 * ВАЖНО: снапшот описывает **конфиг**, а не прод. Перед пересборкой убедись, что расхождение
 * конфига с продом измерено и осознано: `corepack pnpm tsx scripts/probe-schema-drift.ts`
 * (см. `docs/PROJECT.md → Миграции: снапшот и сверка с продом`).
 *
 * Usage:
 *   corepack pnpm tsx scripts/write-schema-snapshot.ts [--name 20260728_120000]
 */

process.env.PAYLOAD_MIGRATING = 'true'

const main = async () => {
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as unknown as {
    migrationDir: string
    requireDrizzleKit: () => { generateDrizzleJson: (schema: unknown) => Promise<unknown> }
    schema: unknown
  }

  const nameFlagIndex = process.argv.indexOf('--name')
  const [yyyymmdd, hhmmss] = new Date().toISOString().split('T')
  const fallbackName = `${yyyymmdd.replace(/\D/g, '')}_${hhmmss.split('.')[0].replace(/\D/g, '')}`
  const name = nameFlagIndex !== -1 ? process.argv[nameFlagIndex + 1] : fallbackName

  const { generateDrizzleJson } = adapter.requireDrizzleKit()
  const snapshot = await generateDrizzleJson(adapter.schema)

  const dir = adapter.migrationDir
  const filePath = path.join(dir, `${name}.json`)
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2))

  const existing = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  console.log(`[write-schema-snapshot] записан ${filePath}`)
  console.log(`[write-schema-snapshot] снапшоты в каталоге (последний = база для диффа):`)
  existing.forEach((f) => console.log(`  ${f === `${name}.json` ? '→' : ' '} ${f}`))
  process.exit(0)
}

void main()
