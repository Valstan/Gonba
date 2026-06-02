-- Mirror of 20260602_120000.ts up() for direct psql apply.
-- Editable footer (PR4b): description + legal_address + nested link columns.
-- Idempotent & purely additive (no DROP) — safe to run on a DB where objects already exist.
BEGIN;

ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "description" varchar;
ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "legal_address" varchar;

CREATE TABLE IF NOT EXISTS "footer_columns" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "heading" varchar
);

CREATE TABLE IF NOT EXISTS "footer_columns_items" (
  "_order" integer NOT NULL,
  "_parent_id" varchar NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "label" varchar NOT NULL,
  "href" varchar NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_columns_parent_id_fk') THEN
    ALTER TABLE "footer_columns"
      ADD CONSTRAINT "footer_columns_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_columns_items_parent_id_fk') THEN
    ALTER TABLE "footer_columns_items"
      ADD CONSTRAINT "footer_columns_items_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_columns"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "footer_columns_order_idx" ON "footer_columns" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "footer_columns_parent_id_idx" ON "footer_columns" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "footer_columns_items_order_idx" ON "footer_columns_items" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "footer_columns_items_parent_id_idx" ON "footer_columns_items" USING btree ("_parent_id");

COMMIT;
