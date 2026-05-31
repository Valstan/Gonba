# ADR 0007: Упразднение `DEVELOPMENT_LOG.md` — переход на минималистичный AI-docs паттерн

**Date:** 2026-05-31
**Status:** Accepted
**Связано:** brain_matrica [ADR-0003 «Token economy principles»](../../../brain_matrica/adr/0003-token-economy-principles.md) (принцип #3), pool [#004 «Минимализм AI-docs 2026»](../../../brain_matrica/cross-project-ideas/ideas/004-minimalist-ai-docs-2026.md). Прецедент — setka ADR-0001 (упразднила `DEV_HISTORY.md` 2026-05-24).

## Context

`docs/DEVELOPMENT_LOG.md` вырос до **1485 строк** append-only хронологии. Это типичный «журнал истории разработки» — артефакт эры слабых LLM (2020-2024), когда у моделей не было ни context window, ни sub-agents, ни семантического поиска по git.

В эру мощных AI-ассистентов (1M context, sub-agents, MCP, `gh search`) этот слой **дублирует** уже существующие источники и стоит токенов дважды:

1. **На чтение** — `/start` грузил весь файл в контекст каждой сессии.
2. **На запись** — `/close_session` и `/reliz` тратили токены на ведение блока в каждой сессии.

brain_matrica [ADR-0003](../../../brain_matrica/adr/0003-token-economy-principles.md) принцип #3 прямо называет `DEVELOPMENT_LOG`/`DEV_HISTORY` антипаттерном; pool [#004](../../../brain_matrica/cross-project-ideas/ideas/004-minimalist-ai-docs-2026.md) помечал GONBA как `⚠️ применимо, не применено`. Пользователь дал прямую команду упразднить (2026-05-31).

## Decision

**Упразднить `docs/DEVELOPMENT_LOG.md`.** Его функции распределяются по уже существующим источникам:

| Что было в DEVELOPMENT_LOG | Где живёт теперь |
|---|---|
| «Что сделано в каждой итерации» | `git log` с описательными Conventional-Commit сообщениями |
| «Контекст релиза / changelog» | **Тело PR** (CLAUDE.md: «каждый PR description — фактический changelog для прода») + `gh pr view` |
| «Куда мы шли / нить» | `docs/SESSION_HANDOFF.md` |
| «Открытые задачи» | `docs/PENDING_FOLLOWUPS.md` |
| «Архитектурные решения + альтернативы» | `docs/adr/` |
| «Failed approaches активной нитки» | `docs/SESSION_HANDOFF.md → Failed approaches` |
| «Вечные уроки уровня проекта» | `CLAUDE.md → Технические уроки` |

История самого файла не теряется — доступна через `git log --follow -- docs/DEVELOPMENT_LOG.md` и `git show <commit>:docs/DEVELOPMENT_LOG.md`. Исторические pointer'ы вида «см. DEVELOPMENT_LOG 2026-05-XX» в ADR / SQL / коде / mailbox-архиве **оставлены намеренно** — теперь они работают как указатели в `git show` (тот же приём, что у setka).

### Что расцеплено (активные ссылки)

- **Файл:** `git rm docs/DEVELOPMENT_LOG.md`.
- **Git-хук:** `git rm scripts/git-hooks/prepare-commit-msg` (его единственная функция была напоминать обновлять DEV_LOG). Уже установленные локальные копии хука самодеактивируются — они выходят `exit 0`, если файла нет.
- **CLAUDE.md** — убрана строка из таблицы источников правды, шаг «install-git-hooks», переписан шаг «Закрытие сессии».
- **`/start`, `/close_session`, `/reliz`** (`.claude/commands/`) — убраны чтение/запись DEV_LOG; «что нового» теперь из `git log` / последнего PR.
- **`docs/PROJECT_STATE.md`, `docs/PROJECT.md`, `docs/PENDING_FOLLOWUPS.md`, `docs/inbox-from-brain/README.md`** — ссылки переведены на `git log` / `SESSION_HANDOFF` / тело PR.
- **`scripts/dev-doctor.sh`, `scripts/install-git-hooks.sh`** — убрана DEV_LOG-специфичная проверка/текст.

## Consequences

**Положительные:**
- `/start` грузит меньше контекста (−1485 строк из обязательного чтения) → дешевле и быстрее старт сессии.
- `/close_session` / `/reliz` не тратят токены на ведение журнала.
- Меньше «мусора», который Claude обязан читать (ADR-0003 §Consequences).
- Один источник истины для хронологии — `git log` + PR, без риска расхождения «лог vs реальные коммиты».

**Отрицательные / стоимость:**
- «Session post-mortem» (подробный разбор сессии) больше не имеет выделенного файла. Durable-уроки graduate в `CLAUDE.md`/ADR; эфемерные — живут в теле close-PR и `git log`. Риск «урок потерялся» митигируется секцией `Failed approaches` в `SESSION_HANDOFF.md` (работает **до** упразднения, как требует pool #004 §«Что НЕ делать»).
- Нужна дисциплина описательных commit-сообщений и тел PR (и так требуется PR-only flow, ADR-0002).

## Alternatives considered

- **A. Оставить DEV_LOG, просто реже обновлять.** Отвергнуто: половинчато — `/start` всё равно грузит файл, токены на чтение тратятся, расхождение «лог vs git» только растёт.
- **B. Сжать DEV_LOG до последних N сессий (rolling window).** Отвергнуто: добавляет ручную работу по обрезке, дублирует `git log --since`, не устраняет корневой антипаттерн.
- **C. Перенести в GitHub Releases / wiki.** Отвергнуто: те же данные уже в `git log` + тела PR; отдельная площадка — лишний слой.

## Связано

- brain_matrica [ADR-0003 token economy](../../../brain_matrica/adr/0003-token-economy-principles.md), pool [#004](../../../brain_matrica/cross-project-ideas/ideas/004-minimalist-ai-docs-2026.md), [#003 session-handoff](../../../brain_matrica/cross-project-ideas/ideas/003-session-handoff.md)
- [ADR-0002](../../../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md) — PR-only flow (тело PR = changelog)
- Отчёт brain'у — `mailbox/to-brain/2026-05-31-archive-development-log.md`
