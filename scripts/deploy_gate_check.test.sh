#!/usr/bin/env bash
# deploy_gate_check.test.sh — негативные сценарии для deploy_gate_check.sh.
#
# Зачем в репо: у гейта важны именно отказы (`exit 1` — деплой в полёте,
# `exit 2` — проверить не удалось), а их нельзя проверить «на живом GitHub»:
# в момент проверки никакого деплоя в полёте может просто не быть. Стенд
# подставляет подменный `gh` первым в PATH — сам гейт не меняется и про стенд
# не знает. Первая версия гейта именно здесь и провалилась: «пустая история
# прогонов» читалась как зелёный результат, то есть опечатка в имени workflow
# давала успех из ничего.
#
# Живой прогон (сценарии 1-2) ходит в GitHub настоящим `gh` и требует сети.
#
# Usage:  bash scripts/deploy_gate_check.test.sh
# Коды:   0 — все сценарии совпали с ожиданием; 1 — есть расхождение.
#
# Примечание про Windows: «gh отсутствует» этим стендом не проверить — в Git Bash
# файл без бита +x всё равно исполняется (MSYS-эвристика по shebang), поэтому
# подменный gh подхватывается и в этом случае.

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$HERE/deploy_gate_check.sh"

if [ ! -f "$GATE" ]; then
  printf 'не нашёл %s\n' "$GATE" >&2
  exit 1
fi

STUBS=$(mktemp -d)
trap 'rm -rf "$STUBS"' EXIT

WLIST='  *"workflow list"*) echo '"'"'[{"path":".github/workflows/deploy-prod.yml"}]'"'"' ;;'

# $1 — имя каталога-заглушки, $2 — дополнительные ветки case
mk_stub() {
  mkdir -p "$STUBS/$1"
  {
    printf '#!/usr/bin/env bash\n'
    printf 'case "$*" in\n'
    printf '%s\n' "$WLIST"
    printf '%s\n' "$2"
    printf 'esac\nexit 0\n'
  } > "$STUBS/$1/gh"
  chmod +x "$STUBS/$1/gh"
}

mk_stub ok '  *"auth status"*) exit 0 ;;
  *"select(.status != \"completed\")"*) echo "" ;;
  *"map(select"*) echo "99999999998 success def5678" ;;'

mk_stub flight '  *"auth status"*) exit 0 ;;
  *"select(.status != \"completed\")"*) echo "  run 99999999999 — in_progress, abc1234, начат 2026-10-16T12:00:00Z" ;;
  *"map(select"*) echo "99999999998 success def5678" ;;'

mk_stub listfail '  *"auth status"*) exit 0 ;;
  *"select(.status != \"completed\")"*) exit 1 ;;'

mk_stub noauth '  *"auth status"*) exit 1 ;;'

mk_stub empty '  *"auth status"*) exit 0 ;;
  *"select(.status != \"completed\")"*) echo "" ;;
  *"map(select"*) echo "нет" ;;'

mk_stub lastfail '  *"auth status"*) exit 0 ;;
  *"select(.status != \"completed\")"*) echo "" ;;
  *"map(select"*) echo "99999999997 failure fedcba9" ;;'

# Отдельно: workflow виден, но в списке его нет — ветка должна идти ПЕРВОЙ,
# иначе её перекроет общая ветка из mk_stub.
mkdir -p "$STUBS/typo"
cat > "$STUBS/typo/gh" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *"auth status"*) exit 0 ;;
  *"workflow list"*) echo '[{"path":".github/workflows/ci.yml"}]' ;;
  *'select(.status != "completed")'*) echo "" ;;
  *"map(select"*) echo "99999999998 success def5678" ;;
esac
exit 0
SH
chmod +x "$STUBS/typo/gh"

passed=0
failed=0

check() {  # $1 — ожидаемый exit, $2 — каталог-заглушка или "-" (живой gh), $3 — аргумент
  expected="$1"
  if [ "$2" = "-" ]; then
    out=$(bash "$GATE" "$3" 2>&1); rc=$?
  else
    out=$(PATH="$STUBS/$2:$PATH" bash "$GATE" "$3" 2>&1); rc=$?
  fi
  if [ "$rc" = "$expected" ]; then
    printf '✅ %s (exit=%s)\n' "$4" "$rc"
    passed=$((passed + 1))
  else
    printf '❌ %s — exit=%s, ждали %s\n' "$4" "$rc" "$expected"
    printf '%s\n' "$out" | sed 's/^/     | /'
    failed=$((failed + 1))
  fi
}

check 0 -          --gate  "живой --gate: деплоев в полёте нет или есть — гейт отвечает связно"
check 1 flight     --gate  "деплой в полёте → отказ"
check 0 flight     --warn  "деплой в полёте в --warn → не блокирует"
check 0 ok         --gate  "деплоев нет, последний успешен → зелено"
check 0 lastfail   --gate  "последний деплой упал → зелено с предупреждением (fix forward)"
check 2 listfail   --gate  "gh run list падает → не проверить"
check 2 noauth     --gate  "gh не авторизован → не проверить"
check 2 typo       --gate  "workflow не виден → не проверить (опечатка не даёт зелёного)"
check 2 empty      --gate  "пустая история прогонов → не проверить (фейл закрыто)"
check 2 -          --bogus "неизвестный аргумент → usage и exit 2"

printf '\nитого: %s ок, %s провал(ов)\n' "$passed" "$failed"
[ "$failed" -eq 0 ] || exit 1
exit 0
