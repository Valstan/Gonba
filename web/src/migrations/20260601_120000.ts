import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fix дрейфа схемы версий: 20260525_080000 добавила 6 полей в "projects",
 * но НЕ в зеркальную таблицу версий "_projects_v" (drafts). Из-за этого
 * сохранение проекта (пишет версию) и list/edit-view админки падали с
 * `errorMissingColumn` (HTTP 500). Здесь добавляем недостающие version_*-колонки.
 *
 * На проде уже применено вручную (ALTER) 2026-06-01; миграция фиксирует это в
 * репо для пересборок с нуля. Все ADD COLUMN IF NOT EXISTS — идемпотентно.
 * Зеркало — `20260601_120000.sql`.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_kind" varchar DEFAULT 'project';
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_homepage_group" varchar;
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_excerpt" varchar;
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_chapter_roman" varchar;
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_is_hero_of_homepage" boolean DEFAULT false;
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_is_featured" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_kind";
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_homepage_group";
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_excerpt";
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_chapter_roman";
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_is_hero_of_homepage";
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_is_featured";
  `)
}
