# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-06-03
**Branch:** main
**Last released version:** PR #93 (commit `cbce1b4`) — security: скрытые модерацией сообщения закрыты из публичного read Messages. Прод: health 200, авто-деплой OK, фикс подтверждён на проде (anon `?where[isModerated][equals]=true` → `totalDocs=0`).

---

## Текущая нитка

**Разбор бэклога (machine A, сессия 2026-06-03 вечер).** Прошли пред-согласованный список из 4 задач:

- **#93 (security) — ✅ смержен+задеплоен.** raw `GET /api/messages` отдавал тела `isModerated`-сообщений (collection `read: anyone`). Новый document-level access `messagesPublicRead`: staff видят всё, остальные → Where-фильтр `{ isModerated: { not_equals: true } }`. Дополняет field-level `adminOrEditorField` из #87 (теперь закрыто и тело, и метаданные). Юнит-тест 7 кейсов.
- **Media Phase B — оказалось уже сделано** 2026-06-01 (`mediaUpload.ts`). Проверено: дедуп универсален по всем сайт-редакторам. Поправлена устаревшая строка в `PENDING_FOLLOWUPS`.
- **#94 (footer cleanup) — ✅ готов, open, ждёт деплоя.** Убрано мёртвое `footer.navItems` + миграция `20260603_120000` (DROP таблиц/enum). **НЕ смержен** — несёт destructive DROP на прод.
- **Галерея #90/#91 — SSH-доверификация ✅.** Прод на коде, обе страницы 200 + маркер. Интерактивный click-through (логин редактором + Я.Диск) — owner-gated.

## Следующий шаг

1. **Деплой footer cleanup [#94](https://github.com/Valstan/Gonba/pull/94)** (destructive, под OK владельца) — миграция `20260603_120000` DROP'ает `footer_nav_items`/`footer_rels`/enum. Порядок (см. `deploy-prod.yml` safety-net): (а) `pg_dump` бэкап; (б) применить SQL на проде вручную (`up()` из миграции / `run-migrate.sh`) + `INSERT INTO payload_migrations`; (в) `gh pr merge 94 --squash`; (г) авто-деплой упадёт на safety-net (видит новый файл миграции) → запустить deploy через **workflow_dispatch** (guard пропускается); (д) проверить footer рендерится (description/columns/legalAddress), health 200. SQL round-trip уже провалидирован локально в ROLLBACK.
2. **Прод-доверификация галереи #90/#91** (owner-gated) — залогиниться редактором: `/projects/<slug>` («Мини-галерея») и `/projects/<slug>/gallery` — заменить файл / «Из загруженных» / подпись / +добавить / удалить → Сохранить → проверить рендер **и мгновенный refresh force-static `/gallery`** (валидирует `revalidateProject`). Нужны admin-сессия + Я.Диск-токен.
3. **Media Phase C** (следующий настоящий этап media-library, крупный) — usage-связи «где используется картинка» (read-only эндпоинт `GET /api/media/usage?id=...` с явной картой полей) + safe-delete с заменой. План `docs/plans/media-library-integrity.md`. Тестировать на копии прод-БД перед destructive-частями.

## Контекст

- **Планы:** [`media-library-integrity.md`](plans/media-library-integrity.md) (Phase B done → C/D todo), [`inline-onsite-editing.md`](plans/inline-onsite-editing.md) (основное на проде).
- **Связанные коммиты/PR сессии (2026-06-03, machine A):**
  - `cbce1b4` ([#93](https://github.com/Valstan/Gonba/pull/93), смержен) — `access/messagesPublicRead.ts` (document-level Where-фильтр) + Messages `read` + юнит-тест `messages-read-access.int.spec.ts`. Без миграций.
  - [#94](https://github.com/Valstan/Gonba/pull/94) (**open**, ветка `chore/footer-drop-navitems`) — `Footer/config.ts` (убран navItems+импорт link) + миграция `20260603_120000.ts` (DROP, reversible down реконструирован из live-DDL, pool #017) + seed/russify перестали сеять footer.navItems. typecheck/lint чистые, CI зелёный.
- **Прод:** ✅ на `cbce1b4`. Health 200. Security-фикс #93 подтверждён на проде. Прод имеет **0 чат-сообщений** сейчас (фикс preventive).
- **Dev-среда (machine A):** локальный Postgres :5433, БД `gonba`. `psql.exe` — `C:\Program Files\PostgreSQL\17\bin\psql.exe` (не на PATH; DATABASE_URL в `web/.env`). SSH-ключ `~/.ssh/id_ed25519_gonba_deploy` + alias `GONBA` есть. Я.Диск-токен локально = placeholder.
- **Открытые вопросы для владельца:** деплой #94 (destructive DROP, под OK); интерактивная верификация галереи (нужна сессия редактора); опц. прод-cleanup inline `Environment=` домен-vars в `gonba.service` (PENDING).

## Failed approaches (этой нитки)

_Отвергнутых подходов не было — все 4 задачи прошли с первого захода._ Заметка для будущих сессий: при удалении Payload-поля **typecheck ловит забытые писатели** — `footer.navItems` сидел не только в `Footer/config.ts`, но и в `endpoints/seed/index.ts` (×2) и `scripts/russify.ts`; первичный grep по `Footer/` их не нашёл, `tsc --noEmit` нашёл. Durable inline-уроки (mode-гейт редакторов, полный Lexical на публичных страницах — отвергнуты в прошлых сессиях) — см. `git log -- docs/SESSION_HANDOFF.md` (#78).

## Не забыть (low-priority)

- 🔸 **Деплой #94** (footer DROP) — destructive, порядок выше в «Следующий шаг #1».
- 🔸 **Прод-верификация галереи #90/#91** — admin-клик + upload-на-Я.Диск + мгновенный refresh force-static `/gallery`.
- 🔸 **Остаток VK (low):** личная страница через короткое имя (`vk.com/<name>` без `id`) определится как сообщество — нужен `vk.com/idN` либо `utils.resolveScreenName`.
- 🔸 Опц. прод-cleanup дублирующих inline `Environment=` домен-vars в `/etc/systemd/system/gonba.service` (команда в `docs/PROJECT.md → Systemd`).

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
