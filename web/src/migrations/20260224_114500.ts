import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'short_label'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "short_label" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'accent_color'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "accent_color" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'sort_order'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "sort_order" integer;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'logo_id'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "logo_id" integer;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'enabled_sections'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "enabled_sections" varchar[];
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'project_id'
      ) THEN
        ALTER TABLE "products" ADD COLUMN "project_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'short_label'
      ) THEN
        ALTER TABLE "projects" ALTER COLUMN "short_label" SET DEFAULT 'Проект';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'sort_order'
      ) THEN
        ALTER TABLE "projects" ALTER COLUMN "sort_order" SET DEFAULT 10;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'short_label'
      ) THEN
        UPDATE "projects" SET "short_label" = COALESCE("short_label", 'Проект') WHERE "short_label" IS NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'sort_order'
      ) THEN
        UPDATE "projects" SET "sort_order" = 10 WHERE "sort_order" IS NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'projects_logo_id_media_id_fk'
      ) THEN
        ALTER TABLE "projects"
          ADD CONSTRAINT "projects_logo_id_media_id_fk"
          FOREIGN KEY ("logo_id")
          REFERENCES "public"."media"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'products_project_id_projects_id_fk'
      ) THEN
        ALTER TABLE "products"
          ADD CONSTRAINT "products_project_id_projects_id_fk"
          FOREIGN KEY ("project_id")
          REFERENCES "public"."projects"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "projects_logo_idx" ON "projects" USING btree ("logo_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "products_project_id_idx" ON "products" USING btree ("project_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "projects_logo_idx";
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "products_project_id_idx";
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'projects_logo_id_media_id_fk'
      ) THEN
        ALTER TABLE "projects"
          DROP CONSTRAINT "projects_logo_id_media_id_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'products_project_id_projects_id_fk'
      ) THEN
        ALTER TABLE "products"
          DROP CONSTRAINT "products_project_id_projects_id_fk";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "short_label";
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "accent_color";
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "sort_order";
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "logo_id";
  `)

  await db.execute(sql`
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "enabled_sections";
  `)

  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "project_id";
  `)
}
