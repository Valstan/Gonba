-- Mirror of 20260525_080000.ts up() for direct psql apply.
-- Idempotent: safe to run on a database where columns already exist.
--
-- Этно-модерн редизайн PR2 §2 — schema Project под этно-модерн.
-- Применять на проде через:
--   psql -f web/src/migrations/20260525_080000.sql
--   + ручной INSERT INTO payload_migrations (name, batch) VALUES ('20260525_080000', <batch+1>);

BEGIN;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "homepage_group" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_hero_of_homepage" boolean DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "excerpt" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "chapter_roman" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "kind" varchar DEFAULT 'project';

COMMIT;
