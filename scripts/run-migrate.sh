#!/usr/bin/env bash
# run-migrate.sh — `payload migrate` неинтерактивно (auto-confirm drizzle y/N).
#
# Why: `corepack pnpm payload migrate` (или `pnpm dev` с push:true) при
# существенных расхождениях схемы поднимает интерактивный y/N от drizzle.
# В headless-окружении (CI, фоновый SSH, GUI без TTY) этот prompt подвешивает
# процесс на минуты/часы (сессия 2026-05-21: 40+ минут до killing).
#
# Решение: `yes y |` подаёт «y\n» бесконечно на stdin — drizzle сразу
# принимает изменения и продолжает.
#
# Usage:
#   bash scripts/run-migrate.sh                  # на любой машине разработки
#   ssh GONBA "bash /home/valstan/GONBA/scripts/run-migrate.sh"  # на проде
#
# Если миграция не применяется из-за расхождения между drizzle-generated и
# нашим файлом миграции (наш кейс 2026-05-21) — fallback на SQL-зеркало:
#   ssh GONBA "cat /home/valstan/GONBA/web/src/migrations/<file>.sql | sudo -u postgres psql -d gonba"
#   ssh GONBA "sudo -u postgres psql -d gonba -c \"INSERT INTO payload_migrations (name, batch) VALUES (...)\""

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${REPO_ROOT}/web"

if [ ! -d "${WEB_DIR}" ]; then
  echo "❌ ${WEB_DIR} не найден — запусти из корня репо GONBA." >&2
  exit 1
fi

echo "[run-migrate] Запускаем 'corepack pnpm payload migrate' с auto-confirm…"
echo "[run-migrate] (При расхождении схемы drizzle спросит y/N — отвечаем 'y' автоматически)"
echo ""

# `yes y` бесконечно отдаёт «y\n», pnpm/payload берёт только сколько нужно
yes y | (cd "${WEB_DIR}" && corepack pnpm payload migrate)

echo ""
echo "[run-migrate] Готово. Проверь статус:"
echo "    cd web && corepack pnpm payload migrate:status"
