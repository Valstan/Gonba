# Pending follow-ups

Открытые задачи, техдолги и идеи. Свежие сверху.

**Приоритеты:**
- 🔴 **блокер** — прод сломан / нельзя двигаться дальше / безопасность
- ⏳ **в процессе** — начато, не дозавершено
- 🟡 **техдолг** — работает, но «костыль» / непрозрачно / повторение боли
- 🟢 **идея** — улучшение качества жизни, не критично

При закрытии — отмечай запись `✅ Сделано` (с PR/коммитом) прямо здесь; хронология живёт в `git log` + теле PR ([ADR-0007](adr/0007-archive-development-log.md)).

---

## 🔴 Блокеры

_Сейчас нет._

---

## ⏳ В процессе

_Сейчас нет — все начатые задачи в текущей сессии задеплоены и подтверждены._

---

## 🟡 Техдолги

- ⏳ **On-site редактирование контента/интерфейса** (нитка с 2026-06-01, план `docs/plans/inline-onsite-editing.md`). **На проде:** вход в шапке (#71), правка постов (#71/#72/#74), плашек проектов (+fix 500 #72), текст страниц (#77), меню шапки (#75), `MediaPicker` + дедуп по sha256 (#72/#76). **В этом релизе:** картинки на страницах — обложка (hero) + `mediaBlock.items[].media` + `gallery.items[].image` inline в `PageEditor` (замена/выбор из загруженных, depth=0 round-trip, `InlineImage allowRemove`). **Осталось:** футер (PR4b — нужен новый глобал `footer` + миграция, делать на машине с рабочей локальной БД); inline-правка project-detail страниц; **мини-follow-up по картинкам страниц:** правка подписей (`caption`) и добавление/удаление элементов массивов (сейчас только замена — required-поля). Текст-конвертер `lexical-lite` — следить за round-trip. Детали — `SESSION_HANDOFF.md`.

- ~~🟡 **500 при сохранении проекта + пустой /admin/collections/projects**~~ **✅ Сделано 2026-06-01** — дрейф схемы версий: `_projects_v` не хватало 6 `version_*`-колонок (миграция 20260525_080000 добавила их только в `projects`). ALTER применён на проде + миграция `20260601_120000` в репо.

- 🟡 **Медиа-библиотека: дедуп / слияние дублей / связи / безопасное удаление** — план-памятка `docs/plans/media-library-integrity.md`. Phase A (выбор существующей картинки) сделано; B (дедуп при загрузке по `yandexSha256`), C (usage-связи + safe-delete с заменой), D (слияние дублей) — отдельными PR. Не блокер.

- ~~🟡 **Deploy guard по содержимому (stale ISR-prerender).**~~ **✅ Сделано 2026-05-30** (PR fix/deploy-stale-prerender-guard). Контекст: 2026-05-30 деплой PR #55 прошёл «успешно» (CI зелёный, build success, smoke-checks HTTP 200), но `/` отдавал **старый prerender** (этно-страница вместо карусели). Реализовано: (а) в `.github/workflows/deploy-prod.yml` новый шаг smoke-check проверяет *маркер* `homeOrbit__itemWrap` в ответе локального `/` (минует CDN-кэш) — HTTP 200 больше не считается достаточным; (б) в `scripts/safe-build.sh` после `rm -rf .next` добавлен guard `[ -d .next ] && exit 1`. Догфуд: логика guard'а прогнана против live-прода (COUNT=8, passes). Урок и детали — DEV_LOG 2026-05-30; шеринг — `mailbox/to-brain/2026-05-30-orbit-raf-and-stale-prerender.md`.

- ~~⚠️ **Директива brain #008 — секреты вне дерева репо**~~ **✅ Сделано 2026-05-30** (PR chore/secrets-outside-repo) — прод-секреты в `/etc/gonba/gonba.env` (root:valstan `0640`), 3 юнита + `scripts/safe-build.sh` через `EnvironmentFile=`, [ADR-0005](adr/0005-secrets-outside-repo-tree.md), feedback brain'у. См. DEV_LOG 2026-05-30. Pool [#008](../../brain_matrica/cross-project-ideas/ideas/008-secrets-outside-repo.md).

- ⏳ **Дрейф репо↔прод systemd-юнитов** (обнаружено 2026-05-30 при #008). **Репо-часть закрыта 2026-06-01** (PR chore/systemd-units-repo-prod-sync): репо-файл `gonba-web.service` → `gonba.service` (имя 1:1 с установленным), маппинг-таблица всех юнитов + дрейф-заметка в `docs/PROJECT.md → Systemd (production)`, исправлены устаревшие ссылки в `deploy/README.md` (`gonba-web` → `gonba`, `web/.env` → `/etc/gonba/gonba.env`). Подтверждено по SSH: домен-vars (`NEXT_PUBLIC_SERVER_URL`/`PAYLOAD_PUBLIC_SERVER_URL`) **уже есть в `/etc/gonba/gonba.env`** и передаются в build через `safe-build.sh -p EnvironmentFile=` → inline `Environment=` в проде **избыточны**.
  - **Остаток (опционально, прод + restart, под OK владельца):** убрать дублирующие inline `Environment=NEXT_PUBLIC_SERVER_URL/PAYLOAD_PUBLIC_SERVER_URL` из установленного `/etc/systemd/system/gonba.service` (готовая команда — в дрейф-заметке `docs/PROJECT.md`). Не блокер: дубль безвреден (значения идентичны).

- 🟢 **Удалить бэкап `/home/valstan/gonba.env.bak-20260530`** после того как следующий деплой подтвердит успешный build с новым `safe-build.sh` (`-p EnvironmentFile=`). До этого — оставить как путь отката для #008.

---

## 🟢 Идеи

### Удобство разработки

- **CI deploy step** — `.github/workflows/deploy-prod.yml` через `workflow_run` после успешного CI на `main`. SSH-ключ — общий `id_ed25519`. На failure — НЕ роллим, выгружаем `journalctl` и фейлим. Миграции остаются ручным шагом ДО merge (safety net в workflow проверяет наличие новых `web/src/migrations/*.ts`). (Сделано — см. `docs/PROJECT.md → CI / автоматический деплой`.)
- ~~**Hook на `git commit`** — напоминает обновить `DEVELOPMENT_LOG.md`~~ **Упразднён 2026-05-31** вместе с самим журналом ([ADR-0007](adr/0007-archive-development-log.md)): `git rm scripts/git-hooks/prepare-commit-msg`. `scripts/install-git-hooks.sh` остался как generic-инфра для будущих хуков.
- **Команда `/check`** — одной кнопкой `health-check`: dev local up? Prod /api/health? Git состояние? TypeScript? Lint? (Сделано — см. `.claude/commands/check.md`.)
- **Команда `/sql`** для безопасного выполнения SQL на проде через SSH с диалогом-подтверждением (учитывая что Auto-mode classifier режет direct ALTER без warning). (Сделано — см. `.claude/commands/sql.md`.)
- **Скрипт `scripts/dev-doctor.sh`** проверяет окружение (Postgres, .env, node_modules, payload-types, importMap, SSH alias `GONBA`, git hooks). (Сделано — `bash scripts/dev-doctor.sh`.)
- **ADR (Architectural Decision Records)** в `docs/adr/` для важных решений. Заведены 3 первых ADR (Yandex.Disk vs S3; гибридные миграции; build через systemd-run). Заводить новые — по мере появления значимых решений (формат — см. `docs/adr/_template.md`).
- **Smoke tests E2E через Playwright** — `web/tests/e2e/frontend.e2e.spec.ts` покрывает главную, /posts, /search, /projects, переход в проект. CI workflow гонит их перед каждым merge. Admin-сценарии (логин, /admin/yadisk, создание VK-источника) — в `admin.e2e.spec.ts`, запускаются локально через `pnpm test:e2e`; добавление в CI требует отдельной admin-seed-инфраструктуры. (Frontend сделано — см. фаза B; admin — отдельная задача.)
- **Изолированный SSH deploy-ключ + ротация** — `~/.ssh/id_ed25519_gonba_deploy`, период 90 дней, следующая ротация 2026-08-20. Внедрено 2026-05-22 (см. `docs/PROJECT.md → SSH deploy-key — ротация` и cross-project pool в [`../brain_matrica/cross-project-ideas/`](../../brain_matrica/cross-project-ideas/), идеи 001 + 002). Аналогичное стоит применить к MatricaRMZ (всё ещё на общем `id_ed25519`) — в его собственной сессии.

### Архитектура / Media

- ~~**Довести ADR-0001 до конца: Media-коллекция → Яндекс.Диск как единственный источник правды.**~~ **Сделано 2026-05-22** — ADR-0001 → `Implemented`, см. план [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md) и PR #24 + #26 + #27 + #28 + #29. Я.Диск primary, локалка = TTL-кэш 30 дней через `/api/media/file/[id]` proxy. Подробности — в `DEVELOPMENT_LOG.md` блоках 2026-05-22 (фазы 1-7).

- **Follow-ups из нитки (mini-задачи):**
  - **Rename Media-документа** после Phase 3 не работает с автозаливкой (`afterChange` не находит локала). Solution: `moveYandexResource(oldYandexPath, newYandexPath)` в случае `filenameChanged && previousDoc.yandexPath`. Низкая вероятность, отдельный мини-PR.
  - ~~**`web/scripts/yadisk-sync-media.ts`** (ручной batch sync)~~ **Выпилен 2026-05-22** — `media:migrate-yadisk` полностью покрывает заливку, restore локала противоречит phase-3.
  - **62 orphan-файла** в `public/media` (есть на FS, нет записи в БД). Скрипт `scripts/find-orphan-media.ts` — найти, показать, опционально удалить.
  - **Retry в фоне** при `yandexError` (для тех редких записей где afterChange упал) — нужен ли, exponential backoff? Сейчас: ошибка пишется в `yandexError`-поле, ручной retry через редактирование документа в админке.

### Этно-модерн редизайн (нитка с 2026-05-23)

- 🟢 **Главная вернулась к орбит-карусели** (ADR-0006, 2026-05-30) — этно-лендинг переехал на `/usadba`. PR4 (PeopleSection/CraftsSection/ShopBanner/EventsList) теперь относится к странице `/usadba`, не к `/`. Карусель переписана (rAF + единая `--orbit-rot`), кружки 1:1 через `Projects.showInOrbit`. См. DEV_LOG 2026-05-30.

- 🟢 **`/projects?group=` фильтр — реализован** 2026-05-30 (`projects/page.tsx` читает `searchParams`, фильтрует по `homepageGroup`). Раньше пункты шапки/футера/EthnoGroupCards вели в полный каталог.

- ~~🟢 **Чистка мёртвого admin-CSS орбиты** в `globals.css`~~ **✅ Сделано 2026-05-31** (PR refactor/orbit-dead-css) — удалён мёртвый блок inline-редактора карусели (`.homeOrbit.is-editing`, `__adminFooter/__adminButton`, `__editPanel*`, `__centerQuickPick*`, `__reorder*`, `__mediaModal*`, `__mediaCard*`, `__saveMessage/__saveError`) + мёртвые `@media (max-width: 620px/360px)` для `.homeOrbit*` (орбита `hidden md:block` → ниже 768px скрыта) + пилюли `__itemTitle/__centerTitle` (заменены arc-labels в #61). Итого −321 строка, 0 ссылок на удалённое в `web/src`. **Важно:** `@keyframes orbit-spin/orbit-counter-spin` НЕ удалены — их вернули к жизни в #62 (используются `__ring`/`__itemInner` для вращения); старая заметка успела устареть.

- **Drawer-подменю Header → перенести из хардкода в Payload** (актуально — 2026-05-30 чинили битые слаги в drawer'е вручную; data-driven решил бы дрейф навсегда). Сейчас drawer и подзаголовки (`«над рекой, 6 номеров»`) — хардкод по [`gonba-home.html`](design/handoff-2026-05-23/gonba-home.html) строки 191-298. Альтернативы: nested array `subItems` в `Header` global (расширение схемы в `web/src/Header/config.ts`), либо динамика — рендер по `Projects` с фильтром `where.homepageGroup.equals.<...>`. Не блокер — кодить через хардкод проще, перенос делается когда захочется редактировать структуру drawer'а через админку. Сейчас в PR1 drawer и подзаголовки (`«над рекой, 6 номеров»`) — хардкод по [`gonba-home.html`](design/handoff-2026-05-23/gonba-home.html) строки 191-298. Альтернативы: nested array `subItems` в `Header` global (расширение схемы в `web/src/Header/config.ts`), либо динамика — рендер по `Projects` с фильтром `where.group.equals.<...>`. Не блокер — кодить через хардкод проще, перенос делается когда захочется редактировать структуру drawer'а через админку.

- 🟢 **SQL prod-redesign-config — частичный backfill** — скрипт `scripts/sql/2026-05-23-prod-redesign-config.sql` применён 2026-05-25 (см. DEV_LOG), но только 3 из 13 ожидаемых UPDATE'ов сработали из-за расхождения slug'ов с baseline'ом brain'а. Маппинг:
  | Baseline (brain 2026-05-23) | Реально в БД на 2026-05-25 |
  |---|---|
  | `eco-hotel` | `eco-hotel-booking` + `eco-hotel-vyatka` (дубль?) |
  | `workshops` | `craft-workshops-gonba` |
  | `excursions` | `district-excursions` |
  | `horse-club` | `konnyy-klub-gmalyzh` |
  | `gulfia` | `sadovaya-feya-gulfiya-kharisovna` |
  | `events` | `village-events` |
  | `vyatskaya-lepota` | `vyatskaya-lepota-malmyzh` |
  | `village-and-temple` | ✓ совпало |
  | `vyatskiy-sbor` | ✓ совпало |
  | `about-project` | ✓ совпало |

  Что осталось backfill'ить: `gallery_yandex_folder` для 6 проектов + `chat_enabled = true` для 4 «бронирование» проектов. Не блокер. Решено: оставить как есть (см. сессия 2026-05-25 DEV_LOG).

- ~~**Маппинг 10 проектов на этно-группы**~~ **Сделано 2026-05-25** — см. PR #46 (`scripts/sql/2026-05-25-project-ethno-mapping.sql`). 11 проектов получили `homepage_group`, hero+featured = `village-and-temple`. Поля `kind` распределены (project×8, studio×3, person×1, shop×1).

### VK auto-sync (не блокер, обнаружено 2026-05-25)

- ~~**VK source #3 (Студия «Вятская Лепота»)** — `last_error = "Следующее поле недействительно: slug"`~~ **✅ Закрыто 2026-05-29** (PR [#50](https://github.com/Valstan/Gonba/pull/50) + verify) — slug-фикс DB-подтверждён рабочим: источник #3 (группа 229392127) импортирует с устойчивым slug `vk-229392127-414-...`, `last_sync_status=success`. Дубль поста 414 (старый id 154) удалён. См. DEV_LOG 2026-05-29.

- 🟡 **VK source #5 (Садовая Фея Гульфия Харисовна)** — **это личная страничка (user page), не группа** (уточнено 2026-05-25). Текущий код (`web/src/server/integrations/vk-auto-sync-resolve.ts` + `vk-auto-sync.ts`) умеет работать только с группами: `parseVkCommunityIdentifier` распознаёт user-URL'ы (например `https://vk.com/id86086407`) как `groupId` если число, или как `screenName`, но `fetchVkGroupMeta` вызывает только `groups.getById` — для user'ов нужно `users.get`. И `wall.get` использует `owner_id: -groupId` (отрицательный для групп) — для user'ов нужен **положительный** `user_id`. **Решение** (отдельным PR): (а) расширить `parseVkCommunityIdentifier` чтобы возвращать `kind: 'group' | 'user'`, (б) добавить `fetchVkUserMeta` через `users.get`, (в) в `fetchVkPosts` использовать `owner_id: ${kind === 'user' ? '' : '-'}${id}`. Не блокер — источник просто не работает, ошибок прода не вызывает.

- ⏳ **Мониторинг протухания VK-токенов.** Токены в env (`VK_TOKEN_VALSTAN`/`VK_TOKEN_VITA`) сдохли 27 мая и auto-sync молча не работал **2.5 дня** — заметили только при verify. `last_sync_status=error` пишется в БД, но никто не смотрит.
  - **Сделано 2026-06-01** (PR fix/vk-sync-health-alert): `SyncResult.status` (`success`/`error`/`no-new-posts`/`skipped`/`pending`); `syncAllVkSources` при «ни один опрошенный источник не отработал успешно» пишет громкий greppable-маркер `payload.logger.error('[vk-auto-sync] VK_SYNC_ALERT: …')` → тихий сбой стал видимой строкой в journalctl. Trigger-эндпоинт возвращает `errorCount`.
  - **Остаток (отдельно):** (а) **канал алерта** — навесить на `VK_SYNC_ALERT` реальное уведомление (journald `OnFailure=`/письмо/health-флаг в `/api/health`) — нужно инфра-решение владельца; (б) **N-подряд-провалов** вместо per-run (сейчас маркер пишется на каждом «все упали» прогоне; для дедупа алертов хранить счётчик последовательных провалов). Не блокер — маркер уже ловит инцидент.

- ~~🟢 **`last_error` не очищается при `success`.**~~ **✅ Сделано 2026-05-31** (PR fix/vk-clear-last-error) — `lastError: null` добавлен во все три «здоровых» ветки `syncVkSource` (no-new-posts, idempotent-success, created-success). Старый текст ошибки больше не висит рядом со `status=success`. typecheck чистый.

- 🟢 **Idempotency VK-постов по `(ownerId, postId)`, а не по slug.** Текущий idempotency-check PR #50 ищет существующий пост по новому slug'у — при смене формата slug'а (как 19→25 мая) старый импорт не находится и создаётся дубль. Корневой фикс: дедуп по стабильному внешнему ключу `(ownerId, postId)` (хранить в поле Post или искать по префиксу slug `vk-<groupId>-<postId>`). Тогда смена формата текст-суффикса не плодит дубли. Отложено пользователем 2026-05-29.

### Windows dev-setup (обнаружено 2026-05-25)

- 🟡 **Postgres 16 → 17 миграция на dev-машине** — пользователь снёс PG16, на компе теперь PG17. `web/.env` шаблон `postgres:postgres@127.0.0.1:5432/gonba` не работает потому что:
  1. На 5432 теперь PG17 с другим паролем (не `postgres`)
  2. БД `gonba` могла остаться в pg_data PG16 (удалена), на PG17 её может не быть
  3. `pgpass.conf` содержит два пароля: для 5432 (старый PG16, не работает) и 5433 (другой инстанс)

  **Варианты:**
  - **(а)** Restore из прод-дампа: `ssh GONBA "sudo -u postgres pg_dump -Fc gonba" > prod-gonba.dump`, потом `pg_restore -h 127.0.0.1 -U postgres -d gonba_new prod-gonba.dump` на локальный PG17. Обновить `.env` с актуальным паролем PG17.
  - **(б)** Пустая БД + `pnpm payload migrate` — для smoke-тестов кода без данных.
  - **(в)** Игнорировать локалку, тестить только через `preview_eval` / DOM-inspect / прод.

### Windows-dev quirks (нашли в сессии 2026-05-24 ч.4)

- 🟡 **`spawn UNKNOWN` в Payload на Windows + Node 22** — `getPayload({ config })` падает после 1-2 запросов. Проверено 3 раза, не лечится restart'ом. Гипотезы: sharp child-process, drizzle migrations, или Yandex trash cleanup (последнее — самое подозрительное при `YANDEX_DISK_TOKEN=placeholder`). **Что попробовать:** (a) downgrade Node до 20 (как на проде), (b) убрать `YANDEX_DISK_TOKEN` совсем, (c) запустить через docker-compose из `web/docker-compose.yml`. Не блокер — первый запрос всегда успешен, для разовых проверок достаточно cold-restart. Чинить когда будет регулярная dev-работа с этой машины.
- 🟢 **«Windows dev setup за 30 минут» — раздел в CLAUDE.md** на основе ч.4: Postgres portable (`get.enterprisedb.com/postgresql/postgresql-16.14-1-windows-x64-binaries.zip` → `C:\pgsql` → `initdb` → `pg_ctl start`), `pnpm config set script-shell` на git-bash, `pnpm install + generate:types + generate:importmap`. Сохранит ~30 минут будущим сессиям с новых машин.
- 🟢 **Claude-in-Chrome MCP** — `chromeExtensionEnabled` в Claude Desktop config переключён в `true` в ч.4. Проверить в следующей сессии что `mcp__claude-in-chrome__*` tools появились (нужен restart Claude Desktop). Если работает — задокументировать в CLAUDE.md как способ frontend-проверки без computer-use pixel-clicks.

### Продукт

- ~~**На `/projects` админский режим показывать предпросмотр изменений** перед сохранением (live preview).~~ (Сделано — `EditProjectDialog` рендерит общий `Plate` с локальным state, мгновенное обновление по мере правок.)
- ~~**Yandex Disk UI визуальный обход со скриншотами**~~: сделано — серия из 12 правок в PR #19, закрытие F1-F12 (см. `DEVELOPMENT_LOG.md` блок «Yadisk visual QA + polish»). Главная находка — Tailwind не подключался к `(payload)`-маршрутам; все utility-классы были «битыми». Решено отказом от Tailwind в admin-маршрутах в пользу собственного SCSS на site-vars.
- **VK auto-sync wizard-табы** — коллекция перестроена на Payload `tabs` field (4 шага: Источник VK → Привязка к сайту → Параметры импорта → Журнал). Sidebar со статусом виден на любом табе. (Сделано — без миграций БД, без кастомных компонентов.) Если когда-нибудь захочется именно step-by-step модалку с прогресс-баром — отдельная фаза.

---

## История пересечений

Если задача висела долго и пересекалась с несколькими сессиями — пиши тут историю переноса дат, чтобы было видно, что она «застряла».

_Сейчас пусто._
