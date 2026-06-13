import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drawer → Payload: глобал `header` получает (а) массив `header_drawer_items`
 * (боковое меню бургера: секция + ссылка link() + подпись) и (б) inline-группу
 * `drawer_contacts_*`. Раньше боковое меню было хардкодом в EthnoDrawer.client.tsx.
 *
 * Чисто аддитивная миграция. DDL зеркалит конвенцию Payload/drizzle для массива
 * с link()-полем (ровно как существующий `header_nav_items`: link_type-enum,
 * link_new_tab/link_url/link_label). Reference-ссылки drawer'а ложатся в уже
 * существующий `header_rels` (полиморфные pages_id/posts_id/projects_id/...
 * уже есть от navItems, новый только `path`) → менять `header_rels` не нужно.
 * Идемпотентно: IF NOT EXISTS + DO$$-guard'ы для enum/FK.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Enum-типы (Postgres не умеет CREATE TYPE IF NOT EXISTS → guard).
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_header_drawer_items_section') THEN
        CREATE TYPE "public"."enum_header_drawer_items_section" AS ENUM('stay', 'do', 'see', 'shop', 'extra');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_header_drawer_items_link_type') THEN
        CREATE TYPE "public"."enum_header_drawer_items_link_type" AS ENUM('reference', 'custom');
      END IF;
    END $$;
  `)

  // 2) Inline-группа контактов на самом header.
  await db.execute(sql`
    ALTER TABLE "header" ADD COLUMN IF NOT EXISTS "drawer_contacts_heading" varchar;
    ALTER TABLE "header" ADD COLUMN IF NOT EXISTS "drawer_contacts_body" varchar;
  `)

  // 3) Массив пунктов бокового меню (зеркало header_nav_items + section + subtitle).
  await db.execute(sql`
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
  `)

  // 4) FK на header(id).
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'header_drawer_items_parent_id_fk') THEN
        ALTER TABLE "header_drawer_items"
          ADD CONSTRAINT "header_drawer_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  // 5) Индексы (_order / _parent_id) — как у header_nav_items.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "header_drawer_items_order_idx" ON "header_drawer_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "header_drawer_items_parent_id_idx" ON "header_drawer_items" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reference-строки drawer'а в header_rels (если были) чистим по path.
  await db.execute(sql`DELETE FROM "header_rels" WHERE "path" LIKE 'drawerItems%';`)

  await db.execute(sql`DROP TABLE IF EXISTS "header_drawer_items" CASCADE;`)

  await db.execute(sql`
    ALTER TABLE "header" DROP COLUMN IF EXISTS "drawer_contacts_body";
    ALTER TABLE "header" DROP COLUMN IF EXISTS "drawer_contacts_heading";
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_header_drawer_items_link_type";
    DROP TYPE IF EXISTS "public"."enum_header_drawer_items_section";
  `)
}
