-- Multi-project VK posts: canonical project remains posts.project_id;
-- additional relationships live in Payload's polymorphic posts_rels table.
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
