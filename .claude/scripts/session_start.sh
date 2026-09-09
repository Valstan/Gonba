#!/usr/bin/env bash
# SessionStart hook (pool #268, D-066): печатает состояние git и handoff при открытии
# сессии, чтобы агент стартовал в контексте без ритуала чтения.
#
# Только чтение, без сети: синхронизацию с origin делает /start шаг 0, хук её НЕ подменяет.
# Поэтому handoff здесь — тот, что лежит на диске, и он может быть старше origin.
#
# Вызов: bash .claude/scripts/session_start.sh  (из .claude/settings.json → hooks.SessionStart)

cd "$(dirname "$0")/../.." || exit 0

# Потолок вывода handoff'а. Файл растёт от сессии к сессии, а хук исполняется на КАЖДОМ
# старте и resume — без потолка распухший handoff молча съедал бы контекст (ADR-0003).
MAX_HANDOFF_LINES=80

echo "=== GONBA · SessionStart · $(hostname) · $(date +%F) ==="
git status -sb 2>/dev/null | head -5
git log --oneline -3 2>/dev/null
echo
echo "--- docs/SESSION_HANDOFF.md (как лежит на диске, до pull) ---"
if [ -f docs/SESSION_HANDOFF.md ]; then
  head -n "$MAX_HANDOFF_LINES" docs/SESSION_HANDOFF.md
  total=$(wc -l < docs/SESSION_HANDOFF.md)
  if [ "$total" -gt "$MAX_HANDOFF_LINES" ]; then
    echo "…обрезано на $MAX_HANDOFF_LINES из $total строк — целиком в docs/SESSION_HANDOFF.md"
  fi
else
  echo "(handoff не найден)"
fi
echo
echo "--- Дальше: /start (полный проход, включая sync и почту). Канон: .claude/commands/start.md ---"
exit 0
