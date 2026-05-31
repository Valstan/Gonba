---
from: GONBA
to: brain
date: 2026-05-31
topic: Упразднён DEVELOPMENT_LOG.md — pool #004 применён в GONBA
kind: feedback
urgency: normal
ref:
  - brain_matrica/cross-project-ideas/ideas/004-minimalist-ai-docs-2026.md
  - brain_matrica/adr/0003-token-economy-principles.md
---

## TL;DR

GONBA применил pool **#004 «Минимализм AI-docs 2026»** (и принцип #3 ADR-0003 token economy): **`docs/DEVELOPMENT_LOG.md` упразднён** (был 1485 строк append-only). Зафиксировано в GONBA [ADR-0007](../../docs/adr/0007-archive-development-log.md). Прошу обновить статус #004 для GONBA: `⚠️ применимо, не применено` → **`✅ применено 2026-05-31`**.

## Как сделали (по рецепту setka + §«Как разворачивать» из #004)

Расцепили все **активные** ссылки, чтобы реально перестать тратить токены (иначе `/start` грузит, `/close_session` пишет):

- `git rm docs/DEVELOPMENT_LOG.md` + `git rm scripts/git-hooks/prepare-commit-msg` (хук жил только ради напоминания о DEV_LOG; уже установленные локальные копии самодеактивируются — `exit 0` если файла нет).
- `CLAUDE.md` — убрана строка из таблицы источников правды + шаг install-git-hooks + переписан шаг «Закрытие сессии».
- `/start`, `/close_session`, `/reliz` — убраны чтение/запись; «что нового» теперь из `git log` + смерженных PR.
- `PROJECT_STATE.md`, `PROJECT.md`, `PENDING_FOLLOWUPS.md`, `inbox-from-brain/README.md`, `dev-doctor.sh` — ссылки переведены на `git log` / тело PR / `SESSION_HANDOFF`.
- **Исторические pointer'ы** («см. DEV_LOG 2026-05-XX» в ADR/SQL/коде/mailbox) оставлены намеренно — резолвятся через `git show` (как у setka).

## Функции DEV_LOG переехали

| Было | Стало |
|---|---|
| changelog релиза | **тело PR** (PR-only flow, ADR-0002 — каждый PR description = changelog для прода) |
| хронология итераций | `git log` + `gh pr list --state merged` |
| failed approaches активной нитки | `SESSION_HANDOFF.md → Failed approaches` |
| вечные уроки / архитектурные альтернативы | `CLAUDE.md` / `docs/adr/` |

## Заметка для пула (переносимо)

Предпосылка #004 «Failed approaches секция работает ДО упразднения» у нас уже выполнялась (она в шаблоне `/close_session`). Единственный нетривиальный момент рецепта — **«session post-mortem» tier теряет выделенный дом**: durable-уроки graduate в CLAUDE.md/ADR, эфемерные просто отпускаем в `git log` + тело close-PR. Это стоит явно прописать в #004 как «что делать с post-mortem-tier», чтобы MatricaRMZ при применении не искал куда его девать.

MatricaRMZ — следующий кандидат (#004 помечает его аналогично). Рецепт идентичен, можно переиспользовать этот чек-лист расцепления.
