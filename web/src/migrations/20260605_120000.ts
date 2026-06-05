import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Индивидуальное оформление страниц проектов — поле `decorMotif`.
 *
 * Select-поле Projects.decorMotif ('auto' | 'floral' | 'vines' | 'lines' |
 * 'geometric' | 'waves' | 'none'). Хранится как varchar (drizzle push:true
 * на проде/локалке сам реконсилит varchar→enum, как с kind/homepage_group —
 * см. 20260525_080000). Колонка нужна в обеих таблицах: основной `projects`
 * и версионной `_projects_v` (иначе HTTP 500 при сохранении проекта — урок
 * 20260601_120000, который забыл version_*-колонки).
 *
 * Всё ADD COLUMN IF NOT EXISTS — идемпотентно. Зеркало для psql — `20260605_120000.sql`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "decor_motif" varchar DEFAULT 'auto';
    ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_decor_motif" varchar DEFAULT 'auto';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_projects_v" DROP COLUMN IF EXISTS "version_decor_motif";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "decor_motif";
  `)
}
