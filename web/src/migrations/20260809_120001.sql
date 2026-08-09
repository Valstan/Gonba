-- FTS Phase 3: apply only after the prod DDL confirmation gate.
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
