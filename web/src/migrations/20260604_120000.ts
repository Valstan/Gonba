import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * FTS Phase 2 — расширение поиска на коллекции `pages` и `projects`.
 *
 * Плагин @payloadcms/plugin-search теперь синкает posts+pages+projects в
 * служебную таблицу `search`. Полиморфная связь `doc` живёт в `search_rels`,
 * куда нужны FK-колонки `pages_id` / `projects_id` — зеркально существующей
 * `posts_id` (тип integer, btree-индекс, FK ON DELETE cascade).
 *
 * push:true на проде не доезжает после `next build` (см. техдолг про миграции),
 * поэтому добавляем колонки явной миграцией. Всё идемпотентно
 * (ADD COLUMN/CREATE INDEX IF NOT EXISTS + guard на pg_constraint).
 *
 * Реиндекс существующих pages/projects (плагин синкает только при save) —
 * отдельный шаг ПОСЛЕ деплоя: `corepack pnpm tsx scripts/reindex-search.ts`.
 * Зеркало для psql — `20260604_120000.sql`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "search_rels" ADD COLUMN IF NOT EXISTS "pages_id" integer;
    ALTER TABLE "search_rels" ADD COLUMN IF NOT EXISTS "projects_id" integer;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'search_rels_pages_fk') THEN
        ALTER TABLE "search_rels"
          ADD CONSTRAINT "search_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'search_rels_projects_fk') THEN
        ALTER TABLE "search_rels"
          ADD CONSTRAINT "search_rels_projects_fk"
          FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "search_rels_pages_id_idx" ON "search_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "search_rels_projects_id_idx" ON "search_rels" USING btree ("projects_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "search_rels" DROP CONSTRAINT IF EXISTS "search_rels_pages_fk";
    ALTER TABLE "search_rels" DROP CONSTRAINT IF EXISTS "search_rels_projects_fk";
    DROP INDEX IF EXISTS "search_rels_pages_id_idx";
    DROP INDEX IF EXISTS "search_rels_projects_id_idx";
    ALTER TABLE "search_rels" DROP COLUMN IF EXISTS "pages_id";
    ALTER TABLE "search_rels" DROP COLUMN IF EXISTS "projects_id";
  `)
}
