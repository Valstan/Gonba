# Session Handoff

**Status:** IDLE
**Updated:** 2026-05-30
**Branch:** main
**Last released version:** PR #58 (commit `e355df1`) на проде — deploy guard против stale-prerender (контент-маркер в smoke-check + `.next`-guard). Прод verified: health 200, `/` = карусель (8 кружков), новый guard прошёл end-to-end на собственном деплое.

---

## Состояние

**Свободно — активной нитки нет.** Вечерняя сессия 2026-05-30, between-threads окно. Закрыто:

1. ✅ **Директива brain #010** — session sync safeguard (mandate). `scripts/git_sync_check.sh` (`--warn`/`--gate`), SessionStart-хук в коммитимом `.claude/settings.json`, sync-гейт в `/close_session`, правило в `CLAUDE.md`, NL-триггеры. [PR #57](https://github.com/Valstan/Gonba/pull/57). +2 находки (`.gitignore`-исключение `!.claude/settings.json`, `.gitattributes` `*.sh eol=lf`). Gate догфуднут.
2. ✅ **Deploy guard (stale-prerender)** — высокоприоритетный 🟡-техдолг закрыт. [PR #58](https://github.com/Valstan/Gonba/pull/58). Контент-маркер `homeOrbit__itemWrap` в `deploy-prod.yml` (локальный эндпоинт) + `[ -d .next ] && exit 1` в `safe-build.sh`. Провалидирован на деплое (`8 вхождений → OK`).
3. ✅ **3 owed-ответа brain закрыты** — ack-письма #010, #006 (ssh-opt-in), #prod-redesign-config (галереи 10/13, chat 6, VK healthy) в `mailbox/to-brain/`.

## Кандидаты на следующую нитку (из PENDING)

- 🟡 **Дрейф репо↔прод systemd-юнитов** (`gonba-web.service` vs установленный `gonba.service` + inline домен-vars).
- 🟡 **Мониторинг протухания VK-токенов** (молча не работал 2.5 дня в мае — нужен алерт при `error` на всех источниках).
- 🟡 **VK source #5 (Садовая Фея)** — user page, не группа: `pending` навсегда, пока код не научится `users.get` + положительный `owner_id`. Отдельный PR.
- 🟢 Уборка ~260 строк мёртвого admin-CSS орбиты в `globals.css` · drawer-подменю Header → в Payload · `last_error` не очищается при success · idempotency VK по `(ownerId, postId)`.
- 🟢 **Node 20 actions deprecation** — `actions/checkout@v4`/`setup-node@v4` (дедлайн GitHub июнь 2026). Бамп до v5 в CI + deploy workflow.

## Контекст

- **Прод:** ✅ `гоньба.рф/` = карусель (8 кружков), `/api/health` 200, секреты в `/etc/gonba/`, новый deploy-guard активен.
- **Локально:** dev-БД — фейковые тестовые проекты (при следующей local-работе восстановить из прод-дампа). SSH opt-in (вариант #3) отработал без фрикции весь прод-verify.
- **Новое в процессе:** `git_sync_check.sh` SessionStart-хук теперь предупреждает о несинхроне при входе; `/close_session` гейтит на «всё на GitHub».
- **Открытые PR:** этот session-close PR.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
