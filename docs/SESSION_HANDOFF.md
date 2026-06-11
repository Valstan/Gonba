# Session Handoff

**Status:** IDLE
**Updated:** 2026-06-11
**Branch:** main
**Last released version:** PR #136 (commit `b306fa0`). За сессию 3 PR (#134–#136), 3 CI-деплоя, все зелёные.

---

## Текущая нитка

_Нет активной нитки._ Сессия 2026-06-11 выполнила **mandate brain «Бокс 1 / build→CI» в день получения**: сборка переехала в GitHub Actions (standalone-артефакт → `releases/<sha>` → симлинк `current` → restart), бокс — runtime-only и готов принимать KARMAN. Design-решение prerender↔прод-БД — **SSH-туннель из CI к живому Postgres** (обоснование — `docs/plans/build-to-ci.md`). Cutover юнита атомарный (ставится деплоем из репо), без даунтайма. Бонусы: RSS 452→254 МБ, диск 72%→49% (удалён старый `web/.next`, swap 8→2 ГБ — с подтверждением владельца). Урок первого прогона: канонический lockfile — `package-lock.json` (pnpm-lock в .gitignore) → деплой на `npm ci` (#135). Два письма brain'у (design-решение + итог-отчёт с lockfile-граблей).

## Следующий шаг

Нитки нет — ждём задачу владельца / заезд KARMAN (его обустраивает brain-комендант; наши деплои уже сериализованы `concurrency: deploy-prod`). Опционально: визуальная проверка гидратации в браузере (Chrome-расширение в этой сессии было оффлайн; ChunkLoadError-класс закрыт curl-проверкой — маркер 18 вхождений, все чанки 200).

## Контекст

- **План:** `docs/plans/build-to-ci.md` (✅ done; там же — порядок отката на on-box build).
- **Связанные коммиты сессии:**
  - `e0d32e7` (#134) — build→CI: workflow, standalone-флаг (G41), юнит, secret `GONBA_BUILD_ENV`, туннель.
  - `7fda942` (#135) — фикс: `npm ci` вместо pnpm (pnpm-lock.yaml не в репо).
  - `b306fa0` (#136) — итог-отчёт brain'у, статусы PENDING/плана.
- **Прод:** ✅ runtime из `releases/b306fa0…` (standalone, юнит новый), health/маршруты 200, sitemap перегенерён CI. Старый юнит — бэкап `~/gonba.service.bak-20260611`; `safe-build.sh` — hot-fix-fallback (см. шапку скрипта).
- **Brain mailbox:** mandate 06-11 закрыт (2 исходящих письма); письмо 06-10 (knip dead-code + квартальный самоосмотр, recommend/low) — **не отработано**, взять в одну из следующих сессий.
- **Открытые вопросы для пользователя:** нет.

## Не забыть (low-priority)

- 🟡 **Brain-письмо 06-10:** knip-сканер + ежемесячный LLM-триаж dead-code (Payload-динамика → ignore) + квартальный самоосмотр — recommend, ответить применением или обоснованным отказом.
- 🟢 Пиковый RSS под трафиком — хвост probe для brain (теперь на standalone-базе 254 МБ).
- 🟢 Локальный дамп `prod-gonba-predupe-20260606.dump` — удалить на **machine B**.
- 🟢 C.2 хвост (а) versioned-usage; FTS Phase 3 / tiered Level 3 (`pg_trgm`) — совместить при внедрении.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
