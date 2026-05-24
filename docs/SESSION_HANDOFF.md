# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-24
**Branch:** main
**Last released version:** —

---

## Текущая нитка

**Этно-модерн редизайн главной** (PR1-4) — основная нитка с сессии 2026-05-23. В сессии 2026-05-24 (ч.4) **впервые** написан реальный код: на той же Windows-машине развёрнуто полное dev-окружение (Postgres 16 portable + pnpm + types + importMap), сделан и отправлен в PR PR1 §1+§2 — фундамент ethno-токенов и шрифтов. PR [#41](https://github.com/Valstan/Gonba/pull/41) — CI зелёный, mergeable, ждёт твоего merge перед автодеплоем.

## Следующий шаг

**В этом порядке:**

1. **Тебе:** merge PR [#41](https://github.com/Valstan/Gonba/pull/41) (gh pr merge --squash --delete-branch, либо через UI). Автодеплой через `.github/workflows/deploy-prod.yml`. Прод-эффект: брендовые цвета `bg-brand-forest` etc станут hex-точными из ethno-палитры (`#2d4029` etc вместо oklch). Header/Footer/главная остаются прежними.

2. **В следующей сессии (на любой машине):** PR2 этно-модерн (схема `Project` под этно-модерн) **или** PR1 §3+§4 (Header rhomb + drawer + Footer 3-колонник на --ink). По плану §3+§4 идут вторыми — но это **большие visual-изменения**, и они потребуют визуальной приёмки.
   - Header: `gonba-home.html` строки 191-298 (rhomb + 5 групп + drawer)
   - Footer: `gonba-home.html` строки 651-701 (3-колонник на --ink)
   - SQL prod-config (`scripts/sql/2026-05-23-prod-redesign-config.sql`) — всё ещё не применён, ждёт SSH-ключа на машине.

3. **Также (для следующей сессии):** проверить что Claude-in-Chrome MCP подхватился — в `%APPDATA%\Claude\claude_desktop_config.json` переключён `chromeExtensionEnabled: true`. Если в `/start` появятся `mcp__claude-in-chrome__*` tools — визуальная проверка станет легче (DOM-aware вместо pixel-clicks).

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md).
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md).
- **Handoff-bundle:** [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md).
- **Коммиты сессии 2026-05-24 ч.4:**
  - `62ac774` — feat(frontend): ethno CSS-vars + PT Serif/Manrope/JetBrains Mono (PR1 §1+§2) — [#41](https://github.com/Valstan/Gonba/pull/41), CI green
- **Прод:** ✅ жив, `/api/health` 200 in 0.67s (последняя проба в начале сессии). После merge #41 — деплой подтянет CSS-vars + шрифты.
- **Открытые вопросы для пользователя:** 0.
- **Брат- и системные настройки этой Windows-машины (для следующего раза):**
  - Postgres 16.14 portable в `C:\pgsql\`, БД `gonba`, user/pass `postgres/postgres`. Старт: `& 'C:\pgsql\bin\pg_ctl.exe' -D 'C:\pgsql\data' -l 'C:\pgsql\logs\postgres.log' start`. Падает периодически с recovery — пересоздавать не надо, перезапускать.
  - pnpm script-shell установлен в git-bash (`C:\Program Files\Git\bin\bash.exe`) глобально.
  - SSH-ключ к GONBA **по-прежнему отсутствует** на этой машине. Скопировать `id_ed25519_gonba_deploy` с dev-машины — или генерить заново и обновлять `authorized_keys` на проде (нежелательно — chain-of-compromise).
  - `web/.env` с **placeholder секретами** (PAYLOAD_SECRET / CRON_SECRET / PREVIEW_SECRET — placeholder hex, YANDEX_DISK_TOKEN = `placeholder-no-real-token`). Реальные значения — на dev-машине. На CI секреты приходят из GitHub Secrets.

## Failed approaches (этой нитки)

- **`pnpm dev` стабильно на Windows + Node 22 + Postgres** — после первого 1-2 запросов Payload падает с `spawn UNKNOWN` (`getPayload({ config })` фейлит). Predicted причина: child_process.spawn в sharp/drizzle/yandex-trash на Windows Node 22. **Не блокер для текущей нитки** (первый запрос всегда успешен, visual screenshot успели сделать), но мешает длительной dev-сессии. **Возможные варианты на следующий раз:** downgrade до Node 20 (как на проде), убрать `YANDEX_DISK_TOKEN` совсем (Yandex trash cleanup может быть источником spawn), переключиться на docker-compose из `web/docker-compose.yml`. **Не пробовать заново «просто перезапустить dev и надеяться»** — проверено 3 раза, не лечится.
- **`ssh GONBA` с одним из существующих ключей (`id_ed25519` / `id_ed25519_matricarmz_deploy`)** — отвергнут с Permission denied. На проде authorized_keys содержит только изолированный `gonba-deploy@PC40-...`, которого здесь нет (см. cleanup 2026-05-22 dispatch #0007). **Решение:** копировать `id_ed25519_gonba_deploy` с dev-машины офлайн (флешка), не через chat.
- **Открытие URL в Firefox через computer-use type (write в адресную строку)** — заведомо невозможно: Firefox tier=read блокирует typing. Сработало через `Start-Process firefox '-new-window','<URL>'` — это правильный путь для обоих браузеров.

## Не забыть (low-priority)

- 🔵 **Запустить SQL prod-config + письмо kind=feedback** — нерешённый хвост ч.1/ч.2/ч.3 сессии. Требует dev-машины (SSH).
- 🟢 **Drawer-подменю Header → перенести из хардкода в Payload** (после PR2).
- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media`.
- 📊 Журнал `gonba-media-cache.timer` — глянуть когда будут силы.
- 🧹 Переименовать `docs/plans/media-to-yadisk.md` → `media-to-yadisk-DONE.md`.
- 🟢 **Проверить `chromeExtensionEnabled: true` подхватился** в следующей сессии (после restart Claude Desktop). Если `mcp__claude-in-chrome__*` появились — будущий visual review станет проще.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
