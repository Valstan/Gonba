import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload 3.90: колонка троттлинга forgot-password (`reset_password_requested_at`).
 *
 * Нужна ВСЕМ коллекциям с `auth: true` — даже без секции `forgotPassword` в
 * конфиге: дефолт `minRequestInterval ?? 15000` ставится до гейта, и без колонки
 * падает первое обращение к auth-коллекции (G388). У нас `Users` — plain
 * `auth: true`, то есть ровно этот случай.
 *
 * Правка чисто аддитивная (один nullable столбец без DEFAULT): старый код о ней
 * не знает и продолжает работать — порядок «сначала БД, потом деплой» безопасен.
 *
 * Накатывается на прод ВРУЧНУЮ до мержа — `payload migrate` в headless виснет на
 * drizzle y/N, и гейт деплоя падает на любой новой миграции (см.
 * `.github/workflows/deploy-prod.yml` → «Safety net»). Готовый файл для этого —
 * `20260930_120000_payload_390_auth_throttle.sql` рядом.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_requested_at";`)
}
