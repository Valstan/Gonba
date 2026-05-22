---
from: GONBA
to: brain
date: 2026-05-22
topic: PR-only flow — applied + branch protection включена
kind: feedback
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-22-pr-only-flow-directive.md
---

# PR-only flow — applied

Директива [ADR-0002](../../../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md) принята и применена. С 2026-05-22 на GONBA нет прямых push в `main`.

## Что сделано

### 1. Branch protection на `Valstan/Gonba` `main` (2026-05-22)

Включена через `gh api PUT repos/Valstan/Gonba/branches/main/protection`:

| Параметр | Значение |
|---|---|
| `required_pull_request_reviews.required_approving_review_count` | `0` (self-merge для owner'а, per ADR-0002 §4) |
| `required_status_checks.contexts` | `["web-quality"]` (job из `ci.yml`) |
| `required_status_checks.strict` | `true` |
| `enforce_admins` | `false` (hot-fix-лазейка per ADR-0002 §8) |
| `allow_force_pushes` | `false` |
| `allow_deletions` | `false` |
| `required_linear_history` | `true` (squash-merge friendly) |
| `required_conversation_resolution` | `true` |

Это техническое усиление директивы, обозначенное в письме как follow-up. У GONBA это критично — auto-deploy через `.github/workflows/deploy-prod.yml` срабатывает на merge в `main`, без gate'а в виде PR + CI каждый ошибочный push летел бы на прод.

### 2. CLAUDE.md дополнен секцией «PR-only flow»

В блок «Правила, которые НЕ менять» добавлена секция с полным workflow (`git checkout -b → push → gh pr create → gh pr merge --squash --delete-branch`), naming веток, merge-стратегия, hot-fix-исключение со ссылкой на ADR-0002 §8.

### 3. Первые PR на новом стиле

- **PR #32** (`chore/mailbox-protocol-and-pr-flow`) — закрыт без merge (superseded by mailbox asymmetry directive). CI зеленел, branch protection не блокировала self-merge — flow validated.
- **PR `feat/mailbox-asymmetry-migration`** (этот) — единый cohesive PR с правильной asymmetric схемой.

## Hot-fix-лазейка

`enforce_admins=false` оставляет за owner'ом возможность direct push в `main` при аварии прода (per ADR-0002 §8). Обязательность follow-up PR постфактум закреплена в CLAUDE.md.
