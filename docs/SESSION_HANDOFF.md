# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-24
**Branch:** main
**Last released version:** —

---

## Текущая нитка

**Этно-модерн редизайн главной** (4 PR'а) — основная нитка с сессии 2026-05-23. Решения по направлению B зафиксированы в [ADR-0004](adr/0004-frontpage-ethno-modern-redesign.md), детальный план — в [`plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md), handoff-bundle — в [`design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md). В сессии 2026-05-24 (три полусессии — ч.1/ч.2/ч.3 с одной Windows-машины без dev) подготовлены: SQL prod-config, готовые snippet'ы в плане (CSS-vars блок, `next/font/google`, fixture header_nav_items, миграция PR2 `.ts`+`.sql`), применена pool-идея #006 (SSH opt-in в `/start`). SQL и сам PR1-код ждут dev-машины.

## Следующий шаг

**На dev-машине, в таком порядке:**

1. **Запустить SQL prod-config** (одна команда):
   ```bash
   git pull --ff-only
   scp scripts/sql/2026-05-23-prod-redesign-config.sql GONBA:/tmp/
   ssh GONBA "sudo -u postgres psql -d gonba -f /tmp/2026-05-23-prod-redesign-config.sql"
   ```
   Проверить вывод SELECT-ов в конце: **9 yadisk-строк**, **4 chat-строки**, **0 мисматч-slug'ов**. Если мисматчи есть — скорректировать SQL под фактические slug'и.

2. **Подтверждающее письмо brain** — создать `mailbox/to-brain/2026-05-NN-prod-redesign-config-done.md` (`kind=feedback`, `urgency=low`) с фактическим списком включённых slug'ов и статусом VK auto-sync. Можно объединить с PR1 этно-модерна или отдельным маленьким PR.

3. **PR1 этно-модерн** — план [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md) уже содержит готовые snippet'ы для механической части:
   - §1: CSS-блок (12 ethno-vars + `clamp()` pad-x/pad-y + 5 алиасов brand-* → ethno; `--muted` → `--text-muted` из-за shadcn-конфликта) — вставить в `web/src/app/(frontend)/globals.css` внутрь `:root { ... }` после `--brand-olive`
   - §2: `next/font/google` snippet (PT Serif + Manrope + JetBrains Mono, cyrillic+latin, italic PT Serif, `display: 'swap'`) — в `web/src/app/layout.tsx`
   - §3: Хедер с rhomb-знаком + 5 групп + transparent поверх hero + drawer — пишется по handoff'у `gonba-home.html:191-298`
   - §4: Footer 3-колонник на `--ink` — handoff `gonba-home.html:651-701`
   - §5: Чистка слагов 3 проектов (ЭКО-отель / О проекте / Вятский сбор) — через admin Payload
   - §6: `web/scripts/seed-header-nav-ethno.ts` (готовый `payload.updateGlobal`-snippet для 5 групп)

4. **PR2 этно-модерн** (после PR1) — план §2 содержит готовые `.ts` + `.sql` миграции для 6 колонок `Projects`. Файлы НЕ созданы в `web/src/migrations/` намеренно (push:true опасность) — создавать **вместе** с PR2-кодом изменений в `web/src/collections/Projects/`.

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md) — теперь содержит готовые snippet'ы для PR1 §1/§2/§6 и PR2 §2.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md).
- **Handoff-bundle:** [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md).
- **Brain dispatch:** [`from-brain/2026-05-23-prod-redesign-followup-config.md`](../../brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md) + промежуточный ответ [`to-brain/2026-05-24-prod-redesign-config-prepared.md`](../mailbox/to-brain/2026-05-24-prod-redesign-config-prepared.md).
- **Связанные коммиты сессии 2026-05-24:**
  - `288af36` — SQL для prod-redesign config + закрытие 3 вопросов PR1 ([#35](https://github.com/Valstan/Gonba/pull/35))
  - `cc14165` — DEV_LOG ч.1 + brain letter kind=report ([#36](https://github.com/Valstan/Gonba/pull/36))
  - `3e9269f` — SSH opt-in (pool #006) + seed-snippet header_nav_items ([#38](https://github.com/Valstan/Gonba/pull/38)) — ч.2
  - `4fa8649` — заготовки миграции PR2 + CSS-vars/шрифты PR1 ([#39](https://github.com/Valstan/Gonba/pull/39)) — ч.3
- **Прод:** ✅ жив, `/api/health` 200 in 0.72s (последняя проба ч.1). SQL ещё не применён — `gallery_yandex_folder` / `chat_enabled` по проектам = NULL/false.
- **Открытые вопросы для пользователя:** 0.

## Failed approaches (этой нитки)

- **Push с этой Windows-машины посреди ночи 2026-05-23 → 2026-05-24** — `https://github.com:443` зависал на полный 5-минутный timeout (ping/DNS работали, но TLS handshake блокировался). Workaround: локальный commit `061902e` пережил overnight на ветке без push, на следующий день retry прошёл. **Урок:** перед длительной prod-задачей через push сначала `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://github.com/`.
- **Вариант «делать prod-config через /admin кликами»** — отброшен в пользу единого SQL-патча. Причина: у `Projects` нет `afterChange`-хука с `revalidateTag` ([web/src/collections/Projects/index.ts:201](../web/src/collections/Projects/index.ts)) — кэш-инвалидация не нужна. SQL занимает 1 команду вместо 13+ кликов. Trade-off `versions: { drafts: true }` — UPDATE может перетёрться при следующем Save в /admin → mitigated через NOTE в SQL и рекомендацию открыть проект в /admin → Save без правок (синк version snapshot).
- **`/sql` skill для запуска SQL с этой машины** — не сработало бы, потому что skill использует тот же `ssh GONBA`, а ключа `id_ed25519_gonba_deploy` на Windows-машине нет. Запуск SQL = обязательно dev-машина с настроенным алиасом GONBA.
- **Создание файла миграции PR2 в `web/src/migrations/` отдельно от PR2-кода** — отброшено (ч.3). Причина: `push: true` на проде при следующем restart попытался бы убрать «лишнюю» колонку (поскольку коллекция `Projects` её не объявляет в main), drizzle подвиснет в headless на y/N. Решение: текст миграции в плане, файл создаётся **только** вместе с PR2-кодом, одним PR.

## Не забыть (low-priority)

- 🔵 **Запустить SQL prod-config + письмо kind=feedback** — первый пункт «Следующего шага» выше. Это завершает обработку brain dispatch.
- 🟢 **Drawer-подменю Header → перенести из хардкода в Payload** (после PR2) — добавлено в `PENDING_FOLLOWUPS.md` ч.2.
- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media` (rename Я.Диск-ресурса; 62 orphan-файла; retry в фоне) — не блокируют этно-модерн.
- 📊 Журнал `gonba-media-cache.timer` (`ssh GONBA "journalctl -u gonba-media-cache -n 20 --no-pager"`) — глянуть когда будут силы.
- 🧹 Переименовать `docs/plans/media-to-yadisk.md` → `media-to-yadisk-DONE.md`.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
