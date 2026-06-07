# Session Handoff

**Status:** IDLE
**Updated:** 2026-06-07
**Branch:** main
**Last released version:** PR #129 (commit `7434467`). За сессию задеплоено 7 PR (#123–#129). Прод: health/home/projects/admin 200.

---

## Текущая нитка

_Нет активной нитки._ Сессия 2026-06-07 закрыла **директиву brain #027** (gate-replaced autonomy) и **весь оставшийся медиа-кластер** (C.2 UI force/replace + спиннеры превью), затем **проверила C.2 руками на проде** (совместно с владельцем через Claude-in-Chrome). По ходу адверсариальный code-review и live-проверка нашли и починили 2 инфра-бага. Ждём следующую задачу владельца.

## Следующий шаг

Нитки нет. Низкоприоритетные хвосты — см. `PENDING_FOLLOWUPS.md`.

## Контекст

- **Связанные коммиты сессии (7 PR, все задеплоены):**
  - `4c7574d` (#123) — gate-replaced autonomy (#027): `.claude/settings.json` `defaultMode:auto` + allow/deny, CLAUDE.md, ack брейну.
  - `a4fc8b6` (#124) / `1a4b16d` (#125) — спиннеры превью `InlineImage` / `MediaPicker` (cold-cache Я.Диск).
  - `5b925ae` (#126) — **C.2 UI force-delete / replace**: виджет `MediaActions` в сайдбаре медиа + эндпоинты `/api/media/force-delete`,`/replace` + общий `repoint.ts` (делят скрипт Phase D и эндпоинт) + unit-тест + фикс латентного бага `replaceUploads` (`relationTo==='media'`).
  - `ffdb372` (#127) — **fix:** обход deny `git push -u origin main` (находка code-review): allow сужен до префиксов PR-flow + deny расширен.
  - `83142c5` (#128) — **fix:** stale importMap (находка live-проверки): `payload generate:importmap` встроен в `build:raw`.
  - `7434467` (#129) — косметика: `disableListColumn` у `mediaActions`.
- **Live-верификация C.2 на проде** (Claude-in-Chrome, владелец логинился): виджет рендерится, usage-список верен, REPLACE (репойнт версионно-корректный, `_status` сохранён, источник удалён) и FORCE-DELETE (осиротение ссылок как задумано) проверены end-to-end на throwaway-медиа; cleanup без следов.
- **Прод:** ✅ health/home/projects/admin 200.
- **Открытые вопросы для пользователя:** нет.

## Не забыть (low-priority)

- 🟢 **C.2 хвост (а) versioned-usage** — расширить usage-движок на latest-draft `_v` (закрыть «media в неопубликованном черновике»). Нужен запущенный локальный Postgres для интроспекции `_v`-схемы (на machine B сейчас лежит) + design-решение: сканировать только `latest=true`, НЕ исторические версии (иначе конфликт с Phase D, где история деградирует через FK SET NULL).
- 🟢 Удалить прод-бэкап `~/media-legacy-bak-20260604` (409 МБ) + локальный дамп `prod-gonba-predupe-20260606.dump` — деструктив, после пары дней наблюдения за продом.
- 🟢 **FTS Phase 3** (pg_trgm/GIN) — сознательно отложено (преждевременно при ~184 строках, нужен `CREATE EXTENSION` суперюзером).

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
