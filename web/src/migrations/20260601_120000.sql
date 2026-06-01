-- Mirror of 20260601_120000.ts up() for direct psql apply.
-- Idempotent: safe to run where columns already exist.
--
-- Fix дрейфа схемы версий: добавляет version_*-колонки в "_projects_v",
-- которые 20260525_080000 забыла создать (добавила только в "projects").
-- Симптом: HTTP 500 (errorMissingColumn) при сохранении проекта и в админ-list.
--
-- Применять:
--   psql -f web/src/migrations/20260601_120000.sql
--   + INSERT INTO payload_migrations (name, batch) VALUES ('20260601_120000', <batch+1>);

BEGIN;

ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_kind" varchar DEFAULT 'project';
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_homepage_group" varchar;
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_excerpt" varchar;
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_chapter_roman" varchar;
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_is_hero_of_homepage" boolean DEFAULT false;
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_is_featured" boolean DEFAULT false;

COMMIT;
