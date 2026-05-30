#!/usr/bin/env bash
# safe-build.sh — безопасная сборка GONBA web на проде.
#
# Lesson learned (2026-05-20):
#   - Прямой `corepack pnpm run build:raw` через одну SSH-сессию умирает посередине
#     prerender'а при SSH-disconnect, оставляя «полуготовый» .next без
#     prerender-manifest.json. Сервис уходит в crash-loop с ENOENT.
#   - `pnpm run build` использует watchdog --idle-ms=180000, что мало для Next.js 15
#     (он молчит до 5-6 минут на компиляции).
#   - `systemd-run` без --uid=valstan берёт root's pnpm 11 — несовместим с engines.
#
# Этот скрипт запускает build через `systemd-run --unit=gonba-build --uid=valstan`,
# отключает прошлую failed unit, чистит .next, и НЕ ждёт завершения сам —
# даёт фоновому процессу работать. Возвращает сразу.
#
# Чтобы дождаться завершения — запусти отдельный poller:
#   /home/valstan/GONBA/scripts/wait-build.sh
#
# Usage (на проде):
#   /home/valstan/GONBA/scripts/safe-build.sh
#
# Usage (с локалки через SSH):
#   ssh GONBA "/home/valstan/GONBA/scripts/safe-build.sh"

set -euo pipefail

WEB_DIR="/home/valstan/GONBA/web"
UNIT_NAME="gonba-build"
USER_NAME="valstan"
# Секреты/конфиг живут вне дерева репо (pool #008 / ADR-0005). Раньше Next.js
# автозагружал web/.env из cwd на build'е; после переноса в /etc/gonba/gonba.env
# его больше нет в дереве — поэтому EnvironmentFile передаём явно в transient unit.
ENV_FILE="/etc/gonba/gonba.env"

echo "[safe-build] Сбрасываем failed-state ${UNIT_NAME} (если есть)…"
sudo systemctl reset-failed "${UNIT_NAME}" 2>/dev/null || true

echo "[safe-build] Останавливаем активный билд (если запущен)…"
sudo systemctl stop "${UNIT_NAME}" 2>/dev/null || true

echo "[safe-build] Чистим ${WEB_DIR}/.next…"
rm -rf "${WEB_DIR}/.next"

echo "[safe-build] Запускаем build:raw через systemd-run --uid=${USER_NAME}…"
sudo systemd-run \
  --unit="${UNIT_NAME}" \
  --uid="${USER_NAME}" \
  --gid="${USER_NAME}" \
  --working-directory="${WEB_DIR}" \
  -p "EnvironmentFile=${ENV_FILE}" \
  -- /bin/bash -lc "corepack pnpm run build:raw"

echo ""
echo "[safe-build] Build стартовал в фоне как systemd unit '${UNIT_NAME}'."
echo "[safe-build] Чтобы дождаться завершения, запусти на этой же машине:"
echo "    /home/valstan/GONBA/scripts/wait-build.sh"
echo "[safe-build] Или из локалки:"
echo "    ssh GONBA '/home/valstan/GONBA/scripts/wait-build.sh'"
echo ""
echo "[safe-build] Логи в реальном времени:"
echo "    sudo journalctl -u ${UNIT_NAME} -f"
