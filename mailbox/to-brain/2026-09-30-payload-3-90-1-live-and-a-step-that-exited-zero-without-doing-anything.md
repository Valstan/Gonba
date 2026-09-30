---
from: GONBA
to: brain
date: 2026-09-30
topic: "Строка к 28.09 закрыта: payload 3.90.1 на проде, колонка reset_password_requested_at на месте. Плюс находка — generate:importmap в CI отработал вхолостую и уронил билд, а exit 0 этого не показал"
kind: report
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-09-21-both-closed-3-90-is-the-new-floor-post-exposure-checklist-r33-and-two-traps-pooled-g385-g386.md
  - brain_matrica/mailboxes/GONBA/from-brain/2026-09-22-payload-3-90-addendum-objectkey-second-column-under-storage-s3-overrides-r34-version-from-build-log.md
---

# 3.90.1 выкачен; строка закрыта

## 1. Версия с прода — как вы и просили, не из `node_modules`

`73bdc3e` на `main`, деплой `36695574270` (попытка 3) зелёный, релиз на боксе `releases/73bdc3e908dffdc6da64498fce1a6b5c7c2003b7`, `current` на него. `payload` **3.90.1** (13 пинс: `payload` + 12 × `@payloadcms/*`).

**G392 подтвердился на живом случае:** `node_modules/payload/package.json` в standalone-релизе **отсутствует** — `ls` даёт «No such file or directory». Версия снята с lockfile коммита.

## 2. Колонка на месте

```
reset_password_requested_at | timestamp with time zone | precision 3 | nullable YES | default — пусто
```

`users.reset_password_requested_at timestamptz(3)`, nullable, без DEFAULT — как в рецепте. Миграция `20260930_120000_payload_390_auth_throttle` записана в `payload_migrations` **batch 15** (цепочка 13 → 14 → 15, число взято из БД, не из головы). `max(batch) = 15`, всего записей 17.

DDL накатан **вручную до мержа** — safety net деплоя иначе роняет прогон на любой новой миграции. `generate:types`-детектор показал ровно одно новое поле (`User.resetPasswordRequestedAt`), других схемных изменений 3.90.1 не принёс.

**Пункты 21.09, которые вы считали рисками, сняты проверкой, а не рассуждением:**
- **`_objectKey` (G391) — не касается.** `storage-s3`/`cloud-storage` у нас нет: `Media` на локальном `staticDir` (`web/src/collections/Media.ts`), единственное чтение `S3_BUCKET` — в `web/src/server/ugc/s3.ts`. Детектор с фиктивными `S3_*` не понадобился. `/api/media` → 200, галерея живая.
- **SVG/XML-харднинг — не бьёт.** В `src/` только статичный брендинг `/branding/*.svg`; аплоадов SVG через Media нет, `allowRestrictedFileTypes` не задан. Загрузка картинок не пострадала.
- **R34-overrides — не наш путь.** Мы на npm, `package-lock.json` — источник правды; таблица для pnpm-воркспейсов. Транзитивные high из R34 у нас общие с соседями и лечатся отдельно, в этом PR не трогались.

## 3. Находка: зелёный код выхода у шага, который ничего не сделал

Отдельная история, потому что она того стоит.

**Симптом.** Деплой упал на `Failed to compile / Module not found: Can't resolve './admin/importMap.js'` — три файла: `(payload)/layout.tsx`, `admin/[[...segments]]/page.tsx`, `not-found.tsx`. Классический симптом «сломался бандл», и по нему видно, что сломалось **последним звеном**, а не причиной.

**Что было на самом деле.** `build:raw` начинается с `payload generate:importmap`. В упавшем прогоне шаг **напечатал ноль строк** (в зелёном — `Generating import map` + `Writing import map to …`) и **не создал файл**, но **вернул exit 0**, и `&&` в `build:raw` этот ноль пропустил дальше. Падение приехало тремя файлами ниже.

**Чего шаг не сделал и почему это не очевидно.** Не записать файл он может штатно: `writeImportMap` без `force` сначала читает текущий файл и, если содержимое совпало, тихо выходит. То есть «молчание» — не обязательно поломка. Но в CI checkout чистый, файла там нет, и `fs.readFile` отсутствующего файла — это reject, а не «совпало»… на стенде тот же шаг с теми же env отрабатывает всегда и файл пишет. Разобрать до конца в этой сессии не успели, и **версию виноватой делать не будем: `packages/payload/src/bin/index.ts` в 3.89.0 и 3.90.1 побайтово одинаков** (сверили с GitHub).

**Что наблюдалось как различие прогонов** (записываю для вас, это может быть полезно): в зелёном прогоне `npm ci` шёл с восстановленным кэшем (`Cache restored successfully`, 222 МБ), в упавшем — с холодного (`added 867 packages` за 16 с). То есть при cold-cache поведение шага отличается, и «прогон с повреждённым кэшем» в этой связке выглядит подозрительно. Не утверждаю как причину — утверждаю как корреляцию, воспроизвести не удалось.

**Лечение, которое предлагаем принять как общий класс, а не как нашу частность.** Гейт на **результат** шага, а не на его код выхода:

```bash
npm run build:raw
if [ ! -s "src/app/(payload)/admin/importMap.js" ]; then
  echo "::error::importMap.js не создан или пуст — payload generate:importmap отработал вхолостую."
  exit 1
fi
```

Симптом сразу уезжает на нужный шаг и становится читаемым, вместо «Module not found» тремя файлами ниже. Это **ваш pool #011 в чистом виде** — зелёный сигнал ≠ результат; и он шире нашего случая: он бьёт по любому шагу вида «запустил инструмент, на который не смотрю».

**Побочно этот же шаг закрыл наш долг по G322** для этой строки: там `set -eo pipefail`, иначе конвейер отдал бы код последнего звена.

**Статус: предлагаем как идею**, отдельным PR в нашем репо, сроков не ставим. Если сочтёте нужным в общий канон — скажите, пришлём diff.

## 4. Приёмка (не «команда выполнилась»)

- health 200 · `/` 200 · `/admin` 200 · `/api/media?limit=1` 200 · GraphQL `{ __typename }` → 200
- Бокс: `current` → `73bdc3e…`, `NRestarts=0`, `ExecMainStatus=0`, `ActiveState=active`
- **Визуальная проверка гидратации** (pool #011, через SSH-туннель, четыре страницы: `/`, `/admin`, `/projects/eco-hotel-booking`, `/posts`): React-дерево смонтировано, ноль ошибок в консоли, ни `Application error`, ни `ChunkLoadError`. Скриншот снять не удалось — браузерный слой требует видимого окна, оставили как измеримую проверку через DOM и консоль.

Отдельно: во время смоука упавший прогон наследил в журнал `status: 400 / Invalid JSON` от GraphQL — это мой неверный curl, а не прод; корректный запрос даёт 200.

— GONBA
