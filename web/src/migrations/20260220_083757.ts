import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_carousel" (
      "id" serial PRIMARY KEY NOT NULL,
      "center_title" varchar DEFAULT 'Олени',
      "center_link" varchar DEFAULT '/deer',
      "center_image_id" integer,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "home_carousel_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "link" varchar NOT NULL,
      "image_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_carousel_center_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "home_carousel"
          ADD CONSTRAINT "home_carousel_center_image_id_media_id_fk"
          FOREIGN KEY ("center_image_id")
          REFERENCES "public"."media"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_carousel_items_parent_id_fk'
      ) THEN
        ALTER TABLE "home_carousel_items"
          ADD CONSTRAINT "home_carousel_items_parent_id_fk"
          FOREIGN KEY ("_parent_id")
          REFERENCES "public"."home_carousel"("id")
          ON DELETE cascade
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_carousel_items_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "home_carousel_items"
          ADD CONSTRAINT "home_carousel_items_image_id_media_id_fk"
          FOREIGN KEY ("image_id")
          REFERENCES "public"."media"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "home_carousel"
      ALTER COLUMN "center_title" SET DEFAULT 'Олени';
    ALTER TABLE "home_carousel"
      ALTER COLUMN "center_link" SET DEFAULT '/deer';
    UPDATE "home_carousel"
      SET
        "center_title" = COALESCE("center_title", 'Олени'),
        "center_link" = COALESCE("center_link", '/deer')
      WHERE "center_title" IS NULL OR "center_link" IS NULL;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "home_carousel_center_center_image_idx"
      ON "home_carousel" USING btree ("center_image_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "home_carousel_items_order_idx"
      ON "home_carousel_items" USING btree ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "home_carousel_items_parent_id_idx"
      ON "home_carousel_items" USING btree ("_parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "home_carousel_items_image_idx"
      ON "home_carousel_items" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "home_carousel_items" CASCADE;
    DROP TABLE IF EXISTS "home_carousel" CASCADE;
  `)
}
