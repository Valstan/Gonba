import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Editable footer (PR4b): глобал `footer` получает поля `description`,
 * `legal_address` и вложенный массив колонок ссылок (`footer_columns` →
 * `footer_columns_items`). Чисто аддитивная миграция — существующие таблицы
 * (`footer`, `footer_nav_items`, `footer_rels`) не трогаем; `navItems` остаётся
 * в конфиге скрытым, чтобы не было DROP на проде.
 *
 * DDL воспроизводит конвенцию Payload/drizzle для массивов (см. header_nav_items
 * — top-level array под global; pages_blocks_faq_items — вложенный массив с
 * varchar _parent_id). Идемпотентно: IF NOT EXISTS + DO$$-guard'ы для FK.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "description" varchar;
    ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "legal_address" varchar;
  `)

  await db.execute(sql`
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
  `)

  await db.execute(sql`
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
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "footer_columns_order_idx" ON "footer_columns" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_columns_parent_id_idx" ON "footer_columns" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "footer_columns_items_order_idx" ON "footer_columns_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_columns_items_parent_id_idx" ON "footer_columns_items" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "footer_columns_items" CASCADE;
    DROP TABLE IF EXISTS "footer_columns" CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "footer" DROP COLUMN IF EXISTS "legal_address";
    ALTER TABLE "footer" DROP COLUMN IF EXISTS "description";
  `)
}
