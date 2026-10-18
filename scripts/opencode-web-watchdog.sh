#!/usr/bin/env bash
# Сторож веб-сервера OpenCode: ловит состояние «юнит активен, а сервер молчит».
#
# Зачем отдельный сторож. 18.10.2026 вечер: cgroup упёрся в MemoryHigh=500M (548 МБ,
# memory pressure 100 %), до жёсткого MemoryMax=700M не дошёл — ядро никого не убило,
# `Restart=on-failure` не сработал, и сервер перестал отвечать, оставаясь «активным».
# Снаружи это выглядит как «служба выключена, поднимаю её», и ярлык владельца застревал
# в цикле: `systemctl start` по активному юниту — пустая операция. Сторож закрывает ровно
# этот класс: активен и молчит LIMIT проверок подряд → `restart` (то, что лечит), и запись
# в журнал — чтобы потом было видно, кто и когда это сделал.
#
# Чего сторож НЕ делает: не поднимает службу, выключенную владельцем ярлыком «выключить»
# (-Off). Выключенная служба — решение владельца, а не авария: увидел не `active` → молча
# вышел и обнулил счётчик.
#
# Запускается таймером opencode-web-watchdog.timer от root каждые 2 минуты.
# Переменные окружения — для проверки самого сторожа вхолостую (OC_WD_DRY=1) и для тестов:
#   OC_WD_UNIT, OC_WD_PORT, OC_WD_LIMIT, OC_WD_STRIKES_DIR, OC_WD_DRY
set -uo pipefail

UNIT="${OC_WD_UNIT:-opencode-web}"
PORT="${OC_WD_PORT:-49374}"
LIMIT="${OC_WD_LIMIT:-3}"
STRIKES_DIR="${OC_WD_STRIKES_DIR:-/run/opencode-web-watchdog}"
DRY="${OC_WD_DRY:-0}"

STRIKES_FILE="$STRIKES_DIR/$UNIT.strikes"
TAG='opencode-web-watchdog'

# Выключенная (или ещё не поднятая) служба — не наша забота.
if ! systemctl is-active --quiet "$UNIT"; then
  rm -f "$STRIKES_FILE"
  exit 0
fi

mkdir -p "$STRIKES_DIR"

# 000 у curl — «не ответил»: соединение не принято, таймаут или ответ пустой.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/api/info" 2>/dev/null)
case "$code" in
  ''|*[!0-9]*) code=000 ;;
esac
if [ "$code" != "000" ]; then
  rm -f "$STRIKES_FILE"
  exit 0
fi

strikes=$(cat "$STRIKES_FILE" 2>/dev/null)
case "$strikes" in
  ''|*[!0-9]*) strikes=0 ;;
esac
strikes=$(( strikes + 1 ))
echo "$strikes" > "$STRIKES_FILE"

mem_bytes=$(systemctl show "$UNIT" -p MemoryCurrent | sed 's/^MemoryCurrent=//')
case "$mem_bytes" in
  ''|*[!0-9]*) mem_mb='неизвестно' ;;
  *) mem_mb="$(( mem_bytes / 1048576 ))МБ" ;;
esac
pressure=$(sed -n 1p "/sys/fs/cgroup/system.slice/$UNIT.service/memory.pressure" 2>/dev/null)

line="$TAG: $UNIT активен, но http://127.0.0.1:$PORT/api/info не отвечает ($strikes/$LIMIT), память=$mem_mb ${pressure}"

if [ "$strikes" -lt "$LIMIT" ]; then
  echo "$line"
  logger -t "$TAG" "$line"
  exit 0
fi

rm -f "$STRIKES_FILE"
if [ "$DRY" = "1" ]; then
  echo "$line"
  echo "$TAG: OC_WD_DRY=1 — перезапуск не выполняю (проверка сторожа вхолостую)"
  exit 0
fi

echo "$line"
logger -t "$TAG" "$line"
logger -t "$TAG" "$TAG: перезапускаю $UNIT — молчал $LIMIT проверки подряд"
systemctl restart "$UNIT"
code_after=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:$PORT/api/info" 2>/dev/null)
case "$code_after" in
  ''|*[!0-9]*) code_after=000 ;;
esac
echo "$TAG: перезапуск $UNIT выполнен, ответ на боксе: $code_after"
logger -t "$TAG" "$TAG: перезапуск $UNIT выполнен, ответ на боксе: $code_after"

exit 0
