#!/usr/bin/env bash
# dev-doctor.sh — проверка локального окружения для GONBA.
# Запускается из любой директории, работает в git-bash и WSL.
#
# Usage:
#   bash scripts/dev-doctor.sh
#   ./scripts/dev-doctor.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${REPO_ROOT}/web"

ok() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; exit_code=1; }
warn() { echo "  ⚠️  $1"; }

exit_code=0

echo "=== GONBA dev environment check ==="
echo "  Repo: ${REPO_ROOT}"
echo ""

# --- Node / corepack / pnpm ---
echo "[Tools]"
if command -v node >/dev/null 2>&1; then
  ok "node $(node -v)"
else
  fail "node не найден"
fi

if command -v corepack >/dev/null 2>&1; then
  ok "corepack $(corepack --version 2>&1 | head -1)"
else
  fail "corepack не найден (нужен для pnpm 10)"
fi

if command -v corepack >/dev/null 2>&1; then
  pnpm_version=$(corepack pnpm --version 2>&1 | tail -1 || echo "??")
  if [[ "${pnpm_version}" =~ ^10\. ]]; then
    ok "pnpm ${pnpm_version} (через corepack)"
  elif [[ "${pnpm_version}" =~ ^11\. ]]; then
    fail "pnpm ${pnpm_version} несовместим с engines проекта (нужен ^9 || ^10). См. memory windows_pnpm_setup."
  else
    warn "pnpm ${pnpm_version} — неожиданная версия"
  fi
fi

# script-shell на Windows
if [[ "${OS:-}" == "Windows_NT" ]] || [[ "$(uname -s 2>/dev/null)" =~ MINGW|MSYS ]]; then
  ss=$(corepack pnpm config get script-shell 2>&1 | tail -1)
  if [[ "${ss}" == *"bash.exe"* ]]; then
    ok "pnpm script-shell = ${ss}"
  else
    fail "pnpm script-shell = '${ss}' — на Windows нужен git-bash (Program Files/Git/bin/bash.exe). См. memory windows_pnpm_setup."
  fi
fi
echo ""

# --- Project files ---
echo "[Project files]"
if [ -f "${WEB_DIR}/.env" ]; then
  ok "web/.env существует"
else
  fail "web/.env отсутствует — скопируй из web/.env.example и заполни DATABASE_URL, PAYLOAD_SECRET"
fi

if [ -d "${WEB_DIR}/node_modules" ]; then
  ok "web/node_modules установлены"
else
  fail "web/node_modules пусто — запусти 'cd web && corepack pnpm install'"
fi

if [ -f "${WEB_DIR}/src/payload-types.ts" ]; then
  ok "web/src/payload-types.ts сгенерирован"
else
  warn "web/src/payload-types.ts отсутствует — запусти 'cd web && corepack pnpm run generate:types'"
fi

if [ -f "${WEB_DIR}/src/app/(payload)/admin/importMap.js" ]; then
  ok "admin/importMap.js сгенерирован"
else
  warn "admin/importMap.js отсутствует — 'cd web && corepack pnpm run generate:importmap'"
fi
echo ""

# --- Postgres ---
echo "[Database]"
PG_CMD="psql"
if [ -d "/c/Program Files/PostgreSQL/16/bin" ]; then
  PG_CMD="/c/Program Files/PostgreSQL/16/bin/psql"
fi

if command -v "${PG_CMD}" >/dev/null 2>&1 || [ -x "${PG_CMD}" ]; then
  ok "psql найден"
  if PGPASSWORD='postgres' "${PG_CMD}" -U postgres -h 127.0.0.1 -d postgres -w -c "SELECT 1;" >/dev/null 2>&1; then
    ok "Postgres 127.0.0.1:5432 принимает (postgres/postgres)"
    if PGPASSWORD='postgres' "${PG_CMD}" -U postgres -h 127.0.0.1 -d gonba -w -tAc "SELECT 1;" >/dev/null 2>&1; then
      ok "БД 'gonba' существует и доступна"
    else
      fail "БД 'gonba' недоступна — создай через 'createdb -U postgres gonba'"
    fi
  else
    fail "Postgres не отвечает или пароль не 'postgres' (проверь сервис postgresql-x64-16)"
  fi
else
  warn "psql не найден в PATH — Postgres может быть установлен, но CLI недоступен"
fi
echo ""

# --- SSH ---
echo "[SSH к проду]"
if [ -f "${HOME}/.ssh/id_ed25519" ]; then
  ok "ed25519 ключ есть"
else
  if [ -f "${HOME}/.ssh/id_rsa" ]; then
    warn "id_rsa есть, но docs/PROJECT.md рекомендует id_ed25519"
  else
    fail "SSH-ключ отсутствует (~/.ssh/id_ed25519 или id_rsa)"
  fi
fi

if grep -q "^Host GONBA" "${HOME}/.ssh/config" 2>/dev/null; then
  ok "SSH alias 'GONBA' настроен"
else
  warn "SSH alias 'GONBA' не настроен — добавь в ~/.ssh/config (см. docs/PROJECT.md)"
fi
echo ""

# --- Git hooks ---
echo "[Git hooks]"
HOOK_SRC="${REPO_ROOT}/scripts/git-hooks"
if [ ! -d "${REPO_ROOT}/.git/hooks" ]; then
  warn "Это не git-репозиторий?"
elif [ ! -d "${HOOK_SRC}" ] || [ -z "$(ls -A "${HOOK_SRC}" 2>/dev/null)" ]; then
  ok "проектных git-хуков нет (норма — DEVELOPMENT_LOG-хук упразднён, ADR-0007)"
else
  missing=0
  for src in "${HOOK_SRC}"/*; do
    name="$(basename "${src}")"
    [ -x "${REPO_ROOT}/.git/hooks/${name}" ] || missing=$((missing + 1))
  done
  if [ "${missing}" -eq 0 ]; then
    ok "проектные git-хуки установлены"
  else
    warn "${missing} проектных хук(ов) не установлено — запусти 'bash scripts/install-git-hooks.sh'"
  fi
fi
echo ""

if [ $exit_code -eq 0 ]; then
  echo "✅ Окружение готово к разработке."
else
  echo "❌ Есть проблемы — см. ❌ выше."
fi

exit $exit_code
