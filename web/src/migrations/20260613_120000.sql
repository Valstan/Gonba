-- Mirror of 20260613_120000.ts up() for direct psql apply.
-- Drawer → Payload: header_drawer_items (массив бокового меню) + drawer_contacts_* (группа).
-- Idempotent & purely additive (no DROP) — safe to run on a DB where objects already exist.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_header_drawer_items_section') THEN
    CREATE TYPE "public"."enum_header_drawer_items_section" AS ENUM('stay', 'do', 'see', 'shop', 'extra');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_header_drawer_items_link_type') THEN
    CREATE TYPE "public"."enum_header_drawer_items_link_type" AS ENUM('reference', 'custom');
  END IF;
END $$;

ALTER TABLE "header" ADD COLUMN IF NOT EXISTS "drawer_contacts_heading" varchar;
ALTER TABLE "header" ADD COLUMN IF NOT EXISTS "drawer_contacts_body" varchar;

CREATE TABLE IF NOT EXISTS "header_drawer_items" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "section" "enum_header_drawer_items_section" DEFAULT 'do' NOT NULL,
  "link_type" "enum_header_drawer_items_link_type" DEFAULT 'reference',
  "link_new_tab" boolean,
  "link_url" varchar,
  "link_label" varchar NOT NULL,
  "subtitle" varchar
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'header_drawer_items_parent_id_fk') THEN
    ALTER TABLE "header_drawer_items"
      ADD CONSTRAINT "header_drawer_items_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "header_drawer_items_order_idx" ON "header_drawer_items" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "header_drawer_items_parent_id_idx" ON "header_drawer_items" USING btree ("_parent_id");

COMMIT;
