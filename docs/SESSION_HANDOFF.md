# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-23
**Branch:** main
**Last released version:** —

---

## Текущая нитка

**Этно-модерн редизайн главной** (4 PR'а). Пользователь принёс handoff-bundle из Claude Design с тремя направлениями визуального языка; в сессии 2026-05-23 (ч.1) выбрано направление **B (Этно-модерн)**, обоснование зафиксировано в [ADR-0004](adr/0004-frontpage-ethno-modern-redesign.md), детальный план PR1-4 — в [`plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md), сам handoff лежит в [`design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md). В сессии 2026-05-23 (ч.2) закрыты все 3 открытых вопроса по PR1 (см. [план → «Текущий этап»](plans/etno-modern-redesign.md#текущий-этап)). Кода всё ещё не писалось.

## Следующий шаг

**PR1 — дизайн-токены + типографика + Header/Drawer/Footer + чистка слагов.** Делать на машине с рабочим dev-окружением (текущая машина без `web/.env`/`node_modules`/`payload-types.ts`).

**Входные данные для PR1 готовы** — все в [`plans/etno-modern-redesign.md → Текущий этап`](plans/etno-modern-redesign.md#текущий-этап):

1. **Имена slug-only:** «ЭКО-отель» / «О проекте» / «Вятский сбор» — применить при правке `header_nav_items` и в drawer.
2. **Шрифты:** PT Serif + Manrope + JetBrains Mono через `next/font/google`.
3. **Маппинг проектов на группы:** как в PR2 §4 (финальная сверка slug'ов — в начале PR2).

На dev-машине: открыть `gonba-home.html` рядом с IDE и пройти по разделам PR1 в плане.

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md) — конкретные файлы для каждого PR.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md) — почему B, почему orbit → `/orbit`, почему `/projects` остаётся.
- **Handoff-bundle:** [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md) — оригинальные файлы Claude Design (HTML + JSX-прототипы + CSS-токены + audit).
- **Связанные коммиты сессии 2026-05-23:** один планировочный PR (см. ниже), без кода.
- **Прод:** жив, `/api/health` 200 in 0.58s (probe 2026-05-23). Никаких прод-операций в этой сессии не делалось.
- **Открытые вопросы для пользователя:** 0 — все закрыты в ч.2 сессии 2026-05-23 (см. план → «Текущий этап»).

## Failed approaches (этой нитки)

_Пока нет — кода в этой нитке не писалось. Если в PR1-4 что-то не пойдёт — добавляем сюда («попробовали X, не сработало из-за Y, не повторять»). При закрытии нитки (Status: IDLE) — перенести в `DEVELOPMENT_LOG.md → Уроки`._

## Не забыть (low-priority)

- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media` — никак не блокируют этно-модерн, можно подобрать в перерывах между PR.
- 📊 Журнал `gonba-media-cache.timer` (Sat 2026-05-23 04:08 MSK был первый запуск) — глянуть `ssh GONBA "journalctl -u gonba-media-cache -n 20 --no-pager"`, если в следующей сессии будут силы.
- 🧹 `docs/plans/media-to-yadisk.md` — все 7 фаз done, переименовать в `media-to-yadisk-DONE.md` (формат из `plans/README.md`).

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
