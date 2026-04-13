import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_media_block_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "media_id" integer,
      "caption" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_media_block_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "media_id" integer,
      "caption" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_media_block_items_media_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_media_block_items"
          ADD CONSTRAINT "pages_blocks_media_block_items_media_id_media_id_fk"
          FOREIGN KEY ("media_id")
          REFERENCES "public"."media"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_media_block_items_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_media_block_items"
          ADD CONSTRAINT "pages_blocks_media_block_items_parent_id_fk"
          FOREIGN KEY ("_parent_id")
          REFERENCES "public"."pages_blocks_media_block"("id")
          ON DELETE cascade
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_pages_v_blocks_media_block_items_media_id_media_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_media_block_items"
          ADD CONSTRAINT "_pages_v_blocks_media_block_items_media_id_media_id_fk"
          FOREIGN KEY ("media_id")
          REFERENCES "public"."media"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_pages_v_blocks_media_block_items_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_media_block_items"
          ADD CONSTRAINT "_pages_v_blocks_media_block_items_parent_id_fk"
          FOREIGN KEY ("_parent_id")
          REFERENCES "public"."_pages_v_blocks_media_block"("id")
          ON DELETE cascade
          ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_block_items_order_idx"
      ON "pages_blocks_media_block_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_block_items_parent_id_idx"
      ON "pages_blocks_media_block_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_media_block_items_media_idx"
      ON "pages_blocks_media_block_items" USING btree ("media_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_media_block_items_order_idx"
      ON "_pages_v_blocks_media_block_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_media_block_items_parent_id_idx"
      ON "_pages_v_blocks_media_block_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_media_block_items_media_idx"
      ON "_pages_v_blocks_media_block_items" USING btree ("media_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "pages_blocks_media_block_items" CASCADE;
    DROP TABLE IF EXISTS "_pages_v_blocks_media_block_items" CASCADE;
  `)
}
