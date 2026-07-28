import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Сверка «схема из конфига ↔ схема в БД» — read-only, ничего не применяет (G192/G194-родня).
 *
 * Зачем: у нас **push-first гибрид** — в `payload_migrations` есть строка `dev` (batch -1),
 * то есть часть схемы приехала не миграцией, а `pushDevSchema` (см. GOTCHAS G192, поправка
 * Сабантуя 2026-07-28). Для таких проектов «прогнать up() на чистой БД» невыполнимо:
 * цепочка миграций не самодостаточна. Единственная честная проверка — **сверка с продом**.
 *
 * Как работает: берёт drizzle-схему, построенную Payload из конфига, и спрашивает
 * drizzle-kit `pushSchema()`, какие DDL-стейтменты понадобились бы, чтобы привести
 * подключённую БД к этой схеме. `apply()` НЕ вызывается. Стейтменты делятся на три класса:
 *   - ШУМ: `ALTER COLUMN … SET DEFAULT` — drizzle-kit 0.28 эмитит их даже когда дефолт
 *     уже стоит (замер 2026-07-28: одинаковые 15 штук и против прод-копии, и против
 *     dev-БД, которую push держит ≡ конфигу; `information_schema` подтверждает, что
 *     дефолты на месте). Не дрейф — печатаются отдельно, на exit code не влияют.
 *   - ОСОЗНАННЫЙ ДРЕЙФ (allowlist ниже): 3 FK `submission_*` → CASCADE вместо
 *     drizzle-дефолта SET NULL — анти-G135 из миграции `20260710_120000` (SET NULL на
 *     NOT NULL-колонке = мина PG 23502). Payload-конфиг onDelete у relationship не
 *     выражает, поэтому конфиг всегда будет хотеть их «починить» — не давать.
 *   - ВСЁ ОСТАЛЬНОЕ → настоящий дрейф, exit 1.
 *
 * ВАЖНО: направлять на **копию** прод-схемы, не на сам прод. Штатный рецепт:
 *   ssh GONBA "sudo -u postgres pg_dump -s gonba" > /tmp/prod-schema.sql
 *   createdb gonba_probe && psql -d gonba_probe -f /tmp/prod-schema.sql
 *   DATABASE_URL=postgres://…/gonba_probe corepack pnpm tsx scripts/probe-schema-drift.ts
 *
 * `PAYLOAD_MIGRATING=true` выставляется скриптом сам — он глушит авто-push на connect
 * (`db-postgres/connect.js`), иначе Payload молча привёл бы probe-БД к конфигу до замера.
 *
 * Exit code: 0 — дрейфа нет; 1 — есть (пригодно как гейт в CI).
 *
 * Usage:
 *   corepack pnpm tsx scripts/probe-schema-drift.ts
 */

process.env.PAYLOAD_MIGRATING = 'true'

/** drizzle-kit переспрашивает уже стоящие дефолты — не дрейф (см. шапку). */
const isNoise = (s: string) => /^ALTER TABLE "[^"]+" ALTER COLUMN "[^"]+" SET DEFAULT /.test(s)

/**
 * Осознанные расхождения конфиг↔прод, которые конфиг выразить не может.
 * Каждый паттерн — точное совпадение стейтмента (без вариаций → при смене формулировки
 * drizzle-kit гейт честно покраснеет, и allowlist придётся пересмотреть глазами).
 */
const KNOWN_INTENTIONAL: RegExp[] = [
  // 3 FK submission_* держим CASCADE (анти-G135, миграция 20260710_120000):
  // конфиг хочет их снести и пересоздать SET NULL'ом — не даём.
  /^ALTER TABLE "submission_(views|reactions|comments)" DROP CONSTRAINT "submission_(views|reactions|comments)_submission_id_submissions_id_fk";$/,
  /^ALTER TABLE "submission_(views|reactions|comments)" ADD CONSTRAINT "submission_(views|reactions|comments)_submission_id_submissions_id_fk" FOREIGN KEY \("submission_id"\) REFERENCES "public"\."submissions"\("id"\) ON DELETE set null ON UPDATE no action;$/,
]

const isKnownIntentional = (s: string) => KNOWN_INTENTIONAL.some((re) => re.test(s.trim()))

const main = async () => {
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as unknown as {
    drizzle: unknown
    extensions?: Record<string, boolean>
    requireDrizzleKit: () => {
      pushSchema: (
        schema: unknown,
        db: unknown,
        schemaFilters?: string[],
        tablesFilter?: string[],
        extensionsFilters?: string[],
      ) => Promise<{
        hasDataLoss: boolean
        statementsToExecute: string[]
        warnings: string[]
      }>
    }
    schema: unknown
    schemaName?: string
    tablesFilter?: string[]
  }

  const dbName = (process.env.DATABASE_URL || '').split('/').pop()?.split('?')[0] ?? '(unknown)'
  console.log(`[probe-schema-drift] БД: ${dbName}`)

  const { pushSchema } = adapter.requireDrizzleKit()
  const { hasDataLoss, statementsToExecute, warnings } = await pushSchema(
    adapter.schema,
    adapter.drizzle,
    adapter.schemaName ? [adapter.schemaName] : undefined,
    adapter.tablesFilter,
    adapter.extensions?.postgis ? ['postgis'] : undefined,
  )

  const noise = statementsToExecute.filter(isNoise)
  const intentional = statementsToExecute.filter((s) => !isNoise(s) && isKnownIntentional(s))
  const real = statementsToExecute.filter((s) => !isNoise(s) && !isKnownIntentional(s))

  if (noise.length) {
    console.log(`[probe-schema-drift] шум drizzle-kit (SET DEFAULT, уже стоят): ${noise.length} — игнорирую`)
  }
  if (intentional.length) {
    console.log(`[probe-schema-drift] осознанный дрейф (allowlist, анти-G135 CASCADE): ${intentional.length} — ок`)
    intentional.forEach((s) => console.log(`    · ${s}`))
  }

  if (!real.length) {
    console.log('[probe-schema-drift] ✅ настоящего дрейфа нет: конфиг ≡ схема БД')
    process.exit(0)
  }

  console.log(`\n[probe-schema-drift] ⚠️ НАСТОЯЩИЙ дрейф: ${real.length} стейтмент(ов)\n`)
  real.forEach((s, i) => console.log(`${String(i + 1).padStart(3)}. ${s}`))
  if (warnings.length) {
    console.log(`\n[probe-schema-drift] warnings (${warnings.length}):`)
    warnings.forEach((w) => console.log(`  - ${w}`))
  }
  if (hasDataLoss) {
    console.log('\n[probe-schema-drift] ⛔ DATA LOSS: применение этих стейтментов потеряло бы данные')
  }
  process.exit(1)
}

void main()
