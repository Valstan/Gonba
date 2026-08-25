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
# Слияние, а не перезапись: ключи, которых в комнате нет, остаются нетронутыми.
# Иначе первый же прогон стёр бы всё, что заводилось руками до переезда в комнату
# (соль хеша IP, номер счётчика Метрики и прочее), и мы бы узнали об этом по
# упавшему проду, а не по логу.
#
# Запись атомарная: временный файл рядом → chown/chmod → mv. Если процесс умрёт
# посередине, сервис прочитает старый целый файл, а не половину нового.
printf '%s' "$SECRETS_BODY" | python3 - "$ENV_FILE" <<'PY'
import json, os, stat, sys, tempfile

env_path = sys.argv[1]
secrets = json.load(sys.stdin).get('secrets') or {}

with open(env_path, 'r', encoding='utf-8') as fh:
    lines = fh.read().splitlines()

seen, out, updated = set(), [], []
for line in lines:
    stripped = line.lstrip()
    if not stripped or stripped.startswith('#') or '=' not in stripped:
        out.append(line)
        continue
    key = stripped.split('=', 1)[0].strip()
    if key in secrets:
        seen.add(key)
        new_line = f'{key}={secrets[key]}'
        if new_line != line:
            updated.append(key)
        out.append(new_line)
    else:
        out.append(line)

added = [k for k in secrets if k not in seen]
for key in added:
    out.append(f'{key}={secrets[key]}')

if not updated and not added:
    print('[vault] env уже совпадает с комнатой — файл не тронут')
    print('CHANGED=0')
    sys.exit(0)

st = os.stat(env_path)
directory = os.path.dirname(env_path) or '.'
fd, tmp = tempfile.mkstemp(dir=directory, prefix='.gonba.env.')
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out) + '\n')
    # chown есть не везде (на Windows его нет вовсе) — на боксе он обязателен,
    # но guard позволяет прогнать эту же логику на фикстуре с любой машины.
    if hasattr(os, 'chown'):
        os.chown(tmp, st.st_uid, st.st_gid)
    os.chmod(tmp, stat.S_IMODE(st.st_mode))
    os.replace(tmp, env_path)
except BaseException:
    os.path.exists(tmp) and os.unlink(tmp)
    raise

# Только ИМЕНА ключей. Значения не печатаем ни при каких обстоятельствах:
# вывод деплоя читаем не только мы.
if added:
    print('[vault] добавлено: ' + ', '.join(sorted(added)))
if updated:
    print('[vault] обновлено: ' + ', '.join(sorted(updated)))
print('CHANGED=1')
PY

log "готово"
