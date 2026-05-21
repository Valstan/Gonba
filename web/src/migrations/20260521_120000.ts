import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "home_link" varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_name" varchar;
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_description" varchar;
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "community_avatar" varchar;
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "screen_name" varchar;
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "project_id" integer;
    ALTER TABLE "vk_auto_sync" ADD COLUMN IF NOT EXISTS "category_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "vk_auto_sync" ALTER COLUMN "group_id" DROP NOT NULL;
    ALTER TABLE "vk_auto_sync" ALTER COLUMN "access_token" DROP NOT NULL;
  `)

  await db.execute(sql`
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
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "vk_auto_sync_project_idx"
      ON "vk_auto_sync" USING btree ("project_id");
    CREATE INDEX IF NOT EXISTS "vk_auto_sync_category_idx"
      ON "vk_auto_sync" USING btree ("category_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "vk_auto_sync_project_idx";
    DROP INDEX IF EXISTS "vk_auto_sync_category_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "vk_auto_sync" DROP CONSTRAINT IF EXISTS "vk_auto_sync_project_id_projects_id_fk";
    ALTER TABLE "vk_auto_sync" DROP CONSTRAINT IF EXISTS "vk_auto_sync_category_id_categories_id_fk";
  `)

  await db.execute(sql`
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "category_id";
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "project_id";
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "screen_name";
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "community_avatar";
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "community_description";
    ALTER TABLE "vk_auto_sync" DROP COLUMN IF EXISTS "community_name";
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "home_link";
  `)
}
