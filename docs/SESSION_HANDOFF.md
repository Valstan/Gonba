# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-24
**Branch:** main
**Last released version:** —

---

## Текущая нитка

**Этно-модерн редизайн главной** (4 PR'а) — основная нитка с сессии 2026-05-23. Решения по направлению B зафиксированы в [ADR-0004](adr/0004-frontpage-ethno-modern-redesign.md), детальный план — в [`plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md), handoff-bundle — в [`design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md). 3 открытых вопроса PR1 закрыты (имена slug-only / шрифты / маппинг проектов). Параллельно в сессии 2026-05-24 заготовлен SQL по brain dispatch [`2026-05-23-prod-redesign-followup-config`](../../brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md), ждёт применения на dev-машине.

## Следующий шаг

**На dev-машине, в таком порядке:**

1. **Запустить SQL prod-config** (одна команда):
   ```bash
   git pull --ff-only
   scp scripts/sql/2026-05-23-prod-redesign-config.sql GONBA:/tmp/
   ssh GONBA "sudo -u postgres psql -d gonba -f /tmp/2026-05-23-prod-redesign-config.sql"
   ```
   Проверить вывод SELECT-ов в конце: **9 yadisk-строк**, **4 chat-строки**, **0 мисматч-slug'ов**. Если мисматчи есть — скорректировать SQL под фактические slug'и проекта.

2. **Подтверждающее письмо brain** — создать `mailbox/to-brain/2026-05-NN-prod-redesign-config-done.md` (`kind=feedback`, `urgency=low`) с фактическим списком включённых slug'ов и статусом VK auto-sync. Можно объединить с PR1 этно-модерна или отдельным маленьким PR.

3. **PR1 этно-модерн** — открыть `docs/design/handoff-2026-05-23/gonba-home.html` рядом с IDE и идти по разделам PR1 в плане:
   - `web/src/app/(frontend)/globals.css` — CSS-vars (`--paper`, `--forest`, `--ochre`, ...)
   - `web/src/app/layout.tsx` — `next/font/google` для PT Serif + Manrope + JetBrains Mono
   - `web/src/Header/` — переписать (rhomb-знак, 5 групп: Пожить / Делать / Смотреть / Лавка / О проекте, transparent поверх hero, drawer на mobile)
   - `web/src/Footer/` — 3-колонник, фон `--ink`
   - `header_nav_items` global — fixture-набор из 5 групп (миграция через `payload.update`)
   - Чистка слагов: применить уже зафиксированные имена «ЭКО-отель» / «О проекте» / «Вятский сбор»

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md) — PR1-PR4 с конкретными файлами. Раздел «Текущий этап» содержит финализированные решения PR1/PR2.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md).
- **Handoff-bundle:** [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md).
- **Brain dispatch:** [`from-brain/2026-05-23-prod-redesign-followup-config.md`](../../brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md) + промежуточный ответ [`to-brain/2026-05-24-prod-redesign-config-prepared.md`](../mailbox/to-brain/2026-05-24-prod-redesign-config-prepared.md).
- **Связанные коммиты сессии 2026-05-24:**
  - `288af36` — SQL для prod-redesign config + закрытие 3 вопросов PR1 ([#35](https://github.com/Valstan/Gonba/pull/35))
  - `cc14165` — DEV_LOG block + brain letter kind=report ([#36](https://github.com/Valstan/Gonba/pull/36))
- **Прод:** ✅ жив, `/api/health` 200 in 0.42s (probe после autodeploy 26344222095, success 8m15s после merge #35). SQL ещё не применён — `gallery_yandex_folder` / `chat_enabled` по проектам = NULL/false.
- **Открытые вопросы для пользователя:** 0.

## Failed approaches (этой нитки)

- **Push с этой Windows-машины посреди ночи 2026-05-23 → 2026-05-24** — `https://github.com:443` зависал на полный 5-минутный timeout (ping/DNS работали, но TLS handshake блокировался). Workaround: локальный commit `061902e` пережил overnight на ветке без push, на следующий день retry прошёл. **Урок:** перед длительной prod-задачей через push сначала `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://github.com/`.
- **Вариант «делать prod-config через /admin кликами»** — отброшен в пользу единого SQL-патча. Причина: у `Projects` нет `afterChange`-хука с `revalidateTag` ([web/src/collections/Projects/index.ts:201](../web/src/collections/Projects/index.ts)) — кэш-инвалидация не нужна. SQL занимает 1 команду вместо 13+ кликов. Trade-off `versions: { drafts: true }` — UPDATE может перетёрться при следующем Save в /admin → mitigated через NOTE в SQL и рекомендацию открыть проект в /admin → Save без правок (синк version snapshot).
- **`/sql` skill для запуска SQL с этой машины** — не сработало бы, потому что skill использует тот же `ssh GONBA`, а ключа `id_ed25519_gonba_deploy` на Windows-машине нет. Запуск SQL = обязательно dev-машина с настроенным алиасом GONBA.

## Не забыть (low-priority)

- 🔵 **Запустить SQL prod-config + письмо kind=feedback** — первый пункт «Следующего шага» выше. Это завершает обработку brain dispatch.
- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media` (rename Я.Диск-ресурса; 62 orphan-файла; retry в фоне) — не блокируют этно-модерн.
- 📊 Журнал `gonba-media-cache.timer` (`ssh GONBA "journalctl -u gonba-media-cache -n 20 --no-pager"`) — глянуть когда будут силы.
- 🧹 Переименовать `docs/plans/media-to-yadisk.md` → `media-to-yadisk-DONE.md`.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
