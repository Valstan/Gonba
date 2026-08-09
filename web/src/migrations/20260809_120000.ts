import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Multi-project VK posts: keep the canonical project FK on posts and store
 * additional project relationships in Payload's polymorphic rels table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "vk_classification" jsonb;
    ALTER TABLE "posts_rels" ADD COLUMN IF NOT EXISTS "projects_id" integer;
    CREATE INDEX IF NOT EXISTS "posts_rels_projects_id_idx" ON "posts_rels" ("projects_id");
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_rels_projects_fk') THEN
        ALTER TABLE "posts_rels"
          ADD CONSTRAINT "posts_rels_projects_fk"
          FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts_rels" DROP CONSTRAINT IF EXISTS "posts_rels_projects_fk";
    DROP INDEX IF EXISTS "posts_rels_projects_id_idx";
    ALTER TABLE "posts_rels" DROP COLUMN IF EXISTS "projects_id";
    ALTER TABLE "posts" DROP COLUMN IF EXISTS "vk_classification";
  `)
}
