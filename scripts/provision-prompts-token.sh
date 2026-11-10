#!/usr/bin/env bash
#
# Выпустить секционный токен промтов Гоньбы и предложить его обслуживающей комнате.
#
# Мандат Мозга 08.11 (D-190) + erratum 09.11: проект забирает СВОИ промты и планы
# из раздела КАРМАНА. Механика:
#
#   1. Значение живёт в НАШЕЙ комнате под именем PROMPTS_TOKEN_GONBA.
#   2. Обслуживающая комната получает его ГРАНТОМ (POST /api/secrets/grants).
#   3. Значение доезжает до env бокса шагом доставки в деплое
#      (merge-env-from-vault.mjs фильтра не имеет — вливаются все ключи комнаты).
#
# ПОЧЕМУ target_slug приходит снаружи, а не берётся из шаблона:
# erratum от 09.11 — «karman» из шаблона мандата это ИМЯ из реестра, а не факт.
# Факт — slug комнаты, из которой сервис реально читает секреты; он берётся из
# GET /api/secrets/self на боксе, который отдаёт /api/prompts/section. Грант в
# комнату, которую сервис НЕ читает, принимается (201, pending → active), токен
# в неё кладётся — и раздел остаётся 503. Симптом неотличим от «токена нет».
# Поэтому ниже шаг 4 ПРОВЕРЯЕТ адресата, а не только результат.
#
# ЗАПУСКАЕТСЯ НА БОКСЕ (вход: OIDC-JWT на stdin). Причина та же, что у
# pull-secrets-from-vault.sh: КАРМАН слушает loopback, из раннера до него не
# достучаться, и значения секретов через раннер не ходят вообще — токен
# генерируется здесь, уходит в комнату и оттуда в env.
#
#   printf '%s' "$ASSERTION" | ssh GONBA 'bash /home/valstan/GONBA/scripts/provision-prompts-token.sh'
#
# Значение токена НИКОГДА не печатается: ни в лог, ни в stdout, ни в stderr.
# Печатаются только имена ключей, коды ответов и состояние гранта.
#
# Коды возврата:
#   0 — токен выпущен, записан в комнату, грант предложен; раздел читается (200)
#       ИЛИ грант ждёт приёма владельцем (pending — это не ошибка, а один клик).
#   1 — ошибка исполнения (обмен не прошёл, запись не удалась, грант не создан).

set -euo pipefail

VAULT_BASE="${KARMAN_VAULT_BASE:-http://127.0.0.1:3002}"
SECTION_KEY="PROMPTS_TOKEN_GONBA"
PROJECT="GONBA"
CURL_TIMEOUT=10

log()  { printf '[prompts] %s\n' "$*"; }
warn() { printf '[prompts] ⚠ %s\n' "$*" >&2; }
fail() { printf '[prompts] ОШИБКА: %s\n' "$*" >&2; exit 1; }

command -v jq >/dev/null || fail "jq не установлен на боксе"

TARGET_SLUG="${TARGET_SLUG:-}"
[ -n "$TARGET_SLUG" ] || fail "не задан TARGET_SLUG (комната-получатель)"

ASSERTION="$(cat)"
[ -n "$ASSERTION" ] || fail "OIDC-удостоверение не пришло на stdin"

# --- 1. Паспортный обмен: удостоверение → часовой токен своей комнаты ----------
SESSION_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" -X POST "$VAULT_BASE/api/secrets/session" \
  -H "Authorization: Bearer $ASSERTION" -w '\n%{http_code}' || true)"
SESSION_CODE="$(printf '%s' "$SESSION_JSON" | tail -n1)"
SESSION_BODY="$(printf '%s' "$SESSION_JSON" | sed '$d')"

case "$SESSION_CODE" in
  201) : ;;
  403) fail "КАРМАН не знает нашу личность (403) — нужна строка в passport_identity" ;;
  401) fail "КАРМАН отверг удостоверение (401): подпись, срок, ветка или повтор jti" ;;
  503) fail "КАРМАН не смог проверить подпись (503): JWKS издателя недоступен" ;;
  *)   fail "паспортный обмен вернул HTTP ${SESSION_CODE:-нет ответа}" ;;
esac

TOKEN="$(printf '%s' "$SESSION_BODY" | jq -r '.token // empty')"
[ -n "$TOKEN" ] || fail "обмен прошёл, но токена в ответе нет"

ROOM_SLUG="$(printf '%s' "$SESSION_BODY" | jq -r '.slug // "?"')"
CAN_WRITE="$(printf '%s' "$SESSION_BODY" | jq -r '.canWrite // false')"
log "комната: ${ROOM_SLUG}, запись: ${CAN_WRITE}"
[ "$CAN_WRITE" = "true" ] || fail "комната ${ROOM_SLUG} не даёт запись (canWrite=false)"

revoke() {
  curl -sS --max-time "$CURL_TIMEOUT" -X DELETE "$VAULT_BASE/api/secrets/session" \
    -H "Authorization: Bearer $TOKEN" >/dev/null 2>&1 && log "токен сессии отозван" \
    || warn "не удалось отозвать токен сессии — истечёт сам"
}
trap revoke EXIT

# --- 2. Значение токена: 32+ случайных байт, base64url ------------------------
# Значение НИГДЕ не печатается и не покидает бокс.
VALUE="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64url"))')"
[ -n "$VALUE" ] || fail "не удалось сгенерировать значение"

# --- 3. Запись в нашу комнату -------------------------------------------------
WRITE_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" -X POST "$VAULT_BASE/api/secrets" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -n --arg k "$SECTION_KEY" --arg v "$VALUE" '{secrets:{($k):$v}}')" \
  -w '\n%{http_code}' || true)"
WRITE_CODE="$(printf '%s' "$WRITE_JSON" | tail -n1)"
WRITE_BODY="$(printf '%s' "$WRITE_JSON" | sed '$d')"
case "$WRITE_CODE" in
  200|201) log "записано в комнату: ${SECTION_KEY}" ;;
  *) warn "ответ записи: $(printf '%s' "$WRITE_BODY" | head -c 200)"; fail "запись не удалась (HTTP ${WRITE_CODE:-нет ответа})" ;;
esac

# --- 4. Грант обслуживающей комнате -------------------------------------------
GRANT_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" -X POST "$VAULT_BASE/api/secrets/grants" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -n --arg k "$SECTION_KEY" --arg t "$TARGET_SLUG" --arg a "$SECTION_KEY" \
            '{key:$k, target_slug:$t, alias:$a, note:"Токен раздела промтов GONBA — проект читает свой раздел и архивирует выполненное (D-190)"}')" \
  -w '\n%{http_code}' || true)"
GRANT_CODE="$(printf '%s' "$GRANT_JSON" | tail -n1)"
GRANT_BODY="$(printf '%s' "$GRANT_JSON" | sed '$d')"
case "$GRANT_CODE" in
  200|201) : ;;
  *) warn "ответ гранта: $(printf '%s' "$GRANT_BODY" | head -c 300)"; fail "грант не создан (HTTP ${GRANT_CODE:-нет ответа})" ;;
esac

GRANT_ID="$(printf '%s' "$GRANT_BODY" | jq -r '.id // .grantId // "?"')"
GRANT_STATE="$(printf '%s' "$GRANT_BODY" | jq -r '.state // .status // "?"')"
log "грант создан: id=${GRANT_ID}, состояние=${GRANT_STATE}, получатель=${TARGET_SLUG}"

# --- 5. Read-back: значение на месте и совпадает с тем, что мы записали --------
BACK_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" "$VAULT_BASE/api/secrets?key=${SECTION_KEY}" \
  -H "Authorization: Bearer $TOKEN" -w '\n%{http_code}' || true)"
BACK_CODE="$(printf '%s' "$BACK_JSON" | tail -n1)"
BACK_BODY="$(printf '%s' "$BACK_JSON" | sed '$d')"
[ "$BACK_CODE" = "200" ] || fail "read-back вернул HTTP ${BACK_CODE:-нет ответа}"
BACK_VALUE="$(printf '%s' "$BACK_BODY" | jq -r --arg k "$SECTION_KEY" '.secrets[$k] // empty')"
[ -n "$BACK_VALUE" ] || fail "read-back: ключа ${SECTION_KEY} нет в комнате"
if [ "$BACK_VALUE" = "$VALUE" ]; then log "read-back: значение на месте и совпадает"; else fail "read-back: значение не совпадает с записанным"; fi

# --- 6. Проверка адресата: читает ли сервис наш раздел ------------------------
# 200 — грант принят и раздел читается. 503 — либо грант ждёт приёма, либо
# адресат не тот (сервис читает другую комнату). Различаем по состоянию гранта.
SECTION_CODE="$(curl -sS --max-time "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' \
  "$VAULT_BASE/api/prompts/section?project=${PROJECT}" \
  -H "Authorization: Bearer $VALUE" || true)"
log "GET /api/prompts/section?project=${PROJECT} -> HTTP ${SECTION_CODE:-нет ответа}"

if [ "$SECTION_CODE" = "200" ]; then
  log "канал поднят: токен в env кладёт шаг доставки деплоя, раздел читается"
  exit 0
fi

if [ "$GRANT_STATE" = "pending" ]; then
  warn "грант ждёт приёма владельцем (state=pending) — это один клик в GUI КАРМАНа."
  warn "после приёма раздел начнёт отдавать 200; токен в env приедет с деплоем."
  exit 0
fi

warn "раздел не читается (HTTP ${SECTION_CODE:-нет ответа}), состояние гранта=${GRANT_STATE}."
warn "если грант принят, а 503 остался — адресат не тот: фактический slug берётся"
warn "из GET /api/secrets/self на боксе, который отдаёт /api/prompts/section."
exit 1
