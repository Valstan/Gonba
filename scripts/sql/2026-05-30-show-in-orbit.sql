-- 2026-05-30 — поле show_in_orbit для курации орбит-карусели на главной.
--
-- Контекст: главная вернулась к орбит-карусели (ADR-0006). Кружок = 1 реальный
-- проект. Дубли и служебные страницы выключаются флагом show_in_orbit=false,
-- чтобы в орбите не было дублей и пустых переходов.
--
-- Поле декларируется в коллекции Projects (web/src/collections/Projects/index.ts).
-- На проде колонку добавляем ВРУЧНУЮ этим скриптом ДО мержа фронта (норма проекта —
-- «на проде вручную ALTER TABLE», ADR-0002; push:true на проде не доезжает надёжно).
-- Без файла web/src/migrations/*.ts — чтобы не уронить safety-net деплоя.
--
-- Применять на проде:
--   cat scripts/sql/2026-05-30-show-in-orbit.sql | ssh GONBA "sudo -u postgres psql -d gonba -v ON_ERROR_STOP=1"
--
-- Идемпотентно (IF NOT EXISTS + WHERE по slug). Безопасно повторно.

BEGIN;

-- Колонка в published-таблице (её читает публичный queryProjects, draft=false).
ALTER TABLE "projects"   ADD COLUMN IF NOT EXISTS "show_in_orbit" boolean DEFAULT true;
-- Колонка в version-таблице (versions.drafts=true) — чтобы admin draft-save сохранял флаг.
ALTER TABLE "_projects_v" ADD COLUMN IF NOT EXISTS "version_show_in_orbit" boolean DEFAULT true;

-- Курация: убрать из орбиты дубли и инфо-страницы (центр 'gonba' исключается в коде).
-- Оставляем кружками канонические 8: eco-hotel-vyatka, vyatskaya-lepota,
-- konnyy-klub-gmalyzh, sadovaya-feya-gulfiya-kharisovna, vyatskiy-sbor,
-- craft-workshops-gonba, district-excursions, village-events.
UPDATE "projects"
   SET "show_in_orbit" = false
 WHERE "slug" IN ('eco-hotel-booking', 'vyatskaya-lepota-malmyzh', 'about-project', 'village-and-temple');

-- Зеркалим в version-таблицу для тех же проектов (избегаем footgun'а draft-перетёрки).
UPDATE "_projects_v"
   SET "version_show_in_orbit" = false
 WHERE "parent_id" IN (
   SELECT "id" FROM "projects"
    WHERE "slug" IN ('eco-hotel-booking', 'vyatskaya-lepota-malmyzh', 'about-project', 'village-and-temple')
 );

COMMIT;

-- Проверка результата: ожидаем 8 проектов с show_in_orbit=true (минус центр gonba → 8 кружков),
-- 4 с false; gonba остаётся true но в орбите играет роль центра (исключён фильтром в коде).
SELECT slug, show_in_orbit FROM projects ORDER BY show_in_orbit DESC, slug;
