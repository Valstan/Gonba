#!/usr/bin/env bash
# G463: opencode распаковывает fff-библиотеку в /tmp (≈5.5 МБ за каждый запуск) и
# не подчищает; на боксе с Postgres это однажды закончилось диском 100% и 500 на записи.
#
# Юнит opencode-web изолирован PrivateTmp=yes, поэтому его утечка в общий /tmp не идёт.
# Эта метёлка — страховка для запусков ВНЕ юнита (ручной TUI по SSH, соседи по боксу).
#
# Запускается таймером opencode-tmp-sweep.timer от root каждые 15 минут.
# Форма имени одна: <префикс>-00000000.so / .dylib, префикс случаен (,bcdf`, ,9a`, …).
set -uo pipefail

THRESHOLD_MIN="${THRESHOLD_MIN:-60}"
TMP_DIRS="${TMP_DIRS:-/tmp /var/tmp}"

removed=0
recent=0
for dir in $TMP_DIRS; do
  [ -d "$dir" ] || continue
  removed=$(( removed + $(find "$dir" -maxdepth 1 -type f \
      \( -name '*-00000000.so' -o -name '*-00000000.dylib' \) \
      -mmin +"$THRESHOLD_MIN" -print -delete 2>/dev/null | wc -l) ))
  recent=$(( recent + $(find "$dir" -maxdepth 1 -type f \
      \( -name '*-00000000.so' -o -name '*-00000000.dylib' \) \
      -mmin -"$THRESHOLD_MIN" 2>/dev/null | wc -l) ))
done

read -r avail_mb used_pct <<<"$(df -Pk / | awk 'NR==2 {printf "%.0f %s", $4/1024, $5}')"
line="opencode-tmp-sweep: удалено=$removed (старше ${THRESHOLD_MIN}мин) оставлено=$recent свежих, диск: ${avail_mb}МБ свободно (${used_pct})"
echo "$line"

# Пишем в journal только когда есть что сказать: уборка или подозрительно полный диск.
if [ "$removed" -gt 0 ] || [ "${used_pct%\%}" -ge 85 ]; then
  logger -t opencode-tmp-sweep "$line"
fi

exit 0
