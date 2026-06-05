-- Mirror of 20260605_120000.ts up() for direct psql apply.
-- Idempotent: safe to run where columns already exist.
--
-- Индивидуальное оформление страниц проектов — поле decorMotif.
-- Хранится как varchar (push:true реконсилит в enum, как kind/homepage_group).
-- Нужно в обеих таблицах: projects + _projects_v (version_*) — иначе 500 при сохранении.
--
-- Применять:
--   psql -f web/src/migrations/20260605_120000.sql
--   + INSERT INTO payload_migrations (name, batch) VALUES ('20260605_120000', <batch+1>);

BEGIN;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "decor_motif" varchar DEFAULT 'auto';
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_decor_motif" varchar DEFAULT 'auto';

COMMIT;
