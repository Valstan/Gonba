-- Backfill для scripts/sql/2026-05-23-prod-redesign-config.sql (brain dispatch).
-- Применить ОДИН РАЗ. Безопасно повторно (WHERE по slug + COALESCE).
--
-- Контекст: исходный скрипт от brain 2026-05-23 использовал slug'и которые
-- не совпали с реальными в БД (eco-hotel-booking вместо eco-hotel и т.д.).
-- 3 из 13 UPDATE'ов применилось через первый скрипт; этот добивает остальные.
--
-- Подробности — DEVELOPMENT_LOG.md блок 2026-05-25 «SQL prod-redesign-config».

\set ON_ERROR_STOP on
BEGIN;

-- ============================================================
-- 1) gallery_yandex_folder для 6 проектов с реальными slug'ами
-- ============================================================
-- COALESCE — не перезатираем если уже есть значение (идемпотентность).

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/eco-hotel/')
  WHERE slug = 'eco-hotel-booking';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/eco-hotel-vyatka/')
  WHERE slug = 'eco-hotel-vyatka';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/workshops/')
  WHERE slug = 'craft-workshops-gonba';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/excursions/')
  WHERE slug = 'district-excursions';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/horse-club/')
  WHERE slug = 'konnyy-klub-gmalyzh';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/gulfia/')
  WHERE slug = 'sadovaya-feya-gulfiya-kharisovna';

UPDATE projects SET gallery_yandex_folder = COALESCE(gallery_yandex_folder, '/public-galleries/events/')
  WHERE slug = 'village-events';

-- ============================================================
-- 2) chat_enabled = true для проектов с бронированием/записью
-- ============================================================

UPDATE projects
SET chat_enabled = true,
    chat_placeholder = COALESCE(NULLIF(chat_placeholder, ''), 'Напишите нам…')
WHERE slug IN (
  'eco-hotel-booking',
  'eco-hotel-vyatka',
  'craft-workshops-gonba',
  'district-excursions',
  'konnyy-klub-gmalyzh'
);

-- ============================================================
-- 3) Проверки
-- ============================================================

\echo
\echo '=== gallery_yandex_folder (ожидаем 10 строк: 3 из первого скрипта + 7 из этого) ==='
SELECT slug, gallery_yandex_folder
FROM projects
WHERE gallery_yandex_folder IS NOT NULL
ORDER BY slug;

\echo
\echo '=== chat_enabled = true ==='
SELECT slug, chat_enabled, chat_placeholder
FROM projects
WHERE chat_enabled = true
ORDER BY slug;

\echo
\echo '=== Проекты БЕЗ gallery_yandex_folder (ожидаем: gonba, about-project) ==='
SELECT slug, title
FROM projects
WHERE gallery_yandex_folder IS NULL
ORDER BY slug;

COMMIT;

-- ============================================================
-- ВАЖНО: drafts/versions — тот же warning что и в основном скрипте
-- ============================================================
-- Прямой UPDATE минует Payload `versions:{drafts:true}` хуки. После любого Save
-- в /admin Payload может перезаписать поля из draft'а. Workaround: для каждого
-- задетого проекта открыть /admin → Save (ничего не меняя) — это пересоздаст
-- _projects_v snapshot с актуальными значениями.
