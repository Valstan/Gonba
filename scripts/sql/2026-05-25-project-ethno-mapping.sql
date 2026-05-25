-- Этно-модерн редизайн PR2 §4 — маппинг 10 проектов на этно-группы.
-- Применить ОДИН РАЗ на проде. Безопасно повторно (WHERE по slug).
--
-- Зависит от миграции 20260525_080000 (поля homepage_group / kind / is_featured /
-- is_hero_of_homepage / excerpt должны существовать).
--
-- Baseline плана PR2 §4 (docs/plans/etno-modern-redesign.md) использовал slug'и
-- которые отличаются от реальных в БД. Этот скрипт уже учитывает реальный snapshot
-- (см. SELECT в финале применения scripts/sql/2026-05-23-prod-redesign-config.sql
-- от 2026-05-25, DEV_LOG).

\set ON_ERROR_STOP on
BEGIN;

-- ============================================================
-- 1) homepageGroup + kind для проектов на главной
-- ============================================================

-- Пожить (stay) — эко-отель (два варианта slug, оба маппим одинаково)
UPDATE projects SET homepage_group='stay', kind='project'
  WHERE slug IN ('eco-hotel-booking','eco-hotel-vyatka');

-- Делать (do) — мастерские, экскурсии, конный клуб
UPDATE projects SET homepage_group='do', kind='project'
  WHERE slug IN ('craft-workshops-gonba','district-excursions');

UPDATE projects SET homepage_group='do', kind='studio'
  WHERE slug = 'konnyy-klub-gmalyzh';

-- Смотреть (see) — село и храм (hero+featured), Гульфия (person),
-- лепота (studio, два варианта), события (project)
UPDATE projects SET homepage_group='see', kind='project', is_featured=true, is_hero_of_homepage=true,
  chapter_roman='I',
  excerpt='Покровская церковь 1808 года, село на правом берегу Вятки — главная история Гоньбы.'
  WHERE slug='village-and-temple';

UPDATE projects SET homepage_group='see', kind='person'
  WHERE slug='sadovaya-feya-gulfiya-kharisovna';

UPDATE projects SET homepage_group='see', kind='studio'
  WHERE slug IN ('vyatskaya-lepota','vyatskaya-lepota-malmyzh');

UPDATE projects SET homepage_group='see', kind='project'
  WHERE slug='village-events';

-- Лавка (shop) — вятский сбор
UPDATE projects SET homepage_group='shop', kind='shop'
  WHERE slug='vyatskiy-sbor';

-- Проекты НЕ на главной — about-project (только админка), gonba (сам портал, не плашка)
-- homepage_group остаётся NULL. kind='project' по умолчанию миграции.
UPDATE projects SET kind='project'
  WHERE slug IN ('about-project','gonba');

-- ============================================================
-- 2) Проверки — должно вывести по 4 группы и featured
-- ============================================================

\echo
\echo '=== homepage_group распределение ==='
SELECT homepage_group, COUNT(*) AS n, string_agg(slug, ', ' ORDER BY slug) AS slugs
FROM projects
WHERE homepage_group IS NOT NULL
GROUP BY homepage_group
ORDER BY homepage_group;

\echo
\echo '=== kind распределение ==='
SELECT kind, COUNT(*) AS n
FROM projects
WHERE kind IS NOT NULL
GROUP BY kind
ORDER BY kind;

\echo
\echo '=== Hero проект (ожидаем 1 строку) ==='
SELECT slug, title, chapter_roman, excerpt
FROM projects
WHERE is_hero_of_homepage = true;

\echo
\echo '=== Featured проекты ==='
SELECT slug, title, chapter_roman, is_hero_of_homepage
FROM projects
WHERE is_featured = true
ORDER BY slug;

\echo
\echo '=== Проекты НЕ на главной (homepage_group IS NULL) ==='
SELECT slug, title, kind
FROM projects
WHERE homepage_group IS NULL
ORDER BY slug;

COMMIT;

-- ============================================================
-- ВАЖНО: drafts/versions
-- ============================================================
-- У Projects включены versions:{drafts:true}. Прямой UPDATE обновляет live-table,
-- но НЕ синхронизирует _projects_v. При следующем Save в /admin Payload может
-- перезаписать наши поля из draft'а. Чтобы зафиксировать — открой каждый
-- задетый проект в /admin → нажми Save (ничего не меняя).
--
-- См. подробности в scripts/sql/2026-05-23-prod-redesign-config.sql (тот же warning).
