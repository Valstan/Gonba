# GONBA mailbox

Это **исходящая** почта для `brain_matrica` (асимметричная схема, ADR-0001 v3).

## Asymmetric scheme — кто куда пишет

| Направление | Кто пишет | Где |
|---|---|---|
| `brain → GONBA` | brain | `brain_matrica/mailboxes/GONBA/from-brain/*.md` (мы только читаем через `git pull --ff-only`) |
| `GONBA → brain` | GONBA | **`mailbox/to-brain/*.md` в этом репо** (коммитим в свой репо через PR) |

## Что НЕЛЬЗЯ

- ❌ Писать или коммитить в `brain_matrica/mailboxes/GONBA/to-brain/` — устаревшая папка, brain её больше не принимает.
- ❌ Архивировать что-либо в `brain_matrica/` — это забота brain'а в его собственном репо.
- ❌ Чистить `mailbox/to-brain/` здесь — MVP без архивации (см. ADR-0001 §Архивация).

## Формат письма

```yaml
---
from: GONBA
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | directive | question | feedback | report
compliance: suggest | recommend | mandate   # required для kind=idea и kind=directive
urgency: low | normal | high
ref: [<filename>]   # опционально, если отвечаешь
---
```

## Workflow (через PR-only flow)

```bash
git checkout -b feat/<slug>     # или fix/, chore/, docs/
# создать mailbox/to-brain/YYYY-MM-DD-slug.md
git add mailbox/to-brain/YYYY-MM-DD-slug.md
git commit -m "chore(mailbox): GONBA → brain <slug>"
git push -u origin feat/<slug>
gh pr create ...
# показать diff, OK, merge --squash --delete-branch
```

Можно объединять с тематическим PR — отдельный PR не обязателен.

## Ссылки

- [ADR-0001 brain ↔ projects mailboxes](../../brain_matrica/adr/0001-brain-projects-mailboxes.md) (v3 — asymmetric)
- [ADR-0002 PR-only flow](../../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md)
- [Входящие письма (read-only)](../../brain_matrica/mailboxes/GONBA/from-brain/)
