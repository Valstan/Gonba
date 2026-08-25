#!/usr/bin/env bash
#
# Забрать секреты комнаты GONBA из KARMAN и влить их в /etc/gonba/gonba.env.
#
# Цель — решение владельца 2026-08-25: «уйти от ручных правок конфигов на продах,
# от лазания вручную по прод-серверам». Ключ кладётся в комнату КАРМАНа, а на
# сервер его доставляет деплой.
#
# ЗАПУСКАЕТСЯ НА БОКСЕ, а не в раннере, и это не деталь, а суть дизайна:
#
#   1. КАРМАН наружу не смотрит — он слушает loopback. Из GitHub-раннера до него
#      достучаться нельзя, и выставлять его наружу ради деплоя было бы разменом
#      в неверную сторону.
#   2. Значения секретов не проходят через раннер вообще: обмен, чтение и запись
#      происходят внутри бокса.
#   3. На боксе не остаётся НИ ОДНОГО долгоживущего токена. Раннер передаёт сюда
#      OIDC-удостоверение (живёт минуты, одноразовое по jti), скрипт меняет его
#      на часовой токен комнаты и гасит этот токен сам, не дожидаясь срока.
#
# Вход: OIDC-JWT на stdin. Именно stdin, а не аргумент и не переменная окружения —
# аргументы видны в `ps` любому пользователю бокса, а бокс общий с соседями.
#
# Использование (из деплоя):
#   printf '%s' "$ASSERTION" | ssh GONBA 'sudo /home/valstan/GONBA/scripts/pull-secrets-from-vault.sh'
#
# Коды возврата: 0 — секреты влиты либо осознанно пропущены (мягкий отказ);
#                1 — ошибка, из-за которой env мог остаться в неконсистентном виде.
#
# Мягкий отказ (комната недоступна, личность не заведена, пустой ответ) НЕ валит
# деплой: приложение поднимется на том, что уже лежит в gonba.env. Но кричит в
# stdout заметно — молчаливый пропуск здесь был бы ровно тем классом, который мы
# ловили весь день: фолбэк, неотличимый от успеха.

set -euo pipefail

VAULT_BASE="${KARMAN_VAULT_BASE:-http://127.0.0.1:3002}"
ENV_FILE="${GONBA_ENV_FILE:-/etc/gonba/gonba.env}"
CURL_TIMEOUT=10

log()  { printf '[vault] %s\n' "$*"; }
warn() { printf '[vault] ⚠ %s\n' "$*" >&2; }

soft_skip() {
  warn "$1"
  warn "Секреты из комнаты НЕ доставлены. Сервис поднимется на текущем ${ENV_FILE}."
  exit 0
}

ASSERTION="$(cat)"
[ -n "$ASSERTION" ] || soft_skip "OIDC-удостоверение не пришло на stdin."

command -v jq >/dev/null || { warn "jq не установлен на боксе"; exit 1; }
[ -f "$ENV_FILE" ] || { warn "$ENV_FILE не существует"; exit 1; }

# --- 1. Паспортный обмен: удостоверение → часовой токен своей комнаты ----------
SESSION_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" -X POST "$VAULT_BASE/api/secrets/session" \
  -H "Authorization: Bearer $ASSERTION" -w '\n%{http_code}' || true)"
SESSION_CODE="$(printf '%s' "$SESSION_JSON" | tail -n1)"
SESSION_BODY="$(printf '%s' "$SESSION_JSON" | sed '$d')"

case "$SESSION_CODE" in
  201) : ;;
  403) soft_skip "КАРМАН не знает нашу личность (403). Нужна строка в passport_identity." ;;
  401) soft_skip "КАРМАН отверг удостоверение (401): подпись, срок, ветка или повтор jti." ;;
  503) soft_skip "КАРМАН не смог проверить подпись (503): JWKS издателя недоступен." ;;
  *)   soft_skip "Паспортный обмен вернул HTTP ${SESSION_CODE:-нет ответа}." ;;
esac

TOKEN="$(printf '%s' "$SESSION_BODY" | jq -r '.token // empty')"
[ -n "$TOKEN" ] || soft_skip "Паспортный обмен прошёл, но токена в ответе нет."

SLUG="$(printf '%s' "$SESSION_BODY" | jq -r '.slug // "?"')"
CAN_WRITE="$(printf '%s' "$SESSION_BODY" | jq -r '.canWrite // false')"
STALE="$(printf '%s' "$SESSION_BODY" | jq -r '.jwksStale // false')"
log "комната: ${SLUG}, запись: ${CAN_WRITE}"
[ "$STALE" = "true" ] && warn "подпись проверена по устаревшему снимку ключей — стоит глянуть сеть у КАРМАНа"

# Гасим токен сами при любом исходе: держатель обязан уметь отозвать его без
# владельца, иначе «короткоживущий» — это просто «живёт час».
revoke() {
  curl -sS --max-time "$CURL_TIMEOUT" -X DELETE "$VAULT_BASE/api/secrets/session" \
    -H "Authorization: Bearer $TOKEN" >/dev/null 2>&1 && log "токен сессии отозван" \
    || warn "не удалось отозвать токен сессии — истечёт сам"
}
trap revoke EXIT

# --- 2. Чтение комнаты --------------------------------------------------------
SECRETS_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" "$VAULT_BASE/api/secrets" \
  -H "Authorization: Bearer $TOKEN" -w '\n%{http_code}' || true)"
SECRETS_CODE="$(printf '%s' "$SECRETS_JSON" | tail -n1)"
SECRETS_BODY="$(printf '%s' "$SECRETS_JSON" | sed '$d')"
[ "$SECRETS_CODE" = "200" ] || soft_skip "Чтение комнаты вернуло HTTP ${SECRETS_CODE:-нет ответа}."

COUNT="$(printf '%s' "$SECRETS_BODY" | jq -r '.secrets | length')"
log "в комнате ключей: ${COUNT}"
[ "$COUNT" -gt 0 ] || soft_skip "Комната пуста — вливать нечего."

# --- 3. Слияние в env ---------------------------------------------------------
# Слияние выполняет отдельный файл, а не heredoc: первая версия была встроенной
# (`python3 - "$ENV_FILE" <<'PY'`) и слегла на первом же боевом прогоне —
# `python3 -` читает ПРОГРАММУ из stdin, туда же лился JSON. Два потребителя
# одного stdin. Отдельный файл заодно покрывается юнит-тестом в CI.
MERGE="$(dirname "$(readlink -f "$0")")/merge-env-from-vault.mjs"
[ -f "$MERGE" ] || { warn "не найден $MERGE"; exit 1; }

if ! printf '%s' "$SECRETS_BODY" | node "$MERGE" "$ENV_FILE"; then
  # Слияние атомарное: при сбое env остался прежним целым файлом, поэтому
  # деплой можно продолжать. Но это НАША ошибка, а не недоступность комнаты —
  # кричим ::error::, чтобы аннотация всплыла в сводке прогона.
  echo "::error::[vault] слияние секретов не удалось — env остался прежним, ключи из комнаты НЕ доставлены"
  exit 0
fi

log "готово"
