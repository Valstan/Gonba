# Development Log

Хронология значимых изменений проекта GONBA. **Свежее сверху.** Каждый блок — одна сессия разработки (день) или один логически законченный кусок.

При обновлении: новый блок ставится в самый верх под заголовком, под него — даты, ссылка на PR (если есть), что сделано, что задеплоено, что осталось хвостами (→ переносить в `PENDING_FOLLOWUPS.md`).

---

## 2026-05-20 — ГОНЬБА 20 мая 2026 (Claude session)

**Серия PR:** #4 → #5 → #6 → #7. Все смержены squash в `main`, задеплоено на прод.

### PR #4 (`391ee94`) — feat(projects): редизайн `/projects` + inline-редактор плашек для админов

- Новый компонент `web/src/app/(frontend)/EditableProjectsGrid.tsx` (~330 строк) — адаптивная сетка цветных плашек.
- Каждая плашка: градиент по `accentColor` проекта (фолбэк — псевдо-рандом из тематической палитры по hash от slug), картинка-превью (logo → heroImage → первое фото `gallery`, иначе декор-буква), название, краткое описание, кнопка «Войти в проект».
- Hero-плашка с `gonba` сверху на всю ширину.
- Для админов (роли admin/manager/editor) — кнопка «✎ Редактировать плашки»:
  - drag-and-drop через `@dnd-kit` (пишет `sortOrder` шагом 10 через `PATCH /api/projects/{id}`);
  - модалка `EditProjectDialog.tsx` (~210 строк): название, описание, цвет (color picker + HEX), кастомная ссылка, загрузка картинки через `POST /api/media`.
- Главная `/` восстановлена к старому виду (orbit-карусель) — плашки переехали на `/projects`.
- Новое опциональное поле `homeLink` в коллекции `Projects`.
- Зависимости: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **БД-миграция на проде:** `ALTER TABLE projects ADD COLUMN home_link TEXT` (на проде используется не `push:true`, а миграции — Drizzle сам колонку не добавит).

### PR #5 (`070fd81`) — style(yadisk): UI Облака под дизайн-систему сайта

- Локальные `--yadisk-*` SCSS-переменные привязаны к shadcn-style CSS-vars сайта с fallback на Payload theme tokens и старые hex для safety.
- Унифицированные радиусы `--yadisk-radius-sm/md/lg`.
- Категорийные цвета бейджей типов файлов и dark-палитра полноэкранного просмотрщика медиа — намеренно оставлены.
- **БД-правка на проде:** запись `header_nav_items` для «Облако» обновлена с `https://831d0ce99bdf.vps.myjino.ru/admin/yadisk` на относительный `/admin/yadisk`.

### PR #6 (`619ff92`) — feat: site theme на admin-маршрутах + wizard VK-источников

- **Yandex Cloud UI**: создан `web/src/app/(payload)/site-theme.css` с CSS-переменными сайта (`--card`, `--border`, `--foreground`, ...), импортирован в `(payload)/layout.tsx`. Прошлый PR #5 рисовал mapping, но переменные не подхватывались — `globals.css` сайта подключён только к `(frontend)`-группе.
- **VK Auto-Sync «wizard»**: в коллекции `vk-auto-sync` все required-поля кроме URL сделаны опциональными или с дефолтами. Добавлены поля `communityName`, `communityDescription`, `communityAvatar`, `screenName` — заполняются автоматически через `beforeValidate`-hook, который парсит URL и дёргает VK API `groups.getById`. Токен можно отложить — используется fallback из env (`VK_TOKEN_VALSTAN`/`VITA`/`SERVICE`/`TOKEN`). Все labels переведены на русский.
- В `syncVkSource()` добавлен safe-guard на пустой `groupId`.
- **БД-миграция на проде:** добавлены 4 колонки `vk_auto_sync.community_name/description/avatar/screen_name TEXT`, сняты `NOT NULL` с `group_id` и `access_token`.

### PR #7 (`5aaa1dd`) — feat(vk): dropdowns с проектами и категориями

- Поля `project` (→ `projects`) и `category` (→ `categories`) — relationship, required. В UI dropdown с реальными названиями.
- `projectSlug`/`sectionSlug` остались как readOnly text для backwards compatibility с `syncVkSource()` — заполняются автоматически из выбранных связей через тот же `beforeValidate`-hook.
- Обновлены seed-script и `POST /api/vk-auto-sync/trigger?seed` — ищут проект/категорию по slug и передают `id`.
- **БД-миграция на проде:** `ALTER TABLE vk_auto_sync ADD COLUMN project_id INTEGER, category_id INTEGER`, backfill через `UPDATE FROM SELECT slug`, снят `NOT NULL` с `project_slug`/`section_slug`.

### Прод-инфраструктура — уроки сессии

- **SSH disconnect убивает `next build`.** Прямой `corepack pnpm run build:raw` через одну SSH-сессию завершается посередине prerender'а, оставляя «полуготовый» `.next` без `prerender-manifest.json` → сервис в crash-loop с `ENOENT`. Правильно — запускать через `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`; ждать через `systemctl is-active` в poll-loop. Скрипт-обёртка теперь есть в `scripts/safe-build.sh`.
- **`build` script с watchdog 180s слишком короткий** — Next.js 15 production build молчит до 5-6 минут на этапе компиляции и попадает в idle-timeout. `build:raw` обходит watchdog. → 🟡 техдолг: поднять watchdog idle до 600s или вообще убрать.
- **`systemd-run` без `--uid=valstan`** запускается от root и берёт глобальный pnpm 11 из `/root/.cache/corepack`, который несовместим с engines проекта (`^9 || ^10`). Падает с `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.
- **Прямой `UPDATE` в БД минует Payload `afterChange`-хук** → `revalidateTag('global_header')` не вызывается → Next.js `unstable_cache` отдаёт устаревший HTML. Лечится `systemctl restart gonba` или программным `revalidateTag` через API.
- **На проде `push: true` не используется.** Любое добавление поля в коллекцию требует ручного `ALTER TABLE` (или полноценной миграции Payload).

### Хвосты, унесённые в `PENDING_FOLLOWUPS.md`

- 🟡 Длинный watchdog в `build` script
- 🟡 Полноценные миграции для добавленных колонок (вместо ручных `ALTER TABLE`)
- 🟡 `dev_env_requirements` memory утверждает «Postgres локально нет» — устарело
- 🟡 `docs/PROJECT.md:5` — захардкоженный шаблон даты «18 мая 2026»
- 🟡 `docs/PROJECT.md:41` — в списке коллекций нет `Messages`
- 🟢 У некоторых проектов в БД `title` равен slug (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) — нужна чистка через админку

---

## 2026-05-19 — мердж крупной UX-фичи

**PR (`d6f5bcc`):** UX redesign — Жизнь проекта + Лавка + чат + mobile-first.

Прилетело 50 файлов, +2968/-144:
- Новая коллекция `Messages` ([web/src/collections/Messages/index.ts](../web/src/collections/Messages/index.ts))
- Чат проекта: страница `(frontend)/projects/[slug]/chat/page.tsx`, API `api/projects/[slug]/chat/route.ts`, компоненты `components/Chat/`
- «Лавка» (товары/услуги/бронирование): страница `(frontend)/projects/[slug]/lavka/page.tsx`, компоненты `components/Lavka/`
- Лента: `(frontend)/projects/[slug]/feed/page.tsx`, `components/Feed/`
- Yandex Gallery: `(frontend)/projects/[slug]/gallery/page.tsx`, `server/integrations/yandex-disk-gallery.ts`
- Мобильная навигация: `MobileNavSheet`, `ProjectBottomTabs`, `HomeProjectGridMobile`
- Базовые UI-примитивы: `components/ui/{dialog,sheet,tabs,separator,skeleton}.tsx`
- In-memory rate-limit: `server/rate-limit/inMemory.ts`
- Скрипт миграции: `scripts/migrate-enabled-sections.ts`

---

## 2026-04-15 — стабилизация VK auto-sync

**Серия коммитов (`9e4b1cc`, `c243871`):** fix: stabilize VK auto-sync, Payload jobs, and TS hygiene; disable versions on VkAutoSync.

---

## 2026-04 — VK auto-sync, system timer

- `3572713` — systemd timer для VK auto-sync trigger
- `ff04f13` — VK token rotation и rate limit protection
- `6bb6b16` — VK auto-sync service (cron job + admin settings)
- `9525d5c` — fix import path в `VkAutoSyncSettings`
- `13aa798`, `d786e64`, `4109a18` — мелкие фиксы синхронизации
- `f1daf95` — единый slug коллекции `vk-auto-sync`
- `690a730` — включён `db push:true` в postgres adapter
- `2ec27f1` — seed endpoint `POST /api/vk-auto-sync/trigger {seed:true}`

---

## 2026-04 — секции и пресеты

- `d099c5f` — redesign sections system: «миры» секций с уникальной стилизацией
- `9495af9` — fix sections build error (separate client components for interactivity)
- `29e444e` — fix React 19 `use()` → `useContext` на `/contact`

---

## 2026-04 — Начало истории и SSH

- `183cecd` — SSH remote access в `docs/PROJECT.md`
- `38806ba` — cleanup репо, .gitignore, .env.example
- `9d5c869` — initial commit: GONBA (Payload CMS + Next.js 15)
