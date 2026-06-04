-- Mirror of 20260604_120000.ts up() for direct psql apply.
-- FTS Phase 2: search_rels gets pages_id/projects_id FK columns (mirror of posts_id).
-- Idempotent & purely additive — safe to run where objects already exist.
BEGIN;

ALTER TABLE "search_rels" ADD COLUMN IF NOT EXISTS "pages_id" integer;
ALTER TABLE "search_rels" ADD COLUMN IF NOT EXISTS "projects_id" integer;

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

CREATE INDEX IF NOT EXISTS "search_rels_pages_id_idx" ON "search_rels" USING btree ("pages_id");
CREATE INDEX IF NOT EXISTS "search_rels_projects_id_idx" ON "search_rels" USING btree ("projects_id");

COMMIT;
