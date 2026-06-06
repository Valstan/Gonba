# Session Handoff

**Status:** IDLE
**Updated:** 2026-06-06
**Branch:** main
**Last released version:** PR #121 (commit `cd20e14`) + прод-операция дедупа. Прод: health/home/oblako/posts 200.

---

## Текущая нитка

_Нет активной нитки._ Сессия 2026-06-06 (2-я за день) закрыла **весь медиа-кластер техдолгов** `docs/plans/media-library-integrity.md` (A ✅ B ✅ C.1 ✅ C.2 ✅ D ✅), включая разовый прод-дедуп 212 копий. Ждём следующую задачу владельца.

## Следующий шаг

Нитки нет. Низкоприоритетные хвосты — см. `PENDING_FOLLOWUPS.md`:
- 🟢 **C.2 UI-хвост** — кнопки «всё равно удалить»/«заменить на другую» в админке (force/replace; серверная защита уже есть через `beforeDelete`-хук).
- 🟢 **FTS Phase 3** (pg_trgm/GIN) — сознательно отложено (преждевременно при ~184 строках, нужен `CREATE EXTENSION` суперюзером).
- 🟢 прочие давние (118-дублей закрыто; `about-project`→Pages, прод-бэкап `~/media-legacy-bak-20260604`).

## Контекст

- **План:** `docs/plans/media-library-integrity.md` (все фазы отмечены ✅).
- **Связанные коммиты сессии:**
  - `0e4c3c0` (#118) — C.1 usage-движок (`web/src/server/media-usage/`, `GET /api/media/usage`).
  - `546d902` (#119) — C.2 safe-delete `beforeDelete`-хук.
  - `f72b733` (#120) — D dry-инструмент `web/scripts/dedupe-media.ts`.
  - `cd20e14` (#121) — D `--apply` (Local API репойнт) + фикс slug `vkImportQueue`/global adminUrl.
- **Прод-операция (не в git — данные):** `dedupe-media.ts --apply` на проде → 118 групп схлопнуто, 212 копий удалено (БД 711→499) + Я.Диск-ресурсы, 294 ссылки перепривязаны. Бэкап до: `prod-gonba-predupe-20260606.dump` (локально, gitignored). Полный `safe-build.sh` + restart gonba пересобрал статические пререндеры → картинки на канонных id. Всё проверено (0 дубль-групп, 0 yandex_errors, посты на канонных URL, health 200).
- **Прод:** ✅ health/home/oblako/posts 200.
- **Открытые вопросы для пользователя:** нет.

## Не забыть (low-priority)

- 🟢 **C.2 UI force/replace** в админке — единственный недоделанный кусочек Phase C (серверная защита уже на проде).
- 🟢 Удалить прод-бэкап `~/media-legacy-bak-20260604` (409 МБ) — давний хвост.
- 🟢 Локальный прод-дамп `prod-gonba-predupe-20260606.dump` (1.3 МБ, gitignored) — можно удалить после пары дней наблюдения за продом.
- 🟢 Dev на этой машине (machine B / Windows): локальная БД `gonba` на Postgres 17 порт **5432**; `[slug]`-маршруты в dev падают ENOENT — для верификации прод-build или прод.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
