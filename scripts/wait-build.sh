#!/usr/bin/env bash
# wait-build.sh — ждать завершения gonba-build (запущенного через safe-build.sh)
# и проверить что .next/ собрался полностью (prerender-manifest.json + BUILD_ID).
#
# Возвращает exit 0 если всё успешно, exit 1 если build упал, exit 2 если timeout.

set -uo pipefail

UNIT_NAME="gonba-build"
WEB_DIR="/home/valstan/GONBA/web"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-1200}"  # 20 минут по умолчанию

deadline=$(($(date +%s) + TIMEOUT_SECONDS))

echo "[wait-build] Ждём ${UNIT_NAME} (timeout ${TIMEOUT_SECONDS}s)…"

while [ $(date +%s) -lt $deadline ]; do
  state=$(systemctl is-active "${UNIT_NAME}" 2>&1 || true)
  if [ "$state" != "active" ] && [ "$state" != "activating" ]; then
    # Unit завершился (или вообще не запускался)
    if [ -f "${WEB_DIR}/.next/prerender-manifest.json" ] && [ -f "${WEB_DIR}/.next/BUILD_ID" ]; then
      build_id=$(cat "${WEB_DIR}/.next/BUILD_ID")
      echo "[wait-build] BUILD_OK: ${build_id} (state=${state})"
      exit 0
    else
      echo "[wait-build] BUILD_FAILED: state=${state}, .next неполный"
      echo "[wait-build] Последние 30 строк лога:"
      sudo journalctl -u "${UNIT_NAME}" --no-pager 2>&1 | tail -30
      exit 1
    fi
  fi
  sleep 20
done

echo "[wait-build] TIMEOUT после ${TIMEOUT_SECONDS}s — build всё ещё активен."
echo "[wait-build] Чтобы посмотреть прогресс: sudo journalctl -u ${UNIT_NAME} -f"
exit 2
