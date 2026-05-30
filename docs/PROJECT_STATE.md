# Project state — архитектурное состояние

Этот документ описывает текущее состояние проекта: что есть, где лежит, как связано. Здесь — стабильная картина «как устроено», а не «что менялось» (для истории — `DEVELOPMENT_LOG.md`).

При значимых архитектурных изменениях — обновлять здесь.

---

## Стек

- **Next.js 15** (App Router) + **React 19**
- **Payload CMS 3.75** в том же Next-приложении
- **PostgreSQL 16** через `@payloadcms/db-postgres` (Drizzle ORM)
- **TypeScript 5.7**, **TailwindCSS 4**
- **pnpm 10** (corepack-managed)
- **Node 20** на проде, **24** локально

## Структура репо

```
docs/
├── PROJECT.md                — функциональная документация (env, скрипты, интеграции)
├── DEVELOPMENT_LOG.md        — хронология изменений (свежее сверху)
├── PENDING_FOLLOWUPS.md      — открытые задачи и техдолги
├── PROJECT_STATE.md          — этот файл (архитектура)
└── RELEASE_STABILITY_CHECKLIST.md — pre-release checklist

web/
├── src/
│   ├── app/
│   │   ├── (frontend)/       — публичный сайт
│   │   ├── (payload)/        — админка Payload
│   │   └── api/              — REST endpoints
│   ├── collections/          — Payload collections (Projects, Posts, Messages, VkAutoSync, ...)
│   ├── globals/              — Payload globals (Header, Footer, vkAutoSyncSettings, ...)
│   ├── Header/, Footer/      — компоненты глобалов
│   ├── components/           — переиспользуемые UI и доменные компоненты
│   ├── server/integrations/  — интеграции (yandex-disk, vk-auto-sync, vk-import)
│   ├── server/rate-limit/    — in-memory rate limit
│   ├── hooks/, access/, fields/, blocks/ — типичные Payload-куски
│   ├── payload.config.ts     — главный конфиг Payload
│   └── payload-types.ts      — auto-generated (gitignored)
└── scripts/                  — обслуживающие CLI-скрипты

deploy/systemd/               — unit-файлы systemd (`gonba`, `gonba-vk-sync.timer/.service`)

scripts/                      — общие deploy/dev помощники
└── safe-build.sh             — обёртка `next build` через systemd-run на проде

.claude/
├── commands/                 — slash-команды (/start, /reliz, /check, /sql) — В GIT
├── agents/                   — кастомные субагенты (если будут) — В GIT
├── worktrees/                — локальные worktrees Claude — НЕ в git
└── launch.json               — локальный preview-конфиг — НЕ в git
```

## Frontend (публичный сайт)

- Маршруты:
  - `/` — orbit-карусель проектов (`HomeCarouselMenuClient` + `HomeProjectGridMobile`)
  - `/projects` — адаптивная сетка цветных плашек (`EditableProjectsGrid`)
  - `/projects/[slug]/` — страница проекта с табами `feed | lavka | gallery | chat | contacts`
  - `/posts/[slug]/`, `/events/[slug]/`, `/services/[slug]/`, `/shop/[slug]/`
  - `/search`, `/contact`
  - `/api/health` — readiness/liveness
- **Inline-редактирование** на `/projects`: для админов (роли `admin`/`manager`/`editor`) — кнопка «✎ Редактировать плашки» включает drag-and-drop и модалку правки. Backend — Payload REST API (`PATCH /api/projects/{id}`, `POST /api/media`).
- I18n: только `ru`.

## Admin (Payload)

- Маршруты: `/admin/*`
- Кастомные страницы:
  - `/admin/yadisk` — `YandexDiskManager` (полноценный менеджер Яндекс-облака)
- **CSS-vars сайта** доступны в admin через `(payload)/site-theme.css` (отдельный partial с `:root { ... }` — без Tailwind utilities, чтобы не задеть UI Payload).
- Коллекции:
  - `Users` (admin/manager/editor roles)
  - `Pages`, `Posts`, `Projects`, `Events`, `Services`, `Products`, `Orders`, `Bookings`, `Media`, `Categories`, `Messages`, `VkAutoSync`, `VkImportQueue`
- Globals:
  - `Header`, `Footer`, `vkAutoSyncSettings`, `homeCarousel` (legacy)

## Интеграции

### Yandex.Disk
- Server: `web/src/server/integrations/yandex-disk.ts`
- API: `/yadisk-api/*` (защищено `requireAdmin`)
- Кастомный UI в admin: `/admin/yadisk`
- Авто-загрузка фото-галереи проекта: `web/src/server/integrations/yandex-disk-gallery.ts` + `web/src/components/Gallery/YandexGallerySection.tsx`
- Env: `YANDEX_DISK_TOKEN`, `YANDEX_DISK_BASE_PATH`, `YANDEX_DISK_MEDIA_PATH`, `MEDIA_CACHE_DIR`

### Media — Я.Диск как primary, локалка как TTL-кэш (ADR-0001 Implemented 2026-05-22)
- **Хранение:** Я.Диск — единственный долгосрочный источник. Все записи Media имеют `yandexPath`, `yandexPublicUrl`, `yandexResourceId`, `yandexSha256` и др. в sidebar-полях (readonly).
- **Раздача:** через proxy endpoint `web/src/app/api/media/file/[id]/route.ts`:
  - Cache lookup в `MEDIA_CACHE_DIR` (default `public/media-cache/`) → fallback `public/media/` (legacy)
  - На cache miss — `getDownloadUrl(yandexPath)` (приватная одноразовая ссылка по токену), `body.tee()` в response + writeStream в кэш
  - Rate-limit 240/min на IP, headers `Cache-Control: max-age=30d immutable`, `X-Cache: HIT | HIT-LEGACY | MISS`
- **Жизненный цикл файла:**
  1. Upload через админку Payload → Payload пишет в `staticDir` (`public/media`)
  2. `afterChange` хук → загрузка на Я.Диск + удаление локала (безусловно после успеха)
  3. Чтение через сайт → endpoint берёт с Я.Диска, сохраняет в `MEDIA_CACHE_DIR` атомарно (`<name>.tmp.<pid>...` → `rename`)
  4. Файлы старше 30 дней в `MEDIA_CACHE_DIR` чистит ежедневный systemd-таймер `gonba-media-cache.timer` (`web/scripts/clean-media-cache.ts`, использует `max(atime, mtime)`)
  5. `afterDelete` хук → удаляет ресурс с Я.Диска (через `yandexPath`/`yandexResourceId`)
- **Защитная сетка** для orphan-записей без `yandexPath` — `pnpm run media:migrate-yadisk -- --dry` (см. `web/scripts/migrate-media-to-yandex.ts`)
- Подробности и история — [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md), ADR-0001

### VK (импорт постов)
- **Ручной скрипт**: `web/scripts/vk-import.ts`, команда `pnpm run vk:import`
- **Авто-импорт**:
  - Коллекция `vk-auto-sync` — источники (URL сообщества, токен, интервал, привязка к project/category через relationship)
  - Глобал `vkAutoSyncSettings` — общие настройки
  - Server: `web/src/server/integrations/vk-auto-sync.ts` (`syncAllVkSources`, `syncVkSource`)
  - Resolve helper: `web/src/server/integrations/vk-auto-sync-resolve.ts` (парсинг URL → ID, VK API `groups.getById` для метаданных)
  - API endpoint: `POST /api/vk-auto-sync/trigger`
  - Внешний планировщик: **systemd timer** `gonba-vk-sync.timer` (каждые 3 часа) — на проде
- При создании источника: достаточно ввести URL — метаданные подтянутся автоматически. Токен можно отложить.

## БД

- На локалке: `postgres:postgres@127.0.0.1:5432/gonba`, `push: true` (drizzle добавляет колонки автоматически, иногда с y/N-prompt — обходится через `yes y | corepack pnpm dev` см. memory `dev_schema_push_prompt`).
- На проде: `push: true` тоже включён, но фактически любые новые поля доезжают через **ручной `ALTER TABLE`** (потому что после `next build` на проде первый запрос не успевает применить schema до прерывания). См. техдолг про полноценные миграции.

## Прод

- VPS `831d0ce99bdf.vps.myjino.ru`, Ubuntu 24.04, доступ по SSH alias `GONBA` (ключ `id_ed25519`), `sudo` без пароля.
- Сервис: `gonba.service` (`npm run start` от пользователя `valstan`).
- Папка проекта: `/home/valstan/GONBA/`, web в `/home/valstan/GONBA/web/`.
- **Секреты/конфиг — `/etc/gonba/gonba.env`** (root:valstan, `0640`), **вне дерева репо** (ADR-0005 / pool #008). Читаются тремя юнитами через `EnvironmentFile=` и build'ом через `systemd-run -p EnvironmentFile=`. В репо — только `web/.env.example`. Изменение секрета на проде = правка этого файла (нужен root) + `systemctl restart gonba`.
- Build: `corepack pnpm run build:raw` (НЕ через watchdog `pnpm run build` — он умирает по idle-timeout). Запускается через `systemd-run --uid=valstan --gid=valstan` (см. `scripts/safe-build.sh`), потому что SSH-disconnect убивает прямой процесс посреди prerender'а.
- Nginx терминирует TLS, проксирует на `127.0.0.1:3000`. Публичный домен — `гоньба.рф` (`xn--80abf4be9f.xn--p1ai`).
- systemd таймер `gonba-vk-sync.timer` каждые 3 часа дёргает `POST /api/vk-auto-sync/trigger`.

## Кэш-инвалидация

- Header global: `unstable_cache` Next.js с тегом `global_header`. Сбрасывается через `revalidateTag` из Payload `afterChange`-хука (`web/src/Header/hooks/revalidateHeader.ts`). **Прямой `UPDATE` в БД** этот хук не дёргает → нужно `systemctl restart gonba`.
- Главная `/` — `revalidate = 600` (dynamic с ISR).
- `/projects` — `revalidate = 30` (быстро подхватывает админские правки плашек).
- **Media файлы** (`/api/media/file/[id]`): `Cache-Control: public, max-age=2592000, immutable` (30 дней в браузере, иммутабельно — потому что URL содержит id). Server-side disk кэш в `MEDIA_CACHE_DIR` чистится TTL-cron'ом (см. секцию Media выше). Никакого `unstable_cache` — endpoint всегда выполняется, но 99% запросов отдают локальный файл, не дёргая Я.Диск.

## Slash-команды

- `/start` — открытие сессии: git pull, прочесть `DEVELOPMENT_LOG.md` + `PENDING_FOLLOWUPS.md` + `PROJECT_STATE.md`, отчёт о состоянии.
- `/reliz` — релизный flow: commit → push → PR → merge → safe-build на проде → restart → проверки.
- `/check` — health-check: dev local + prod endpoints + git ahead/behind + lint/typecheck (быстро).
- `/sql` — выполнение SQL на проде с диалогом-подтверждением (для миграций / data fix).
