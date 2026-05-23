-- Prod redesign followup config (brain dispatch 2026-05-23)
-- Запустить ОДИН РАЗ на проде. Безопасно повторно: все WHERE по slug.
--
-- Применяет:
--   * gallery_yandex_folder для 9 проектов (всё кроме about-project)
--   * chat_enabled + chat_placeholder для 4 проектов (eco-hotel/workshops/excursions/horse-club)
--
-- Почему SQL, а не /admin: меньше кликов, у Projects нет afterChange-хука
-- с revalidateTag, кэш-инвалидация не требуется. drafts: true — см. NOTICE ниже.

\set ON_ERROR_STOP on
BEGIN;

-- ============================================================
-- 1) gallery_yandex_folder для 9 проектов
-- ============================================================

UPDATE projects SET gallery_yandex_folder = '/public-galleries/eco-hotel/'         WHERE slug = 'eco-hotel';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/village-and-temple/' WHERE slug = 'village-and-temple';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/workshops/'         WHERE slug = 'workshops';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/excursions/'        WHERE slug = 'excursions';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/horse-club/'        WHERE slug = 'horse-club';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/vyatskaya-lepota/'  WHERE slug = 'vyatskaya-lepota';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/gulfia/'            WHERE slug = 'gulfia';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/events/'            WHERE slug = 'events';
UPDATE projects SET gallery_yandex_folder = '/public-galleries/vyatskiy-sbor/'     WHERE slug = 'vyatskiy-sbor';

-- ============================================================
-- 2) chat_enabled = true для 4 «бронирование/запись» проектов
-- ============================================================

UPDATE projects
SET chat_enabled = true,
    chat_placeholder = COALESCE(NULLIF(chat_placeholder, ''), 'Напишите нам…')
WHERE slug IN ('eco-hotel', 'workshops', 'excursions', 'horse-club');

-- ============================================================
-- 3) Проверка — должен показать все 9 yadisk + 4 chat
-- ============================================================

\echo
\echo '=== gallery_yandex_folder (ожидаем 9 строк) ==='
SELECT slug, gallery_yandex_folder
FROM projects
WHERE gallery_yandex_folder IS NOT NULL
ORDER BY slug;

\echo
\echo '=== chat_enabled = true (ожидаем 4 строки) ==='
SELECT slug, chat_enabled, chat_placeholder
FROM projects
WHERE chat_enabled = true
ORDER BY slug;

\echo
\echo '=== slug'и которые в БД, но НЕ совпали с baseline (нужно ручное вмешательство) ==='
SELECT slug
FROM projects
WHERE slug NOT IN (
  'eco-hotel','village-and-temple','workshops','excursions','horse-club',
  'vyatskaya-lepota','gulfia','events','vyatskiy-sbor','about-project'
)
ORDER BY slug;

\echo
\echo '=== VK auto-sync — последние last_sync_at (должны быть >= 2026-05-19) ==='
SELECT id, community_name, is_enabled, last_sync_status, last_sync_at
FROM vk_auto_sync
ORDER BY last_sync_at DESC NULLS LAST
LIMIT 10;

COMMIT;

-- ============================================================
-- ВАЖНО: drafts/versions
-- ============================================================
-- У Projects включены `versions: { drafts: true }` (web/src/collections/Projects/index.ts:205).
-- Прямой UPDATE обновляет `projects` (live), но НЕ синхронизирует latest version
-- в `_projects_v`. Это не влияет на отдачу публичных страниц (они читают `projects`),
-- но при следующем Save в /admin Payload может перетереть наши поля старыми
-- значениями из draft'а. Чтобы избежать сюрприза — открой каждый затронутый проект
-- в /admin → сразу Save (ничего не меняя). Это пересоздаст version snapshot
-- с актуальными значениями.
--
-- Если лень — оставь как есть. Поля переживут до первого «осмысленного» правки
-- проекта в админке; если кто-то нажмёт Save в Drafts → Publish, могут пропасть.
