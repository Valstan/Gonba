#!/usr/bin/env bash
# deploy_gate_check.sh — машинный гейт G24: «можно ли мержить следующий PR».
#
# Что проверяет: нет ли **деплоя в полёте** (`deploy-prod.yml` в статусе ≠ `completed`).
#
# Почему это отдельный гейт. Деплой стартует не от мержа, а от **завершения CI**
# (`workflow_run`), поэтому между мержем и стартом деплоя есть окно в минуты.
# Смерженный в это окно второй PR ломает деплой первого: тот подтягивает `main`
# на боксе, видит там уже чужой коммит и падает на сверке `EXPECTED_SHA`. Гейт
# срабатывает верно — прод не портится и остаётся на старом релизе, — но прогон
# красный, и разбираться в нём приходится посреди следующей работы.
#
# Правило живёт текстом с 2026-08-30 — и было нарушено человеком, который читал
# тот же текст. Поэтому проверка стала машинной: `AGENTS.md` описывает правило,
# `/reliz` шаг 6 вызывает этот скрипт **до** `gh pr merge`.
#
# Режимы:
#   --warn  : печатает состояние деплоя, ВСЕГДА exit 0 — необязательное напоминание.
#   --gate  : exit 0 — деплоев в полёте нет, мержить можно;
#             exit 1 — деплой идёт, мерж сломает его на `EXPECTED_SHA`;
#             exit 2 — проверить не удалось (нет gh / не авторизован / GitHub молчит).
#             «Не удалось проверить» ≠ «зелено»: гейт фейлит закрыто, иначе он
#             декоративен (класс #228 — гейт, который не может отказать).
#
# Настройки для переноса в другой проект: `DEPLOY_WORKFLOW` (по умолчанию
# `deploy-prod.yml`), `DEPLOY_RUN_LIMIT` (по умолчанию 10).
#
# Кросс-платформенно: вызывать через `bash` (Git Bash на Windows, системный bash
# на Linux). JSON разбирает сам `gh --jq` — отдельный `jq` не нужен.
#
# Usage:
#   bash scripts/deploy_gate_check.sh --gate
#   bash scripts/deploy_gate_check.sh --warn

set -u

MODE="${1:---warn}"
case "$MODE" in
  --gate|--warn) ;;
  *)
    printf 'usage: bash scripts/deploy_gate_check.sh [--gate|--warn]\n' >&2
    exit 2
    ;;
esac

WORKFLOW="${DEPLOY_WORKFLOW:-deploy-prod.yml}"
LIMIT="${DEPLOY_RUN_LIMIT:-10}"

# Непроверяемое состояние: честно называем, что гейт не отработал.
unverifiable() {
  printf '⚠️  ДЕПЛОЙ-ГЕЙТ: проверить не удалось — %s\n' "$1"
  printf 'Это НЕ зелёный результат. Посмотри состояние руками: '
  printf 'gh run list --workflow=%s --limit 5 --json status,conclusion,headSha\n' "$WORKFLOW"
  if [ "$MODE" = "--gate" ]; then
    exit 2
  fi
  exit 0
}

command -v gh >/dev/null 2>&1 || unverifiable "gh не установлен или не в PATH"
gh auth status >/dev/null 2>&1 || unverifiable "gh не авторизован (нужен gh auth login)"

# Положительный контроль: workflow вообще существует в репозитории (ищем файлом —
# `--workflow` принимает и имя, и файл, но файл мы знаем точно). Без этой проверки
# опечатка в имени дала бы «прогонов нет», то есть зелёный гейт из ничего
# (класс #228: гейт, который не может отказать).
workflows=$(gh workflow list --all --limit 200 --json path 2>/dev/null) \
  || unverifiable "не удалось получить список workflow репозитория"
if ! printf '%s' "$workflows" | grep -q "\.github/workflows/${WORKFLOW}"; then
  unverifiable "workflow «${WORKFLOW}» не виден в репозитории (опечатка в имени? нет прав?)"
fi

inflight=$(gh run list --workflow="$WORKFLOW" --limit "$LIMIT" \
  --json status,databaseId,headSha,createdAt \
  --jq '[.[] | select(.status != "completed")] | map("  run \(.databaseId) — \(.status), \(.headSha[0:7]), начат \(.createdAt)") | join("\n")' 2>/dev/null) \
  || unverifiable "GitHub не ответил на gh run list"

last=$(gh run list --workflow="$WORKFLOW" --limit "$LIMIT" \
  --json status,conclusion,databaseId,headSha \
  --jq 'map(select(.status == "completed")) | if length == 0 then "нет" else (.[0] | "\(.databaseId) \(.conclusion) \(.headSha[0:7])") end' 2>/dev/null) \
  || unverifiable "GitHub не ответил на gh run list (повтор)"

if [ -n "$inflight" ]; then
  printf '⛔ G24: деплой в полёте — мерж следующего PR сломает его на сверке EXPECTED_SHA\n'
  printf '%s\n' "$inflight"
  printf 'Ждать завершения: gh run list --workflow=%s --limit 1 --json status,conclusion,headSha\n' "$WORKFLOW"
  if [ "$MODE" = "--gate" ]; then
    exit 1
  fi
  exit 0
fi

# Разбор последнего завершённого прогона: "<id> <conclusion> <sha>" или "нет".
set -- $last
last_id="${1:-нет}"
last_conclusion="${2:-}"
last_sha="${3:-}"

if [ "$last_id" = "нет" ]; then
  unverifiable "у workflow ${WORKFLOW} нет ни одного прогона в доступной истории — «пусто» не отличимо от нехватки прав, а подтвердить отсутствие деплоя нечем"
fi

printf 'OK (G24): деплоев в полёте нет. Последний завершённый — run %s (%s) на %s.\n' \
  "$last_id" "$last_conclusion" "$last_sha"

if [ "$last_conclusion" != "success" ]; then
  printf '⚠️  Он завершился с «%s» — прод остался на прежнем релизе.\n' "$last_conclusion"
  printf '   Мержу это не мешает (следующий деплой подхватит main целиком), но причину\n'
  printf '   стоит понять до мержа: gh run view %s --log-failed\n' "$last_id"
fi

exit 0
