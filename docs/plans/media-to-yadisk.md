# Media → Я.Диск как единственный источник правды

**Связано:** [`ADR-0001`](../adr/0001-yandex-disk-as-media-storage.md), [`PENDING_FOLLOWUPS.md → 🟢 Архитектура / Media`](../PENDING_FOLLOWUPS.md), [`SESSION_HANDOFF.md`](../SESSION_HANDOFF.md).

**Создан:** 2026-05-22.

---

## Цель

Довести [ADR-0001](../adr/0001-yandex-disk-as-media-storage.md) до конца: коллекция `Media` хранит файлы **на Яндекс.Диске как primary**; локальный диск VPS — только **кэш с TTL 30 дней** от последнего обращения. Файлы отдаются через собственный proxy-endpoint `/api/media/file/[id]`, а не через прямые `disk.yandex.ru` ссылки.

---

## Выбранный подход

**B — доработка существующего гибрида.** ~80% инфраструктуры уже есть (`web/src/collections/Media.ts` с `afterChange`/`afterDelete`/`afterRead`-хуками + полный wrapper Я.Диск API в `yandex-disk.ts`). Альтернативы A (Cloud Storage plugin) и C (полная замена) — записаны в [`PENDING_FOLLOWUPS.md`](../PENDING_FOLLOWUPS.md), не выбраны (см. сессию 2026-05-22).

**Endpoint:** свой `/api/media/file/[id]` — проверяет локальный кэш → fallback на Я.Диск через `getDownloadUrl(yandexPath)` (приватная одноразовая ссылка по токену, не `yandexPublicUrl`) → стримит ответ клиенту + сохраняет в кэш. Стабильно при ротации публичных ссылок Я.Диска.

**Кэш:** TTL 30 дней с момента последнего обращения (`atime`/`mtime`). Cron раз в сутки чистит файлы старше TTL. Кэш-папка отдельная от `public/media` (например, `public/media-cache/` или `/var/lib/gonba-media-cache/`).

---

## Этапы

### Фаза 0 — Замеры (10 мин)

- [ ] Через `/sql` (read-only) — `SELECT count(*), count(yandex_path), count(*) FILTER (WHERE yandex_path IS NULL), count(yandex_error), pg_size_pretty(sum(filesize)::bigint) FROM media`
- [ ] На проде `ssh GONBA "du -sh /home/valstan/GONBA/web/public/media"`
- [ ] Зафиксировать в этом плане ниже («Baseline»)

### Фаза 1 — Proxy endpoint `/api/media/file/[id]` (4-6 ч)

- [ ] `web/src/app/(frontend)/api/media/file/[id]/route.ts` — GET handler:
  - Загрузить Media doc по id через Local API (с `overrideAccess: true`, depth 0)
  - Определить путь к кэшу: **проверять две локации** —
    1. `path.join(CACHE_DIR, doc.filename)` (новая кэш-папка, env `MEDIA_CACHE_DIR`)
    2. `path.join(LEGACY_MEDIA_DIR, doc.filename)` (`web/public/media/` — там лежат все 333 существующих файла)
  - **Если файл найден в любой** → обновить atime (`utimesAsync(now, now)`), стримить с диска + правильные headers (`Content-Type` из `doc.mimeType`, `Cache-Control: public, max-age=2592000, immutable` если id-based URL). Опционально: при hit'е в legacy перенести в новую кэш-папку через `rename` (eventually единая локация).
  - **Если нет** → `getDownloadUrl(yandexPath)` (приватная download URL по токену, не `yandexPublicUrl` — последний может быть устаревшим), `fetch(href)` → stream-piped в HTTP-ответ И параллельно в writeStream на диск через `tee`-pattern. На первой итерации можно проще: `fetch → ArrayBuffer → Response + writeFile`, оптимизируем стриминг во второй итерации
  - **Если `yandexPath` отсутствует** → fallback на стандартный Payload `staticDir` (для безопасности; по baseline таких записей сейчас 0, но защитимся)
  - 404 если doc не найден
- [ ] Rate-limit endpoint через `web/src/server/rate-limit` (один и тот же IP, тысячи запросов в минуту — отбиваем)
- [ ] `web/next.config.js` — добавить `images.remotePatterns` для `${NEXT_PUBLIC_SERVER_URL}/api/media/file/*` (или уже покрывается existing pattern для self origin — проверить)
- [ ] Unit/manual тест: вручную залить файл в админке → curl на `/api/media/file/<id>` → 200 + content + после второго запроса кэш-файл на диске. Также: запрос за существующей записью → должен отдать из legacy `public/media/` без round-trip к Я.Диску.

### Фаза 2 — `afterRead`-хук всегда отдаёт `/api/media/file/[id]` (1-2 ч)

- [ ] В `web/src/collections/Media.ts` упростить `afterRead`:
  - Удалить логику `LOCAL_MAX_BYTES` и проверки локального файла
  - Всегда: если есть `yandexPath` → `doc.url = '/api/media/file/' + doc.id`, `doc.thumbnailURL = doc.url`
  - Если `yandexPath` нет (старая запись до миграции) → оставить стандартный Payload URL (`/media/<filename>` через `staticDir`)
- [ ] Проверить что `next/image` рендерит правильно для и того и другого случая

### Фаза 3 — `afterChange`-хук удаляет локальный файл после успешной заливки — **сделано в PR2**

- [x] После `uploadLocalFileToYandex` + `publishYandexResource` + успешного `payload.update` с `yandex*` полями:
  - [x] **Безусловно** удалить `web/public/media/<filename>` (убрано условие `if (sizeBytes > LOCAL_MAX_BYTES)`)
  - [x] Если есть `imageSizes` derivatives — удалить и их (в коллекции сейчас `imageSizes: []`, цикл сохранён на будущее)
  - [x] Удалена константа `LOCAL_MAX_BYTES`/`LOCAL_MAX_MB` и переменная `sizeBytes` (стали неиспользуемыми)
- [x] При yandex-error: НЕ удалять локальный файл, оставить fallback через `staticDir`. Catch-блок не задевает удаление.
- [ ] Retry-в-фоне (если `yandexError` стоит — попробовать ещё раз при следующем обновлении документа) — **остаётся как follow-up**

**Следствия фазы 3 (новые):**

- **Rename Media-документа** перестаёт работать с автозаливкой: `afterChange` пытается читать локал по новому имени, но предыдущий файл уже удалён. Warning «Yandex sync skipped: file missing at X», doc сохранится без обновления `yandexPath`. Низкая вероятность в реальном использовании, но **записано как follow-up**: «rename-after-purge — использовать `moveYandexResource` вместо повторной заливки».
- **`web/scripts/yadisk-sync-media.ts`** (batch-sync, `pnpm run yadisk:sync`) всё ещё использует `LOCAL_MAX_BYTES`/`YANDEX_DISK_LOCAL_MAX_MB`. Скрипт ручной, редко запускается. **Follow-up:** согласовать с phase-3-семантикой (либо выпилить, либо честно мигрировать).

### Фаза 4 — Cron-чистка кэша по TTL — **сделано в PR3**

- [x] `web/scripts/clean-media-cache.ts`:
  - [x] Аргументы: `--dir <path>` (default из env `MEDIA_CACHE_DIR` → `./public/media-cache`), `--ttl-days 30`, `--dry`
  - [x] Использует `Math.max(atimeMs, mtimeMs)` — на Linux ext4 с `relatime` atime обновляется при чтении (endpoint вызывает `utimes` на cache-hit), на `noatime`-mount fallback на mtime
  - [x] Логирует scanned/eligible/removed/freed в MB
  - [x] Skip `.tmp.*` файлов (artefacts атомарного rename из endpoint'а)
  - [x] При отсутствии папки — log + exit 0 (нечего чистить)
- [x] `package.json` script `cache:clean`
- [x] `deploy/systemd/gonba-media-cache.{service,timer}` — daily 04:00 + `RandomizedDelaySec=30min` + `Persistent=true` (выполнит догоняюще если сервер был выключен в 04:00)
- [x] `docs/PROJECT.md` обновлён в разделе «Скрипты»

**Локальный smoke test:**

- TS-check clean
- `cache:clean --dir ./public/nonexistent --dry` → "Cache dir does not exist — nothing to clean"
- `cache:clean --dir <test-dir> --ttl-days 0 --dry` → корректно отметил оба тестовых файла eligible
- `cache:clean --dir <test-dir> --ttl-days 0` → оба файла удалены, папка пуста

**На прод — после merge PR3:**

```bash
# Активировать таймер на проде
ssh GONBA
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-media-cache.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gonba-media-cache.timer
systemctl list-timers gonba-media-cache.timer
```

### Фаза 5 — Миграция существующих записей — **сделано в PR4 (защитная сетка)**

По baseline 2026-05-22 фаза фактически no-op: все 333 записи на проде уже имеют `yandexPath`. Скрипт нужен как **защитная сетка** на случай новых orphan-записей и для PoC-теста ручного миграционного workflow.

- [x] `web/scripts/migrate-media-to-yandex.ts`:
  - [x] Аргументы: `--dry`, `--limit N` (batch size, default 50), `--id <id>` (одиночный), `--max N` (общий лимит, для частичных smoke-тестов)
  - [x] Pagination через `payload.find({page, limit})` с `where: { yandexPath: { exists: false } }`, sort by id
  - [x] Для каждой: проверить локальный файл → `uploadLocalFileToYandex` → `publishYandexResource` → `getYandexResource` → `getPublicDownloadUrl` → `payload.update` с полным набором `yandex*` полей (через `context.skipYandexSync` чтобы не задвоить через afterChange-хук)
  - [x] Idempotent: запись с `yandexPath` → `skipped`, без локала → `missing-local`, ошибка → `failed` + сохраняет `yandexError` в БД
  - [x] **Не** удаляет локальный файл — это сделает phase-3 `afterChange` на следующем update (или TTL-cron через 30 дней)
  - [x] Логирует через `payload.logger.info/warn/error` (pino), Summary в конце

**Локальный smoke test:**

- `--dry` без аргументов → "Found 0 candidate" (правильно — 319 записей в локальной dev-БД все имеют yandexPath, как и прод)
- `--id 319 --dry` → "[319] skip — yandexPath already set" + processed=1, skipped=1
- `--id 999999 --dry` → "Could not load media id=999999: Не найдено"
- TS clean

**На проде (после merge PR4) — PoC workflow:**

```bash
# 1. Dry-run на весь dataset (должен показать processed=0)
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk -- --dry"

# 2. Если появятся новые orphan-записи в будущем — запустить без --dry
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk"

# 3. Для PoC отдельной записи — сначала создать через админку без Я.Диск-синка
#    (как это симулировать — отдельный вопрос; обычно afterChange всё сделает сам)
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk -- --id <test-id> --dry"
```

### Фаза 6 — Cleanup и документация (1-2 ч)

- [ ] Удалить из `Media.ts` константу `LOCAL_MAX_BYTES` и связанную логику (после миграции не нужна)
- [ ] Удалить переменную окружения `YANDEX_DISK_LOCAL_MAX_MB` из `.env.example` и `docs/PROJECT.md`
- [ ] Добавить `MEDIA_CACHE_DIR` в `.env.example`, `docs/PROJECT.md` (раздел env)
- [ ] Обновить `ADR-0001` → статус `Implemented`, дата, ссылка на этот план
- [ ] Обновить `docs/PROJECT_STATE.md` → раздел про Media: «локальный диск = кэш TTL 30д, `/api/media/file/[id]` proxy»
- [ ] Закрыть запись в `docs/PENDING_FOLLOWUPS.md → 🟢 Архитектура / Media`, перенести в `DEVELOPMENT_LOG.md` текущей сессии

### Фаза 7 — Smoke check на проде (1 ч)

- [ ] Загрузить тестовое фото через `/admin` → видно файл на Я.Диске в `/admin/yadisk`
- [ ] На сайте отображается через `/api/media/file/<id>` (DevTools → Network)
- [ ] После первого запроса — кэш-файл на диске VPS (`ls /var/lib/gonba-media-cache/` или где разместим)
- [ ] Симуляция TTL: `touch -a -t 202604010000 <cache-file>` (поставить atime в апрель 2026 = >30 дней назад) → запустить `node scripts/clean-media-cache.ts --dry` → файл в списке для удаления
- [ ] Удалить документ Media в админке → удалить из Я.Диска (через `/admin/yadisk` проверить отсутствие)

---

## Baseline

Замер выполнен 2026-05-22:

| Метрика | Значение |
|---|---|
| `media.count(*)` | **333** |
| `media.count(yandex_path IS NOT NULL)` | **333** (100% — все уже на Я.Диске!) |
| `media.count(yandex_path IS NULL)` | **0** |
| `media.count(yandex_error IS NOT NULL)` | **0** |
| `sum(filesize)` (Postgres) | **404 MB** |
| `du -sh public/media` (FS) | **408 MB** |
| Файлов на FS | **395** (на 62 больше чем записей в БД → orphans) |

### Выводы из baseline

- **Фаза 5 (миграция существующих) — фактически no-op:** все 333 записи уже имеют `yandex_path`. Скрипт `migrate-media-to-yandex.ts` нужен только как «защитная сеть» на случай новых orphan-записей; основная работа уже сделана текущим `afterChange`-хуком.
- **Lazy migration через endpoint:** endpoint `/api/media/file/[id]` при поиске кэша должен проверять **две** локации: новую `MEDIA_CACHE_DIR` и старую `public/media/`. Существующие 333 файла уже лежат локально → endpoint их отдаст сразу, без round-trip к Я.Диску. Со временем (или принудительно через скрипт) — переместить из `public/media/` в кэш-папку для единообразия.
- **62 orphan-файла на FS** — техдолг. Возможные причины: остатки от удалённых записей (если `afterDelete` не удалял локальные копии до текущей логики), Payload-derivatives при ранних настройках `imageSizes`, ручные загрузки через FS минуя Payload. Добавлено в follow-ups (см. ниже).

---

## Текущий этап

**Этапы пройдены:** 0 (baseline), 1 (endpoint), 2 (afterRead), 3 (afterChange purges local), 4 (cache cron), 5 (migrate script).

**Готово к ревью и merge:**
- **PR1** ([#24](https://github.com/Valstan/Gonba/pull/24)) — proxy endpoint + afterRead
- **PR2** ([#26](https://github.com/Valstan/Gonba/pull/26)) — afterChange удаляет локал, stack на PR1
- **PR3** ([#27](https://github.com/Valstan/Gonba/pull/27)) — cache cron, stack на PR2
- **PR4** (stack на PR3) — migrate-media-to-yandex.ts (защитная сетка)

**Следующий шаг:** Фазы 6+7 — cleanup (`yadisk-sync-media.ts` под phase-3-семантику, опционально rename-after-purge), ADR-0001 → `Implemented`, прод-smoke. Это PR5.

### Что подтверждено локально

- TypeScript clean (`tsc --noEmit` exit 0 после правок)
- Dev-сервер поднимается без ошибок, `/api/health` → 200
- Endpoint `/api/media/file/319` с мок-файлом в `public/media/<filename>`:
  - HTTP 200, `X-Cache: HIT-LEGACY`, `Content-Type: image/jpeg` (из `doc.mimeType`), `Content-Length` из `fs.stat`, тело совпадает
- Endpoint без локального файла + локальный YANDEX_DISK_TOKEN недействителен → корректный 502 `Upstream storage error` (cache-miss → Я.Диск → ошибка)
- Endpoint с несуществующим id → 404 `Media not found`

### Что осталось проверить на проде (после деплоя PR1)

- Любая существующая запись Media → `X-Cache: HIT-LEGACY` (333 файла лежат в `public/media`, новой кэш-папки ещё нет, должен сработать legacy-фолбэк без round-trip к Я.Диску)
- Сайт продолжает рендерить картинки без визуальных регрессий (HTML теперь содержит `/api/media/file/<id>` вместо `/media/<filename>`)

---

## Подводные камни и решения

- **Public Y.Disk URL ротируется.** Поэтому **не** кэшируем `yandexPublicUrl`. Каждый раз когда нет файла в кэше — берём свежий приватный `getDownloadUrl(yandexPath)`. Endpoint всегда возвращает наш стабильный `/api/media/file/<id>`.
- **`relatime` на ext4.** Linux обновляет atime не чаще раза в сутки → для TTL 30д это норма. Если ФС смонтирована с `noatime` — будем использовать `mtime`, обновляя его при каждом hit'е кэша (`utimes`).
- **Параллельная запись в кэш.** Два запроса одного редкого файла одновременно — обе ветки пишут. Решение: писать во временный файл `<name>.tmp.<pid>`, потом `rename` (атомарно). Если rename проиграл — удалить tmp.
- **Я.Диск rate-limits.** При cold cache + всплеске трафика — упёрлись в лимиты. Решение в текущей нитке: in-memory dedup (если уже идёт запрос за тем же файлом — второй ждёт результата первого). Wide rate-limiting — отдельный follow-up, не сюда.
- **`next/image` + наш endpoint.** Endpoint должен возвращать корректный `Content-Type` (`image/jpeg`, `image/webp`, ...) — иначе `next/image` отдаст 500. Mime определяем из `doc.mimeType` (Payload его уже хранит).
- **Большие файлы.** Текущий код «если >50MB удалить локально» — после фазы 3 удаляем безусловно. Но нужно убедиться что endpoint умеет стримить большие файлы (не буферизует целиком). Решение: `Response` с `ReadableStream` body (Web Streams), а не `Buffer`.
- **Фаза 2 + старые записи.** Пока миграция не пройдёт, в БД есть записи без `yandexPath`. `afterRead` оставляет им стандартный `staticDir`-URL → они продолжают работать. После миграции все получают `/api/media/file/<id>`.

---

## Что НЕ делаем в этой нитке (записать как follow-ups)

- **Retry в фоне** при `yandexError` — нужен ли, как часто, exponential backoff. Сейчас: ошибка сохраняется в поле, ручной retry через редактирование документа.
- **Image-resize на лету** через `sharp` в endpoint — `next/image` пока справляется, делать не сейчас.
- **Nginx-level caching** для `/api/media/file/*` — нужно отдельное обсуждение (cache-key, headers, purge при удалении).
- **Деривативы** (`imageSizes`) Payload — сейчас пустой массив `imageSizes: []`. Если когда-нибудь включим — потребуется отдельная итерация (заливать все размеры на Я.Диск).
- **Объединить с `/yadisk-api/preview`** — этот endpoint обслуживает менеджер `/admin/yadisk`, имеет другие требования (приватные пути не в Media). Не трогаем.
- **62 orphan-файла в `public/media/`** (есть на FS, нет записи в БД). Отдельный скрипт `scripts/find-orphan-media.ts` — найти, показать список, опционально удалить с подтверждением. Не в этой нитке.
- **Rename-after-purge** (новое после Phase 3): когда пользователь переименовывает Media-документ, `afterChange` пытается перечитать локал по новому имени и видит — файла нет (мы его уже удалили). Нужно: распознать «это переименование уже-залитой записи» (`filenameChanged=true && previousDoc.yandexPath`) и сделать `moveYandexResource(oldYandexPath, newYandexPath)` + обновить `yandexPath` в БД. Без локала.
- **`web/scripts/yadisk-sync-media.ts`** (ручной batch sync, `pnpm run yadisk:sync`) использует `LOCAL_MAX_BYTES`/`YANDEX_DISK_LOCAL_MAX_MB`. После Phase 3 эта семантика устарела. Либо обновить скрипт под новую логику, либо выпилить если migrate-media-to-yandex (фаза 5) полностью покрывает его use-case.

---

## Разрезы по коммитам / PR

Один большой PR неудобно ревьюить. Предлагаю:

1. **PR 1 — фазы 1+2:** новый endpoint + `afterRead` на новые ссылки. Совместимо со старыми записями. Можно мерджить и проверять на проде без миграции.
2. **PR 2 — фаза 3:** удаление локального файла после успешной заливки. Поведение для новых файлов.
3. **PR 3 — фаза 4:** cron-чистка кэша.
4. **PR 4 — фаза 5:** скрипт миграции. **Запускаем вручную после ревью dry-run.**
5. **PR 5 — фазы 6+7:** cleanup, ADR, документация, финальный smoke check.

Каждый PR можно откатить независимо. Это даёт возможность увидеть проблемы на каждом шаге.
