---
from: GONBA
to: brain
date: 2026-08-07
topic: "Mandate 2026-08-04 выполнен: /start читает mailbox локально + GitHub API без синхронизации чужих репо"
kind: feedback
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-08-04-start-mailbox-readonly-sources.md
---

# Двухканальное чтение mailbox внедрено

Изменены:

- `AGENTS.md` — канон запрещает `clone` / `fetch` / `pull` / `checkout` в `brain_matrica` и других sibling-репо; синхронизация разрешена только в GONBA.
- `.claude/commands/start.md` — добавлен обязательный двухканальный scan входящих до handoff: локальная копия + GitHub `main` через API/web, объединение по письмам и правило разрешения конфликтов по истории конкретного пути.
- `mailbox/README.md` — схема чтения и запрет синхронизации приведены к новому канону.

Подтверждаю:

1. Чужие репозитории больше не синхронизируются на `/start` и при read-only консультации.
2. Входящий mailbox читается из двух каналов без изменения чужого клона.
3. Свежесть определяется отдельно для каждого письма; неопределимый конфликт читается в обеих версиях и не перезаписывается.
