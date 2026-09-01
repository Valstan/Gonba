import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Глобал «Правила редакции (VK-классификатор)» — `vkEditorialRules`.
 *
 * Правка чисто аддитивная: две новые таблицы (сам глобал и его версии) и два
 * новых енума. Существующих таблиц, колонок и связей не касается, поэтому
 * порядок «сначала БД, потом деплой» безопасен: старый код о новых таблицах не
 * знает и продолжает работать.
 *
 * Накатывается на прод ВРУЧНУЮ до мержа — `payload migrate` в CI зависает на
 * drizzle y/N, и гейт деплоя падает на любой новой миграции (см.
 * `.github/workflows/deploy-prod.yml` → «Safety net»). Готовый файл для этого —
 * `20260901_131253_vk_editorial_rules.sql` рядом; он сверен с этой миграцией
 * прогоном на копии прод-схемы (колонки, типы, умолчания и индексы совпали).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_vk_editorial_rules_no_text_policy" AS ENUM('manual', 'source', 'skip');
  CREATE TYPE "public"."enum__vk_editorial_rules_v_version_no_text_policy" AS ENUM('manual', 'source', 'skip');
  CREATE TABLE "vk_editorial_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"rules" varchar,
  	"no_text_policy" "enum_vk_editorial_rules_no_text_policy" DEFAULT 'manual',
  	"min_text_length" numeric DEFAULT 40,
  	"change_note" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_vk_editorial_rules_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_rules" varchar,
  	"version_no_text_policy" "enum__vk_editorial_rules_v_version_no_text_policy" DEFAULT 'manual',
  	"version_min_text_length" numeric DEFAULT 40,
  	"version_change_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE INDEX "_vk_editorial_rules_v_created_at_idx" ON "_vk_editorial_rules_v" USING btree ("created_at");
  CREATE INDEX "_vk_editorial_rules_v_updated_at_idx" ON "_vk_editorial_rules_v" USING btree ("updated_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "vk_editorial_rules" CASCADE;
  DROP TABLE "_vk_editorial_rules_v" CASCADE;
  DROP TYPE "public"."enum_vk_editorial_rules_no_text_policy";
  DROP TYPE "public"."enum__vk_editorial_rules_v_version_no_text_policy";`)
}
