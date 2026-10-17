#!/usr/bin/env bash
# Печатает одноразовую ссылку входа в веб-UI OpenCode (пароль сервера не печатается).
#
# Запуск на прод-боксе:
#   opencode-pair-link [REMOTE_PORT] [LOCAL_PORT]
#   REMOTE_PORT — порт сервера на боксе (по умолчанию 49374)
#   LOCAL_PORT  — порт, на котором туннель виден на компьютере владельца
#                 (его же подставляем в ссылку, чтобы она открывалась в браузере)
#
# code живёт 5 минут; cookie-сессия после входа — ≈30 дней.
set -euo pipefail

REMOTE_PORT="${1:-49374}"
LOCAL_PORT="${2:-$REMOTE_PORT}"
ENV_FILE="${OPENCODE_WEB_ENV:-$HOME/.config/opencode-web/anon.env}"
SERVER="${OPENCODE_WEB_SERVER:-http://127.0.0.1:$REMOTE_PORT}"

if [ ! -r "$ENV_FILE" ]; then
  echo "нет файла пароля: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${OPENCODE_PASSWORD:?OPENCODE_PASSWORD не задан в $ENV_FILE}"

resp="$(opencode api --server "$SERVER" POST /api/pair)"
code="$(printf '%s' "$resp" | sed -n 's/.*"code"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [ -z "$code" ]; then
  echo "не удалось получить код сопряжения; ответ сервера: $resp" >&2
  exit 1
fi

echo "http://127.0.0.1:${LOCAL_PORT}/auth/connect/${code}"
