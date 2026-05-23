# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-23
**Branch:** main
**Last released version:** —

---

## Текущая нитка

**Этно-модерн редизайн главной** (4 PR'а). Пользователь принёс handoff-bundle из Claude Design с тремя направлениями визуального языка; в этой сессии выбрано направление **B (Этно-модерн)**, обоснование зафиксировано в [ADR-0004](adr/0004-frontpage-ethno-modern-redesign.md), детальный план PR1-4 — в [`plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md), сам handoff лежит в [`design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md). Кода в этой сессии не писалось.

## Следующий шаг

**PR1 — дизайн-токены + типографика + Header/Drawer/Footer + чистка слагов.** Делать на машине с рабочим dev-окружением (текущая машина без `web/.env`/`node_modules`/`payload-types.ts`).

**До старта PR1 уточнить у пользователя:**

1. Финальные русские названия для 3 «slug-only» проектов (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) — нужны для drawer'а и для миграции `header_nav_items`.
2. Подтверждение набора шрифтов: PT Serif (заголовки) + Manrope (sans) + JetBrains Mono (eyebrows) — или замена. Все через `next/font/google`.
3. Точный маппинг 10 проектов на 4 группы (см. таблицу в `plans/etno-modern-redesign.md → PR2 §4`) — пригодится для PR2, но если есть мнение уже сейчас — лучше зафиксировать.

После уточнений — открыть `gonba-home.html` рядом с IDE и пройти по разделам PR1 в плане.

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md) — конкретные файлы для каждого PR.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md) — почему B, почему orbit → `/orbit`, почему `/projects` остаётся.
- **Handoff-bundle:** [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md) — оригинальные файлы Claude Design (HTML + JSX-прототипы + CSS-токены + audit).
- **Связанные коммиты сессии 2026-05-23:** один планировочный PR (см. ниже), без кода.
- **Прод:** жив, `/api/health` 200 in 0.58s (probe 2026-05-23). Никаких прод-операций в этой сессии не делалось.
- **Открытые вопросы для пользователя:** 3 пункта выше (названия / шрифты / маппинг).

## Failed approaches (этой нитки)

_Пока нет — кода в этой нитке не писалось. Если в PR1-4 что-то не пойдёт — добавляем сюда («попробовали X, не сработало из-за Y, не повторять»). При закрытии нитки (Status: IDLE) — перенести в `DEVELOPMENT_LOG.md → Уроки`._

## Не забыть (low-priority)

- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media` — никак не блокируют этно-модерн, можно подобрать в перерывах между PR.
- 📊 Журнал `gonba-media-cache.timer` (Sat 2026-05-23 04:08 MSK был первый запуск) — глянуть `ssh GONBA "journalctl -u gonba-media-cache -n 20 --no-pager"`, если в следующей сессии будут силы.
- 🧹 `docs/plans/media-to-yadisk.md` — все 7 фаз done, переименовать в `media-to-yadisk-DONE.md` (формат из `plans/README.md`).

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
