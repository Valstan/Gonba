import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * FTS Phase 3. Requires the production DDL confirmation gate because the
 * extension is a database-level change. Both indexes are additive and match
 * the expressions used by the public search route exactly.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS "search_fts_expr_gin"
      ON "search" USING gin ((
        setweight(to_tsvector('russian', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('russian', coalesce("meta_title", '')), 'B') ||
        setweight(to_tsvector('russian', coalesce("meta_description", '')), 'C')
      ));
    CREATE INDEX IF NOT EXISTS "search_title_meta_trgm_gin"
      ON "search" USING gin ((lower(
        coalesce("title", '') || ' ' ||
        coalesce("meta_title", '') || ' ' ||
        coalesce("meta_description", '')
      )) gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "search_fts_expr_gin";
    DROP INDEX IF EXISTS "search_title_meta_trgm_gin";
  `)
}

