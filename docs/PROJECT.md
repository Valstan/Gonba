# GONBA — проектная документация

Цель этого документа — дать следующей сессии разработки с нейросетью быстрый и точный контекст: где что лежит, какие сервисы и функции уже есть, какие переменные окружения используются, и какие правила критичны для стабильной работы проекта.

Сессию назови "ГОНЬБА 13 апреля" (вместо 13 апреля поставь текущую дату)

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

- `Pages`, `Posts`, `Projects`, `Events`, `Services`, `Products`, `Orders`, `Bookings`, `Media`, `Categories`, `Users`
  - см. `web/src/collections/*`

Глобалы:

- `Header`, `Footer` (см. `web/src/Header`, `web/src/Footer`)

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

## Переменные окружения

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
- `pnpm run yadisk:sync` — разовая синхронизация локальных медиа на Yandex.Disk
- `POST /yadisk-api/sync` — сверка/обновление Yandex-метаданных медиа батчами (admin/manager)
- `tsx scripts/russify.ts` — русификация/seed контента (см. `web/scripts/russify.ts`)

## Деплой

### Удалённый доступ к серверу (SSH)

Настроено SSH-подключение к production-серверу через конфигурацию на локальном компьютере:

- Файл конфигурации: `C:\Users\Valstan\.ssh\config`
- Хост: `GONBA`
- Сервер: `831d0ce99bdf.vps.myjino.ru:22`
- Пользователь: `valstan`
- Ключ: `~/.ssh/id_rsa`

**Для нейросетей-разработчиков**: ты можешь подключаться к серверу через SSH, используя алиас `GONBA`. Это позволяет:

- Управлять сервисом (`sudo systemctl status/restart/stop gonba`)
- Просматривать логи (`journalctl -u gonba -f`)
- Обновлять код (`cd /home/valstan/GONBA && git pull`)
- Собирать и деплоить новые версии
- Выполнять любые команды на сервере

Примеры команд:

```bash
# Проверить статус сервиса
ssh valstan@GONBA "sudo systemctl status gonba.service --no-pager -l"

# Перезапустить сервис
ssh valstan@GONBA "sudo systemctl restart gonba"

# Посмотреть логи
ssh valstan@GONBA "journalctl -u gonba -n 50 --no-pager"

# Обновить код из репозитория
ssh valstan@GONBA "cd /home/valstan/GONBA && git pull && npm run build && sudo systemctl restart gonba"
```

### Systemd (production)

Сервис в системе: `gonba.service`

Основные шаги:

1. `npm install`
2. `npm run build`
3. `sudo cp deploy/systemd/gonba-web.service /etc/systemd/system/gonba.service`
4. `sudo systemctl daemon-reload`
5. `sudo systemctl enable --now gonba`
6. Перезапуск: `sudo systemctl restart gonba`
7. Логи: `journalctl -u gonba -f`
8. Переменные окружения на проде: `EnvironmentFile=-/home/valstan/GONBA/web/.env`

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
- Медиа из Payload сохраняется на Yandex.Disk (локально — только временно для загрузки).
- Для миграции и сверки после ручных перемещений на Диске запускать `pnpm run yadisk:sync`.
- Превью для файлов Диска отдается через `/yadisk-api/preview` (иначе приватные ссылки дают 403).
- Для корректной работы `next/image` на проде должен быть задан `NEXT_PUBLIC_SERVER_URL` (домен продакшена).
- Для защиты от ручных перемещений на Диске медиа периодически сверяется по `resource_id` (на чтении документа).
- Проект уже содержит интеграции и готовые сервисы — **не создавать новые велосипеды**, сначала искать существующую реализацию в `web/src/server/`, `web/src/endpoints/`, `web/src/utilities/`.
- `sudo` **беспарольный** и его можно использовать.
- Перед каждым релизом **желательно прогонять тесты** (`pnpm test`).
- Для стабильных релизов использовать чеклист: `docs/RELEASE_STABILITY_CHECKLIST.md`.
- После значимых изменений в структуре проекта **обновлять эту документацию**, чтобы сохранять актуальную линию разработки.

