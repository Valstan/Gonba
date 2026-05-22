# Pending follow-ups

Открытые задачи, техдолги и идеи. Свежие сверху.

**Приоритеты:**
- 🔴 **блокер** — прод сломан / нельзя двигаться дальше / безопасность
- ⏳ **в процессе** — начато, не дозавершено
- 🟡 **техдолг** — работает, но «костыль» / непрозрачно / повторение боли
- 🟢 **идея** — улучшение качества жизни, не критично

При закрытии — переноси запись в `DEVELOPMENT_LOG.md` (в текущий день).

---

## 🔴 Блокеры

_Сейчас нет._

---

## ⏳ В процессе

_Сейчас нет — все начатые задачи в текущей сессии задеплоены и подтверждены._

---

## 🟡 Техдолги

- **`authorized_keys` на GONBA-сервере содержит публичные ключи с MatricaRMZ и setka серверов** (`valstan@a6fd55b8e0ae`, `valstan@setka`). Обнаружено 2026-05-22 при ротации deploy-ключа. Цепочка компрометации: взяв любой из тех серверов → доступ на GONBA. Решение: либо удалить эти ключи если они не нужны для cross-server скриптов, либо если нужны — задокументировать зачем и оставить.

---

## 🟢 Идеи

### Удобство разработки

- **CI deploy step** — `.github/workflows/deploy-prod.yml` через `workflow_run` после успешного CI на `main`. SSH-ключ — общий `id_ed25519`. На failure — НЕ роллим, выгружаем `journalctl` и фейлим. Миграции остаются ручным шагом ДО merge (safety net в workflow проверяет наличие новых `web/src/migrations/*.ts`). (Сделано — см. `docs/PROJECT.md → CI / автоматический деплой`.)
- **Hook на `git commit`** — напоминает обновить `DEVELOPMENT_LOG.md` для `feat:/fix:/refactor:`-коммитов. `scripts/git-hooks/prepare-commit-msg` + `scripts/install-git-hooks.sh`. (Сделано — устанавливается одной командой `bash scripts/install-git-hooks.sh`.)
- **Команда `/check`** — одной кнопкой `health-check`: dev local up? Prod /api/health? Git состояние? TypeScript? Lint? (Сделано — см. `.claude/commands/check.md`.)
- **Команда `/sql`** для безопасного выполнения SQL на проде через SSH с диалогом-подтверждением (учитывая что Auto-mode classifier режет direct ALTER без warning). (Сделано — см. `.claude/commands/sql.md`.)
- **Скрипт `scripts/dev-doctor.sh`** проверяет окружение (Postgres, .env, node_modules, payload-types, importMap, SSH alias `GONBA`, git hooks). (Сделано — `bash scripts/dev-doctor.sh`.)
- **ADR (Architectural Decision Records)** в `docs/adr/` для важных решений. Заведены 3 первых ADR (Yandex.Disk vs S3; гибридные миграции; build через systemd-run). Заводить новые — по мере появления значимых решений (формат — см. `docs/adr/_template.md`).
- **Smoke tests E2E через Playwright** — `web/tests/e2e/frontend.e2e.spec.ts` покрывает главную, /posts, /search, /projects, переход в проект. CI workflow гонит их перед каждым merge. Admin-сценарии (логин, /admin/yadisk, создание VK-источника) — в `admin.e2e.spec.ts`, запускаются локально через `pnpm test:e2e`; добавление в CI требует отдельной admin-seed-инфраструктуры. (Frontend сделано — см. фаза B; admin — отдельная задача.)
- **Изолированный SSH deploy-ключ + ротация** — `~/.ssh/id_ed25519_gonba_deploy`, период 90 дней, следующая ротация 2026-08-20. Внедрено 2026-05-22 (см. `docs/PROJECT.md → SSH deploy-key — ротация` и `cross-project-ideas/ideas/001+002`). Аналогичное стоит применить к MatricaRMZ (всё ещё на общем `id_ed25519`) — в его собственной сессии.

### Архитектура / Media

- ~~**Довести ADR-0001 до конца: Media-коллекция → Яндекс.Диск как единственный источник правды.**~~ **Сделано 2026-05-22** — ADR-0001 → `Implemented`, см. план [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md) и PR #24 + #26 + #27 + #28 + #29. Я.Диск primary, локалка = TTL-кэш 30 дней через `/api/media/file/[id]` proxy. Подробности — в `DEVELOPMENT_LOG.md` блоках 2026-05-22 (фазы 1-7).

- **Follow-ups из нитки (mini-задачи):**
  - **Rename Media-документа** после Phase 3 не работает с автозаливкой (`afterChange` не находит локала). Solution: `moveYandexResource(oldYandexPath, newYandexPath)` в случае `filenameChanged && previousDoc.yandexPath`. Низкая вероятность, отдельный мини-PR.
  - **`web/scripts/yadisk-sync-media.ts`** (ручной batch sync) всё ещё использует `LOCAL_MAX_BYTES`/`YANDEX_DISK_LOCAL_MAX_MB`. Согласовать с phase-3-семантикой — либо обновить, либо выпилить если `media:migrate-yadisk` его полностью покрывает.
  - **62 orphan-файла** в `public/media` (есть на FS, нет записи в БД). Скрипт `scripts/find-orphan-media.ts` — найти, показать, опционально удалить.
  - **Retry в фоне** при `yandexError` (для тех редких записей где afterChange упал) — нужен ли, exponential backoff? Сейчас: ошибка пишется в `yandexError`-поле, ручной retry через редактирование документа в админке.

### Продукт

- ~~**На `/projects` админский режим показывать предпросмотр изменений** перед сохранением (live preview).~~ (Сделано — `EditProjectDialog` рендерит общий `Plate` с локальным state, мгновенное обновление по мере правок.)
- ~~**Yandex Disk UI визуальный обход со скриншотами**~~: сделано — серия из 12 правок в PR #19, закрытие F1-F12 (см. `DEVELOPMENT_LOG.md` блок «Yadisk visual QA + polish»). Главная находка — Tailwind не подключался к `(payload)`-маршрутам; все utility-классы были «битыми». Решено отказом от Tailwind в admin-маршрутах в пользу собственного SCSS на site-vars.
- **VK auto-sync wizard-табы** — коллекция перестроена на Payload `tabs` field (4 шага: Источник VK → Привязка к сайту → Параметры импорта → Журнал). Sidebar со статусом виден на любом табе. (Сделано — без миграций БД, без кастомных компонентов.) Если когда-нибудь захочется именно step-by-step модалку с прогресс-баром — отдельная фаза.

---

## История пересечений

Если задача висела долго и пересекалась с несколькими сессиями — пиши тут историю переноса дат, чтобы было видно, что она «застряла».

_Сейчас пусто._
