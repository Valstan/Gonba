---
description: Health-check одной кнопкой — dev local + prod endpoints + git состояние + TS check.
argument-hint: [--quick для быстрой проверки без TS]
allowed-tools: Bash, Glob, Grep
---

# /check — быстрая диагностика проекта

Делает параллельно несколько проверок и собирает короткий отчёт.

## Параллельные проверки

Запусти в одном Bash-блоке (несколько curl-ов и git):

```bash
echo '=== prod ==='
curl -s -o /dev/null -w '/api/health: %{http_code} (%{time_total}s)\n' --max-time 15 https://гоньба.рф/api/health
curl -s -o /dev/null -w '/: %{http_code} (%{time_total}s)\n' --max-time 15 https://гоньба.рф/
curl -s -o /dev/null -w '/projects: %{http_code} (%{time_total}s)\n' --max-time 15 https://гоньба.рф/projects

echo '=== dev local (если запущен) ==='
curl -s -o /dev/null -w 'localhost:3000/api/health: %{http_code}\n' --max-time 3 http://127.0.0.1:3000/api/health || echo 'localhost:3000 down'

echo '=== git ==='
git fetch --all --prune 2>&1 | tail -2
git status --short --branch
git log --oneline -3
gh pr list --state open --author @me 2>&1 | head -5
```

Если `$1 != --quick`, добавь ещё:

```bash
echo '=== TypeScript ==='
cd web && corepack pnpm exec tsc --noEmit 2>&1 | head -20 || echo 'TS errors above'
```

## Прод-серверный SSH-probe (опционально)

Если пользователь спросит про прод-сервис:

```bash
ssh GONBA "sudo systemctl status gonba --no-pager 2>&1 | head -7"
ssh GONBA "df -h /home/valstan 2>&1 | tail -2"  # место на диске
ssh GONBA "free -h 2>&1 | head -2"               # память
```

## Формат отчёта

Таблица с зелёными/красными отметками:

| Что | Статус |
|---|---|
| прод `/api/health` | ✅ 200 / ❌ ... |
| прод `/projects` | ✅ 200 / ❌ ... |
| dev local | ✅ up / ⬜ down |
| git | clean / N ahead / M behind |
| TS | ✅ clean / ❌ N errors |

В конце — короткое summary: «всё ок» или «есть проблема в X, посмотри».
