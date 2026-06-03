import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Чистка мёртвого `footer.navItems`.
 *
 * `navItems` — плоский список ссылок из стартового шаблона Payload. Подвал его
 * НЕ рендерит (структура переехала в `footer_columns` → `footer_columns_items`,
 * миграция 20260602_120000), а поле висело скрытым в схеме лишь чтобы прежняя
 * миграция оставалась чисто аддитивной. Теперь поле убрано из конфига, поэтому
 * сносим его таблицы.
 *
 * Вместе с `footer_nav_items` уходит и `footer_rels`: единственным relationship-
 * полем footer-глобала был `navItems[].link.reference` (`columns` используют
 * plain text `href`). Без navItems у footer не остаётся relationship-полей, и
 * drizzle `push:true` сам бы захотел дропнуть `footer_rels` — делаем это явно,
 * чтобы DB совпала с новой схемой и push не выдал интерактивный y/N на проде.
 *
 * Enum `enum_footer_nav_items_link_type` (values: reference, custom) использовался
 * только `footer_nav_items.link_type` → дропаем тоже.
 *
 * DDL `down` восстанавливает структуры из реального снимка схемы (push-inspect,
 * pool #017): таблицы пустые — это и есть точный обратный шаг (поле navItems,
 * добавленное заново, стартует пустым). CASCADE в `up` сам убирает FK и индексы.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "footer_nav_items" CASCADE;
    DROP TABLE IF EXISTS "footer_rels" CASCADE;
    DROP TYPE IF EXISTS "enum_footer_nav_items_link_type";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_footer_nav_items_link_type') THEN
        CREATE TYPE "enum_footer_nav_items_link_type" AS ENUM('reference', 'custom');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "footer_nav_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_nav_items_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar
    );
    CREATE TABLE IF NOT EXISTS "footer_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer,
      "projects_id" integer,
      "events_id" integer,
      "services_id" integer,
      "products_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_nav_items_parent_id_fk') THEN
        ALTER TABLE "footer_nav_items"
          ADD CONSTRAINT "footer_nav_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_parent_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_pages_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_posts_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_projects_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_projects_fk"
          FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_events_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_events_fk"
          FOREIGN KEY ("events_id") REFERENCES "public"."events"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_services_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_services_fk"
          FOREIGN KEY ("services_id") REFERENCES "public"."services"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_products_fk') THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_products_fk"
          FOREIGN KEY ("products_id") REFERENCES "public"."products"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "footer_nav_items_order_idx" ON "footer_nav_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_nav_items_parent_id_idx" ON "footer_nav_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_order_idx" ON "footer_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "footer_rels_parent_idx" ON "footer_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_path_idx" ON "footer_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "footer_rels_pages_id_idx" ON "footer_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_posts_id_idx" ON "footer_rels" USING btree ("posts_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_projects_id_idx" ON "footer_rels" USING btree ("projects_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_events_id_idx" ON "footer_rels" USING btree ("events_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_services_id_idx" ON "footer_rels" USING btree ("services_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_products_id_idx" ON "footer_rels" USING btree ("products_id");
  `)
}
