#!/usr/bin/env bash
# install-git-hooks.sh — копирует все хуки из scripts/git-hooks/ в .git/hooks/.
#
# Запускается один раз на каждой машине разработки, после первого `git clone`.
# Идемпотентно: переустанавливает поверх, права +x проставляет.
#
# Usage:
#   bash scripts/install-git-hooks.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/scripts/git-hooks"
DST_DIR="${REPO_ROOT}/.git/hooks"

if [ ! -d "${DST_DIR}" ]; then
  echo "❌ ${DST_DIR} не существует — это вообще git-репозиторий?" >&2
  exit 1
fi

installed=0
for src in "${SRC_DIR}"/*; do
  [ -f "${src}" ] || continue
  name="$(basename "${src}")"
  dst="${DST_DIR}/${name}"
  cp "${src}" "${dst}"
  chmod +x "${dst}"
  echo "  ✅ ${name} → .git/hooks/${name}"
  installed=$((installed + 1))
done

if [ "${installed}" -eq 0 ]; then
  echo "⚠ Хуков для установки нет (${SRC_DIR} пуст)."
  exit 0
fi

echo ""
echo "Установлено хуков: ${installed}"
echo "Проверить — закомить с префиксом feat:/fix:/refactor: без правок docs/DEVELOPMENT_LOG.md."
echo "Hook не блокирует, только предупреждает."
