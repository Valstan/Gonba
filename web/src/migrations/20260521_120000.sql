-- Mirror of 20260521_120000.ts up() for direct psql apply.
-- Idempotent: safe to run on a database where columns/constraints already exist.
BEGIN;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "home_link" varchar;

ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_name" varchar;
ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_description" varchar;
ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_avatar" varchar;
ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "screen_name" varchar;
ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "project_id" integer;
ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "category_id" integer;

ALTER TABLE "vk_auto_sync" ALTER COLUMN "group_id" DROP NOT NULL;
ALTER TABLE "vk_auto_sync" ALTER COLUMN "access_token" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vk_auto_sync_project_id_projects_id_fk'
  ) THEN
    ALTER TABLE "vk_auto_sync"
      ADD CONSTRAINT "vk_auto_sync_project_id_projects_id_fk"
      FOREIGN KEY ("project_id")
      REFERENCES "public"."projects"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vk_auto_sync_category_id_categories_id_fk'
  ) THEN
    ALTER TABLE "vk_auto_sync"
      ADD CONSTRAINT "vk_auto_sync_category_id_categories_id_fk"
      FOREIGN KEY ("category_id")
      REFERENCES "public"."categories"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "vk_auto_sync_project_idx"
  ON "vk_auto_sync" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "vk_auto_sync_category_idx"
  ON "vk_auto_sync" USING btree ("category_id");

COMMIT;
