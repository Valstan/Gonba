import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Народная лента» (UGC, этап 1 docs/plans/sabantuy-borrowings.md): таблицы
 * submissions (+ массив submissions_media), submission_comments,
 * submission_reactions, submission_views, content_reports.
 *
 * DDL зеркалит то, что drizzle push создал на локальной dev-БД, с ОДНИМ
 * осознанным отличием: FK submission_id в comments/reactions/views —
 * `ON DELETE CASCADE`, а не drizzle-дефолт `SET NULL`. `SET NULL` на NOT NULL
 * колонке — мина G135 (жёсткое удаление публикации из /admin падало бы PG 23502);
 * дочерние строки без публикации смысла не имеют → каскад корректен (агрегаты-
 * счётчики живут на самой публикации и умирают вместе с ней). Dev-push каскад
 * НЕ откатывает (drizzle не сравнивает action существующего FK — G135).
 *
 * Чисто аддитивная, идемпотентная (IF NOT EXISTS + DO$$-guard'ы для enum).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Enum-типы (Postgres не умеет CREATE TYPE IF NOT EXISTS → guard).
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_submissions_kind') THEN
        CREATE TYPE "public"."enum_submissions_kind" AS ENUM('photo', 'video');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_submissions_status') THEN
        CREATE TYPE "public"."enum_submissions_status" AS ENUM('visible', 'hidden', 'removed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_submissions_media_kind') THEN
        CREATE TYPE "public"."enum_submissions_media_kind" AS ENUM('photo', 'video');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_submission_comments_status') THEN
        CREATE TYPE "public"."enum_submission_comments_status" AS ENUM('visible', 'hidden', 'removed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_content_reports_target_type') THEN
        CREATE TYPE "public"."enum_content_reports_target_type" AS ENUM('submission', 'comment');
      END IF;
    END $$;
  `)

  // 2) Публикации + массив доп. файлов.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "submissions" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" "public"."enum_submissions_kind" NOT NULL,
      "object_key" varchar NOT NULL,
      "poster_key" varchar,
      "mime" varchar NOT NULL,
      "bytes" numeric,
      "width" numeric,
      "height" numeric,
      "duration_sec" numeric,
      "author_name" varchar,
      "caption" varchar,
      "consent" boolean DEFAULT false NOT NULL,
      "status" "public"."enum_submissions_status" DEFAULT 'visible',
      "hidden_reason" varchar,
      "like_count" numeric DEFAULT 0,
      "comment_count" numeric DEFAULT 0,
      "view_count" numeric DEFAULT 0,
      "report_count" numeric DEFAULT 0,
      "ip_hash" varchar,
      "owner_hash" varchar,
      "owner_visitor" numeric,
      "user_agent" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "submissions_object_key_idx" ON "submissions" ("object_key");
    CREATE INDEX IF NOT EXISTS "submissions_owner_hash_idx" ON "submissions" ("owner_hash");
    CREATE INDEX IF NOT EXISTS "submissions_owner_visitor_idx" ON "submissions" ("owner_visitor");
    CREATE INDEX IF NOT EXISTS "submissions_updated_at_idx" ON "submissions" ("updated_at");
    CREATE INDEX IF NOT EXISTS "submissions_created_at_idx" ON "submissions" ("created_at");

    CREATE TABLE IF NOT EXISTS "submissions_media" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "kind" "public"."enum_submissions_media_kind" NOT NULL,
      "object_key" varchar NOT NULL,
      "poster_key" varchar,
      "mime" varchar NOT NULL,
      "bytes" numeric,
      "width" numeric,
      "height" numeric,
      "duration_sec" numeric
    );
    CREATE INDEX IF NOT EXISTS "submissions_media_order_idx" ON "submissions_media" ("_order");
    CREATE INDEX IF NOT EXISTS "submissions_media_parent_id_idx" ON "submissions_media" ("_parent_id");
  `)

  // 3) Комментарии / лайки / просмотры / жалобы.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "submission_comments" (
      "id" serial PRIMARY KEY NOT NULL,
      "submission_id" integer NOT NULL,
      "author_name" varchar,
      "body" varchar NOT NULL,
      "status" "public"."enum_submission_comments_status" DEFAULT 'visible',
      "hidden_reason" varchar,
      "report_count" numeric DEFAULT 0,
      "ip_hash" varchar,
      "owner_hash" varchar,
      "owner_visitor" numeric,
      "user_agent" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "submission_comments_submission_idx" ON "submission_comments" ("submission_id");
    CREATE INDEX IF NOT EXISTS "submission_comments_owner_hash_idx" ON "submission_comments" ("owner_hash");
    CREATE INDEX IF NOT EXISTS "submission_comments_owner_visitor_idx" ON "submission_comments" ("owner_visitor");
    CREATE INDEX IF NOT EXISTS "submission_comments_updated_at_idx" ON "submission_comments" ("updated_at");
    CREATE INDEX IF NOT EXISTS "submission_comments_created_at_idx" ON "submission_comments" ("created_at");

    CREATE TABLE IF NOT EXISTS "submission_reactions" (
      "id" serial PRIMARY KEY NOT NULL,
      "submission_id" integer NOT NULL,
      "ip_hash" varchar,
      "owner_hash" varchar,
      "owner_visitor" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "submission_reactions_submission_idx" ON "submission_reactions" ("submission_id");
    CREATE INDEX IF NOT EXISTS "submission_reactions_owner_hash_idx" ON "submission_reactions" ("owner_hash");
    CREATE INDEX IF NOT EXISTS "submission_reactions_owner_visitor_idx" ON "submission_reactions" ("owner_visitor");
    CREATE INDEX IF NOT EXISTS "submission_reactions_updated_at_idx" ON "submission_reactions" ("updated_at");
    CREATE INDEX IF NOT EXISTS "submission_reactions_created_at_idx" ON "submission_reactions" ("created_at");

    CREATE TABLE IF NOT EXISTS "submission_views" (
      "id" serial PRIMARY KEY NOT NULL,
      "submission_id" integer NOT NULL,
      "ip_hash" varchar,
      "owner_hash" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "submission_views_submission_idx" ON "submission_views" ("submission_id");
    CREATE INDEX IF NOT EXISTS "submission_views_owner_hash_idx" ON "submission_views" ("owner_hash");
    CREATE INDEX IF NOT EXISTS "submission_views_updated_at_idx" ON "submission_views" ("updated_at");
    CREATE INDEX IF NOT EXISTS "submission_views_created_at_idx" ON "submission_views" ("created_at");

    CREATE TABLE IF NOT EXISTS "content_reports" (
      "id" serial PRIMARY KEY NOT NULL,
      "target_type" "public"."enum_content_reports_target_type" NOT NULL,
      "target_id" numeric NOT NULL,
      "reason" varchar,
      "ip_hash" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "content_reports_updated_at_idx" ON "content_reports" ("updated_at");
    CREATE INDEX IF NOT EXISTS "content_reports_created_at_idx" ON "content_reports" ("created_at");
  `)

  // 4) FK. Дочерние → CASCADE (анти-G135, см. шапку); массив — drizzle-штатный CASCADE.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_media_parent_id_fk') THEN
        ALTER TABLE "submissions_media" ADD CONSTRAINT "submissions_media_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_comments_submission_id_submissions_id_fk') THEN
        ALTER TABLE "submission_comments" ADD CONSTRAINT "submission_comments_submission_id_submissions_id_fk"
          FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_reactions_submission_id_submissions_id_fk') THEN
        ALTER TABLE "submission_reactions" ADD CONSTRAINT "submission_reactions_submission_id_submissions_id_fk"
          FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_views_submission_id_submissions_id_fk') THEN
        ALTER TABLE "submission_views" ADD CONSTRAINT "submission_views_submission_id_submissions_id_fk"
          FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "submissions_media";
    DROP TABLE IF EXISTS "submission_comments";
    DROP TABLE IF EXISTS "submission_reactions";
    DROP TABLE IF EXISTS "submission_views";
    DROP TABLE IF EXISTS "content_reports";
    DROP TABLE IF EXISTS "submissions";
    DROP TYPE IF EXISTS "public"."enum_submissions_kind";
    DROP TYPE IF EXISTS "public"."enum_submissions_status";
    DROP TYPE IF EXISTS "public"."enum_submissions_media_kind";
    DROP TYPE IF EXISTS "public"."enum_submission_comments_status";
    DROP TYPE IF EXISTS "public"."enum_content_reports_target_type";
  `)
}
