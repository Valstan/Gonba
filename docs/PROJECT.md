# GONBA — проектная документация

Цель этого документа — дать следующей сессии разработки с нейросетью быстрый и точный контекст: где что лежит, какие сервисы и функции уже есть, какие переменные окружения используются, и какие правила критичны для стабильной работы проекта.

Сессию назови «ГОНЬБА <сегодняшняя дата>» (формат: `ГОНЬБА 21 мая 2026`). Slash-команда `/start` сама проставит правильную дату из системного контекста.

## Краткий обзор

- Проект — сайт + админка на Payload CMS, работающие в одном Next.js приложении.
- База данных: PostgreSQL через `@payloadcms/db-postgres`.
- Основной каталог приложения: `web/`.
- Внешние интеграции: Yandex.Disk, VK (импорт контента).
- I18n: ru (fallback тоже ru).

## Архитектура и основные пути

Главный код находится в `web/src`:

- `web/src/payload.config.ts` — главный конфиг Payload (коллекции, globals, плагины, db, i18n, jobs).
- `web/src/app/` — Next.js App Router:
  - `web/src/app/(frontend)` — фронтенд маршруты.
  - `web/src/app/(payload)` — админка Payload.
  - `web/src/app/api` — API/эндпоинты.
  - Включает `GET /api/health` для readiness/liveness проверки.
  - `web/src/app/yadisk-api` — API для Yandex.Disk.
- `web/src/collections/` — коллекции Payload.
- `web/src/globals/` — глобалы Payload (хедер/футер).
- `web/src/server/` — серверная логика (интеграции, auth, уведомления).
- `web/src/hooks/`, `web/src/access/`, `web/src/fields/`, `web/src/blocks/` — типичные части Payload проекта.

Деплой и сервисы:

- `deploy/systemd/gonba-web.service` — шаблон unit файла.
- Фактический systemd unit в системе: `gonba.service` (его и перезапускать).
- `web/docker-compose.yml` — локальный запуск с Postgres.

## Коллекции и глобалы Payload

Коллекции (на уровне конфигурации):

- `Pages`, `Posts`, `Projects`, `Events`, `Services`, `Products`, `Orders`, `Bookings`, `VkImportQueue`, `VkAutoSync`, `Messages`, `Media`, `Categories`, `Users`
  - см. `web/src/collections/*`

Глобалы:

- `Header`, `Footer`, `HomeCarousel` (legacy), `VkAutoSyncSettings`
  - см. `web/src/Header`, `web/src/Footer`, `web/src/HomeCarousel`, `web/src/globals/`

## Встроенные сервисы и интеграции

### Yandex.Disk

- Серверная интеграция: `web/src/server/integrations/yandex-disk.ts`
- API маршруты:
  - `GET /yadisk-api?path=/...` — листинг
  - `POST /yadisk-api` — действия (`create-folder`, `delete`, `move`, `copy`, `rename`, `resolve`)
  - `POST /yadisk-api/upload` — получить ссылку для загрузки
- Все вызовы защищены `requireAdmin` (роль `admin` или `manager`).

### VK импорт

Скрипт импорта постов:

- `web/scripts/vk-import.ts`
- Команда: `pnpm run vk:import`
- Поддерживается несколько групп; токены читаются из env.

### VK авто-импорт (авто-синхронизация)

Автоматический сервис, который каждые 3 часа проверяет VK-сообщества и забирает свежие посты в блог.

**Архитектура:**
- Коллекция `vk-auto-sync` — список источников (URL сообщества, токен, интервал, привязка к секции/проекту)
- Глобал `vkAutoSyncSettings` — общие настройки (интервал по умолчанию, скачивание изображений, авто-публикация)
- Server function: `web/src/server/integrations/vk-auto-sync.ts` (`syncAllVkSources`, `syncVkSource`)
- API endpoint: `POST /api/vk-auto-sync/trigger` — синхронизация всех источников или конкретного (по `sourceId`)
- Payload Job task: `vkAutoSync` — задефайнен в `web/src/payload.config.ts`, но **без встроенного schedule**; запускать через API или payload-jobs runner.
- Внешний планировщик: **systemd timer** `gonba-vk-sync.timer` (см. `deploy/systemd/gonba-vk-sync.timer` и `deploy/README.md`).

**Как работает:**
1. systemd timer `gonba-vk-sync.timer` срабатывает каждые 3 часа (`OnCalendar=*-*-* 00/3:00:00`).
2. Юнит `gonba-vk-sync.service` (oneshot) делает `POST /api/vk-auto-sync/trigger` с `Bearer $CRON_SECRET`.
3. Endpoint вызывает `syncAllVkSources` → для каждого активного источника: внутренний гард по `syncIntervalHours`, затем `wall.get` VK API → берёт 1 новый пост → скачивает изображение → создаёт пост в CMS.
4. Привязка к проекту и секции через `projectSlug` и `sectionSlug`.
5. Состояние источника обновляется в `vk_auto_sync.last_sync_*`, общее количество — в `total_imported`.

**Ручной запуск:**
```bash
curl -X POST http://127.0.0.1:3000/api/vk-auto-sync/trigger \
  -H 'Authorization: Bearer $CRON_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Seed (начальная настройка):**
- Таблицы БД: `vk_auto_sync`, `vk_auto_sync_sync_log`
- Начальный источник для `club229392127` (Вятская лепота) уже создан
- Для добавления нового источника: админка → "Источники авто-импорта VK" → создать запись

**Важно:** VK-токен должен быть от активного VK-приложения. Если получаешь ошибку "Application is blocked" — разблокируй приложение в VK или получи новый сервисный токен.

## Переменные окружения

**На проде секреты живут в `/etc/gonba/gonba.env`** (root:valstan, `0640`, вне дерева репо — ADR-0005 / pool #008). Локально для разработки — `web/.env` (шаблон `web/.env.example`). В git коммитится только `web/.env.example`.

Обязательные:

- `DATABASE_URL` — строка подключения Postgres
- `PAYLOAD_SECRET` — секрет для Payload auth

Опциональные/интеграции:

- `CRON_SECRET` — доступ к jobs
- `YANDEX_DISK_TOKEN` — OAuth токен Yandex.Disk
- `YANDEX_DISK_BASE_PATH` — базовый путь на диске (например `/GONBA`)
- `YANDEX_DISK_MEDIA_PATH` — путь для медиа (по умолчанию `/media`)
- `NEXT_PUBLIC_SERVER_URL` — публичный base URL
- `PAYLOAD_PUBLIC_SERVER_URL` — публичный base URL для Payload
- `PORT` — порт Next.js (обычно 3000)

VK токены (для `vk:import`):

`VK_TOKEN_VALSTAN`, `VK_TOKEN_VITA`
- Также поддерживаются варианты `VK_TOKEN_{groupId}` и `VK_TOKEN_GROUP_{groupId}`

## Технологии и версии

Ключевые:

- Next.js 15 (App Router)
- Payload CMS 3.75
- React 19
- TypeScript 5.7
- TailwindCSS 4
- PostgreSQL 16 (через docker-compose)

Тесты:

- Vitest (`pnpm run test:int`)
- Playwright (`pnpm run test:e2e`)

## Скрипты и команды

Запуск:

- `pnpm dev` / `npm run dev` — dev
- `pnpm build` / `npm run build` — build
- `pnpm start` / `npm run start` — production

Тесты:

- `pnpm test` — интеграционные + e2e
- `pnpm test:int`
- `pnpm test:e2e`

Payload:

- `pnpm generate:types` — после изменений в схемах
- `pnpm generate:importmap` — после изменений компонентов

Скрипты:

- `pnpm run vk:import` — импорт постов из VK
- `pnpm run media:migrate-yadisk` — защитная сетка для записей без `yandexPath` (post-phase-3). Аргументы: `--dry`, `--limit N`, `--id <id>`, `--max N`. Идемпотентно. Подробности — `web/scripts/migrate-media-to-yandex.ts`.
- `pnpm run cache:clean` — удалить из `MEDIA_CACHE_DIR` файлы, к которым не обращались более N дней (default 30). Аргументы: `--dir <path>`, `--ttl-days <N>`, `--dry`. Запускается systemd-таймером `gonba-media-cache.timer` (см. ниже).
- `POST /yadisk-api/sync` — сверка/обновление Yandex-метаданных медиа батчами (admin/manager)
- `tsx scripts/russify.ts` — русификация/seed контента (см. `web/scripts/russify.ts`)

## Деплой

### Удалённый доступ к серверу (SSH)

Настроено SSH-подключение к production-серверу с локальной машины разработчика.

Параметры подключения:

- Хост: `831d0ce99bdf.vps.myjino.ru`
- Порт: `22`
- Пользователь: `valstan`
- Ключ: ed25519 (`~/.ssh/id_ed25519_gonba_deploy`) — **изолированный per-project ключ**, не используется на других серверах. См. раздел «SSH deploy-key — ротация» ниже.
- ОС сервера: Ubuntu Linux 24.04 (ядро 6.8.x)

**На локалке алиас `GONBA` в `~/.ssh/config`:**

```
Host GONBA
  HostName 831d0ce99bdf.vps.myjino.ru
  Port 22
  User valstan
  IdentityFile ~/.ssh/id_ed25519_gonba_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
```

После этого все примеры ниже работают как `ssh GONBA "..."`. Если алиас не настроен — используй полный адрес `valstan@831d0ce99bdf.vps.myjino.ru -p 22`.

**Для нейросетей-разработчиков**: ты можешь подключаться к серверу по SSH и **выполнять `sudo` без пароля** (NOPASSWD настроен). Это полный root-доступ — пользуйся аккуратно, как на любом продакшене. Возможности:

- Управлять сервисом (`sudo systemctl status/restart/stop gonba`)
- Управлять авто-импортом VK (`sudo systemctl status/start gonba-vk-sync.timer`, `sudo systemctl start gonba-vk-sync.service`)
- Просматривать логи (`journalctl -u gonba -f`, `journalctl -u gonba-vk-sync -n 50`)
- Обновлять код (`cd /home/valstan/GONBA && git pull`)
- Собирать и деплоить новые версии
- Делать `pg_dump` локальной production-БД (`pg_isready` подтверждает, что Postgres слушает 127.0.0.1:5432)
- Прокидывать туннель к prod БД с локалки: `ssh -L 5432:127.0.0.1:5432 GONBA` (внимание: `push: true` в `payload.config.ts` будет менять схему прод-БД)
- Выполнять любые другие команды на сервере

Доступ верифицирован (история проверок — `git log`).

Примеры команд:

```bash
# Проверить статус сервиса
ssh GONBA "sudo systemctl status gonba.service --no-pager -l"

# Перезапустить сервис
ssh GONBA "sudo systemctl restart gonba"

# Посмотреть логи
ssh GONBA "journalctl -u gonba -n 50 --no-pager"

# Обновить код из репозитория и пересобрать (правильный способ — через safe-build.sh)
ssh GONBA "cd /home/valstan/GONBA && git pull && /home/valstan/GONBA/scripts/safe-build.sh && sudo systemctl restart gonba"
# (НЕ запускать `corepack pnpm run build:raw` напрямую через ssh — SSH-disconnect убивает prerender)

# Снять дамп БД prod в локальный файл
ssh GONBA "sudo -u postgres pg_dump -Fc gonba" > prod-gonba.dump

# Триггернуть VK auto-sync вручную (используй $CRON_SECRET из /etc/gonba/gonba.env)
ssh GONBA "sudo systemctl start gonba-vk-sync.service && journalctl -u gonba-vk-sync -n 20 --no-pager"
```

### Systemd (production)

Сервис в системе: `gonba.service`

Регулярный релизный flow — slash-команда `/reliz` (commit → push → PR → merge → safe-build → restart → проверки). Внутри `/reliz` build запускается через `scripts/safe-build.sh`, который оборачивает `next build` в `systemd-run --uid=valstan --gid=valstan`, чтобы переживать SSH-disconnect.

Первоначальная установка сервиса:

1. `corepack pnpm install`
2. `scripts/safe-build.sh` (или `systemd-run --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`)
3. Создать секреты вне дерева репо (ADR-0005): `sudo mkdir -p /etc/gonba && sudo install -o root -g valstan -m 0640 <env-source> /etc/gonba/gonba.env`
4. `sudo cp deploy/systemd/gonba-web.service /etc/systemd/system/gonba.service`
5. `sudo systemctl daemon-reload`
6. `sudo systemctl enable --now gonba`
7. Перезапуск: `sudo systemctl restart gonba`
8. Логи: `journalctl -u gonba -f`
9. Переменные окружения на проде: `EnvironmentFile=-/etc/gonba/gonba.env` (build читает через `systemd-run -p EnvironmentFile=`, см. `scripts/safe-build.sh`)

**Важно:**
- Не использовать `pnpm run build` (под watchdog) и тем более `npm run build` — задача про правильный watchdog есть в `PENDING_FOLLOWUPS.md`. Прямой путь — `build:raw` через safe-build.sh.
- Прямой `corepack pnpm run build:raw` через одну SSH-сессию умирает посередине prerender'а при SSH-disconnect → артефакт `.next` остаётся неполным → сервис в crash-loop. Поэтому `systemd-run`.
- Прод НЕ применяет миграции автоматически (`push: true` не успевает из-за timeout прерывания первого запроса). После добавления полей в коллекциях запускать `pnpm payload migrate:up` или вручную `ALTER TABLE`.

### CI / автоматический деплой

После merge в `main` запускается GitHub Action `.github/workflows/deploy-prod.yml`:

1. Workflow `CI` (`.github/workflows/ci.yml`) — typecheck, lint, test:int, build, E2E smoke.
2. Если зелёный — триггерится `Deploy to production`:
   - safety net: если в коммите новые `web/src/migrations/*.ts` — фейлит ДО билда (миграции применяются вручную через `/sql` ДО merge);
   - SSH-логин на прод по ключу из secret `SSH_PRIVATE_KEY`;
   - `git pull` → `scripts/safe-build.sh` → `scripts/wait-build.sh` → `systemctl restart gonba`;
   - smoke-проверки на 127.0.0.1:3000 и публичный CDN.
3. **На падении** — выгружает `journalctl -u gonba` и `gonba-build` в output, **НЕ откатывается**. Разработчик заходит руками и чинит, потом перезапускает workflow через UI Actions → Deploy to production → Run workflow.

**Один раз настроить secret:**

```bash
# из локалки (где лежит ~/.ssh/id_ed25519_gonba_deploy — см. раздел «SSH deploy-key — ротация»)
gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519_gonba_deploy
```

Используется **изолированный** ed25519-ключ, авторизованный только на прод-сервере GONBA — не на других серверах разработчика. Утечка secret не открывает доступ к чужим серверам. См. раздел «SSH deploy-key — ротация» ниже про регулярную замену.

**Ручной trigger** (когда workflow_dispatch):
- Actions → Deploy to production → Run workflow → branch `main`.
- Используй после ручного фикса failure: пофиксил → push в main → CI прошёл → второй раз CI не нужен, дёрни deploy руками.

**Slash-команда `/reliz`** остаётся актуальной для случаев, когда нужен ручной контроль (миграции, сложные релизы, hot-fix без прохождения CI). Workflow и `/reliz` идемпотентно совместимы — оба идут через `safe-build.sh`.

### SSH deploy-key — ротация

| Параметр | Значение |
|---|---|
| Файл (локально) | `~/.ssh/id_ed25519_gonba_deploy` |
| GH Action secret | `SSH_PRIVATE_KEY` в репо `Valstan/Gonba` |
| Авторизован на | `valstan@831d0ce99bdf.vps.myjino.ru:~/.ssh/authorized_keys` (только GONBA-сервер) |
| **Создан** | **2026-05-22** |
| **Период ротации** | **90 дней** |
| **Следующая ротация не позднее** | **2026-08-20** |

Команда `/start` проверяет возраст ключа: если осталось < 10 дней до дедлайна — выводит **🟡 напоминание о ротации** в отчёте сессии.

> Таблица выше — **основной** ключ (домашняя машина + GH Action secret `SSH_PRIVATE_KEY`), которым ходит CI-деплой. Создан 2026-05-22.

**Доп. авторизованные ключи dev-машин** (отдельные keypair'ы с тем же именем файла, каждый — свой, в `authorized_keys` прода):

| Машина | comment в `.pub` | Авторизован | Примечание |
|---|---|---|---|
| Windows-dev (`HOME-PC`) | `gonba-deploy@HOME-PC-20260529` | 2026-05-29 | passphraseless, alias `GONBA` через `IdentityFile ~/.ssh/id_ed25519_gonba_deploy` + `IdentitiesOnly yes`. **НЕ** в GH secret (только локальный SSH). На этой машине generic `id_ed25519` — ключ MatricaRMZ-сервера, для GONBA не авторизован. |

Если при security-аудите в `authorized_keys` встретится `gonba-deploy@HOME-PC-*` — это легитимный dev-ключ, не компрометация (ср. cleanup dispatch #0007).

**Процедура ротации** (примерно 10 минут):

```bash
# 1. Сгенерить новую пару (старую затирает -y подтверждением)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_gonba_deploy -N '' -C "gonba-deploy@$(hostname)-$(date +%Y%m%d)"

# 2. Залить публичный на прод
PUBKEY=$(cat ~/.ssh/id_ed25519_gonba_deploy.pub)
ssh GONBA "grep -qxF '$PUBKEY' ~/.ssh/authorized_keys || echo '$PUBKEY' >> ~/.ssh/authorized_keys"

# 3. Проверить новый ключ
ssh -o BatchMode=yes GONBA "echo OK"

# 4. Убрать старый публичный ключ из authorized_keys (СПРОСИТЬ пользователя)
# ssh GONBA "sed -i '/<fingerprint old>/d' ~/.ssh/authorized_keys"

# 5. Обновить GH secret
gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519_gonba_deploy

# 6. Триггернуть workflow_dispatch для проверки
gh workflow run "Deploy to production" --repo Valstan/Gonba

# 7. Обновить даты в этой таблице (Создан, Следующая ротация)
```

См. также cross-project pool: [`../brain_matrica/cross-project-ideas/ideas/002-ssh-deploy-key-rotation.md`](../../brain_matrica/cross-project-ideas/ideas/002-ssh-deploy-key-rotation.md) (meta-репо [`brain_matrica`](https://github.com/Valstan/brain_matrica)).

### Docker (локально)

`web/docker-compose.yml` поднимает:

- Node.js приложение
- Postgres 16

Запуск:

```bash
cd /home/valstan/GONBA/web
cp .env.example .env
docker compose up
```

## Важные правила разработки (Payload CMS)

Следовать правилам из `web/AGENTS.md`:

- **Типизация**: TypeScript-first, после изменений схем запускать `generate:types`
- **Безопасность Local API**: при `user` всегда ставить `overrideAccess: false`
- **Hooks**: всегда передавать `req` в вложенные операции
- **Предотвращение циклов**: использовать `context` флаги
- **Компоненты**: после изменений UI — `generate:importmap`

## Нюансы и особенности

- Админка Payload живет в том же Next.js приложении.
- Для Yandex.Disk API используются отдельные маршруты `/yadisk-api/*`.
- Роли в `requireAdmin`: `admin` и `manager`.
- Медиа из Payload сохраняется на Yandex.Disk (после ADR-0001 Implemented 2026-05-22 — Я.Диск primary, локалка = TTL-кэш через `/api/media/file/[id]` proxy).
- Для защитной миграции orphan-записей без `yandexPath` — `pnpm run media:migrate-yadisk` (idempotent, поддерживает `--dry`).
- Превью для файлов Диска отдается через `/yadisk-api/preview` (иначе приватные ссылки дают 403).
- Для корректной работы `next/image` на проде должен быть задан `NEXT_PUBLIC_SERVER_URL` (домен продакшена).
- Для защиты от ручных перемещений на Диске медиа периодически сверяется по `resource_id` (на чтении документа).
- Проект уже содержит интеграции и готовые сервисы — **не создавать новые велосипеды**, сначала искать существующую реализацию в `web/src/server/`, `web/src/endpoints/`, `web/src/utilities/`.
- `sudo` **беспарольный** и его можно использовать.
- Перед каждым релизом **желательно прогонять тесты** (`pnpm test`).
- Для стабильных релизов использовать чеклист: `docs/RELEASE_STABILITY_CHECKLIST.md`.
- После значимых изменений в структуре проекта **обновлять эту документацию**, чтобы сохранять актуальную линию разработки.

