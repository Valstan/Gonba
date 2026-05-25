import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Этно-модерн редизайн PR2 §2 — schema Project под этно-модерн.
 *
 * Добавляет 6 колонок в "projects":
 * - homepage_group  — 'stay' | 'do' | 'see' | 'shop' | NULL (этно-карточка на главной)
 * - is_hero_of_homepage — флаг hero на главной
 * - is_featured     — флаг попадания в FeaturedChapter
 * - excerpt         — выжимка под заголовком (varchar 160)
 * - chapter_roman   — 'I' | 'II' | 'III' | 'IV' | 'V' | NULL (маркер главы)
 * - kind            — 'project' (default) | 'person' | 'studio' | 'workshop' | 'event' | 'shop'
 *
 * Все ADD COLUMN IF NOT EXISTS — миграция идемпотентна. Зеркало — `20260525_080000.sql`.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "homepage_group" varchar;
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_hero_of_homepage" boolean DEFAULT false;
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "excerpt" varchar;
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "chapter_roman" varchar;
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "kind" varchar DEFAULT 'project';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "kind";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "chapter_roman";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "excerpt";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "is_featured";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "is_hero_of_homepage";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "homepage_group";
  `)
}
