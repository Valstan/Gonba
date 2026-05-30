---
from: GONBA
to: brain
date: 2026-05-30
topic: Session sync safeguard (pool #010) — все 6 пунктов применены
kind: feedback
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-30-session-sync-safeguard.md
---

# Директива #010 (session sync safeguard) — применена ✅ (mandate)

Директива `2026-05-30-session-sync-safeguard` (compliance=mandate) применена в окне between threads. Все 6 пунктов выполнены.

## Что сделано (по пунктам директивы)

1. **`scripts/git_sync_check.sh`** — детектор синхронизации, `--warn` (всегда `exit 0`, best-effort `git fetch` с таймаутом 5s, офлайн не ломает) и `--gate` (`exit 1` пока дерево не чистое+запушено). Скрипт взят у setka **дословно** — он git-агностичен (имя репо вычисляется из `git toplevel`, путей не зашито). Проверен на этой Windows-машине (Git Bash): `--warn` → `exit 0`, `--gate` → `exit 1` при незакоммиченном/без-upstream.

2. **SessionStart-хук** в `.claude/settings.json` (matcher `startup|resume`) → `bash "${CLAUDE_PROJECT_DIR}/scripts/git_sync_check.sh" --warn`. **Adaptation note ниже — про `.gitignore`.**

3. **`/close_session` с жёстким sync-гейтом.** `.claude/commands/close_session.md`:
   - Новый **Шаг 5.6 «Sync-гейт (жёсткий)»** — `git_sync_check.sh --gate` должен вернуть `exit 0`, иначе сессия не считается закрытой.
   - **Шаг 5 расширен** с «коммит только handoff» → «коммит+пуш ВСЕГО (код+доки) через PR-flow» (5a рабочий код → 5b handoff → 5c PR). Убрал устаревший direct `git push origin main` (branch protection его блокирует, ADR-0002).
   - Шаг 1 контекста печатает `--gate`-статус сразу; Шаг 6 отчёта подтверждает «✅ всё на GitHub».
   - Описание команды (frontmatter) → «ЕДИНСТВЕННАЯ команда закрытия» + NL-триггеры.
   - **`/finish` у GONBA не было** — схлопывать нечего (в отличие от setka).

4. **Правило в `CLAUDE.md`** — новый подраздел «Session sync safeguard — GitHub источник истины между машинами» в блоке «Правила, которые НЕ менять». Плюс обновлён п.5 «Жизненный цикл задачи».

5. **NL-триггер** «закрой сессию» / «заверши сессию» / «закрываемся» → `/close_session` (в `description` команды и в правиле `CLAUDE.md`).

6. **Ручной шаг владельца** (отключить тумблер Cowork «Classify session states») — задокументирован footer-нотой в `/close_session` и в правиле `CLAUDE.md`. **@valstan — это твой шаг в UI Cowork, кодом не делается.**

## Adaptation notes (переносимое для pool #010)

- **`.gitignore`-ловушка для коммитимого `settings.json`.** У GONBA `.gitignore` имел `.claude/*` с whitelist только `!.claude/commands/` и `!.claude/agents/` — то есть `.claude/settings.json` был **бы проигнорирован**, и хук не разъехался бы на другие машины (вся суть п.2 ломается молча). Поймал тем, что `git_sync_check.sh --warn` показал «1 файл» вместо 2 после создания скрипта+settings. Добавил `!.claude/settings.json` в `.gitignore`. **Проектам с blanket-ignore `.claude/*` — обязательно добавить исключение для `settings.json`, иначе SessionStart-хук не коммитится.** Стоит упомянуть в pool #010 как чек-лист-пункт.
- **Не делал `ssh GONBA` allow в `settings.json`** (у setka он есть) — это пересеклось бы с директивой #006 (full-session SSH opt-in через `/start`), которая **явно запрещает** глобальный allowlist. `settings.json` у GONBA содержит только SessionStart-хук.

## PR

[Valstan/Gonba#PRNUM](https://github.com/Valstan/Gonba/pull/PRNUM) — `chore(session): session sync safeguard (pool #010)`.
