---
description: Релизный flow GONBA — гейты → PR → зелёный CI → merge → дождаться авто-деплоя → smoke.
argument-hint: [короткое описание релиза, опционально]
allowed-tools: Read, Edit, Write, Bash, Glob, Grep, AskUserQuestion, mcp__ccd_session__mark_chapter
---

# /reliz — довести правку до прода

**Цель — довести правку до прода.** Деплой запускается **сам** от мержа (`deploy-prod.yml`, триггер `workflow_run` после зелёного CI). Ручной build на боксе в релизе не участвует.

На happy-path **не должно быть ни одного `AskUserQuestion`** — кроме гейта #025 (необратимые операции с прод-данными). Подтверждение даёт не человек, а зелёные гейты (`AGENTS.md` → «Автономия под гейтами»).

## 1. Что меняем

- `git status --short --branch`
- `git diff --stat HEAD`
- `git log --oneline main..HEAD` — если уже на feature-ветке

Дерево пустое — коммитить нечего, выйти.

## 2. Гейты — обязательны, без вопроса

```bash
npm -C web run typecheck
npm -C web run lint
```

Оба зелёные — идём дальше. Красный — **чиним, не мержим**: гейт и есть то, что заменило человеческое «окей».

На Windows npm берёт `cmd.exe` и падает на `NODE_OPTIONS`; звать с `--script-shell="C:\Program Files\Git\bin\bash.exe"`.

## 3. `PENDING_FOLLOWUPS.md` — до коммита

Не пропускать. Закрываемое отметить `✅ Сделано` (с PR/коммитом), вылезшее по пути — дописать с меткой старения.

**Changelog релиза = тело PR** (Summary + Test plan). Отдельного журнала нет — хронология живёт в `git log` и телах PR ([ADR-0007](../../docs/adr/0007-archive-development-log.md)). Поэтому тело PR пишется содержательно: что меняли, почему, чем проверяли.

Handoff (`docs/SESSION_HANDOFF.md`) едет **тем же PR**, что и шаг работы — тогда отдельной синхронизации в конце сессии не требуется.

## 4. Миграции — ДО мержа

Новые поля коллекций требуют миграции **до** того, как код поедет на прод: свежий код селектит новые колонки, и prerender упадёт на `column … does not exist`.

Штатный путь — `bash scripts/run-migrate.sh` (обёртка гасит drizzle-prompt в headless) либо `/sql`. Гейт миграций в деплое сверяет файлы `web/src/migrations/*.ts` со строками `payload_migrations` на проде и **фейлит закрыто**.

Это операция с прод-данными → **`AskUserQuestion` в том же ходе** (#025). Единственное место в релизе, где спрашивают человека.

## 5. Ветка → коммит → PR

```bash
git checkout -b <prefix>/<slug>     # feat | fix | chore | docs | refactor | style
git add <конкретные пути>           # не `git add -A` вслепую
git commit -F <файл-с-сообщением>
```

**Текст коммита и тела PR пишется файлом, а не внутри командной строки** (D-046): heredoc и многострочные аргументы проходят до четырёх парсеров, путь — один ASCII-токен. Сообщение готовит инструмент записи файлов, команде отдаётся путь.

Трейлер: `Co-Authored-By: <агент и его фактическая версия> <noreply@anthropic.com>` — каждый агент подписывается собой.

```bash
git push -u origin <branch>
gh pr create --title "…" --body-file <файл>
```

## 6. Зелёный CI → merge

Дождаться `web-quality` (required check):

```bash
gh pr checks <N>
```

**Сверить, что зелёный чек относится к HEAD этого PR**, а не к предыдущему коммиту — прогон на устаревшем SHA выглядит идентично и однажды едва не стоил мержа не той версии:

```bash
gh pr view <N> --json headRefOid --jq '.headRefOid'
gh run list --branch <branch> --limit 3 --json headSha,conclusion,event
```

Локальные гейты зелёные **и** CI зелёный на нужном SHA → мержим без отдельного «окей»:

```bash
gh pr merge <N> --squash --delete-branch
git checkout main && git fetch origin && git pull --ff-only
```

**Мержи сериализуются так же, как деплои** (G24). Деплой стартует не от мержа, а от **завершения CI**, то есть между ними окно в минуты. Смерженный в это окно второй PR ломает деплой первого: тот подтягивает `main` на боксе, видит там чужой коммит и падает на сверке `EXPECTED_SHA`. Перед мержем следующего PR:

```bash
gh run list --workflow=deploy-prod.yml --limit 1 --json status,conclusion,headSha
```

должен показать `completed` на предыдущем SHA.

## 7. Дождаться ЗАВЕРШЕНИЯ деплоя

Не «запустился», а `completed` + `success`:

```bash
gh run list --workflow=deploy-prod.yml --limit 1 --json databaseId,status,conclusion,headSha
```

Ручной `gh workflow run deploy-prod` — в `deny`: параллельный деплой пересобирает `.next` во время отдачи, манифест чанков рассинхронится, и клиент ловит `ChunkLoadError` на всех страницах при формально корректном коде.

## 8. Приёмка

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 https://гоньба.рф/api/health
curl -s --max-time 25 https://гоньба.рф/ | grep -o '<title[^>]*>[^<]*'
```

Плюс смок изменённых страниц и сверка активного релиза:

```bash
ssh GONBA 'readlink -f ~/GONBA/releases/current; systemctl is-active gonba'
```

**После фронт-изменений — визуальная проверка гидратации в браузерном инструменте агента.** Смок-проверка деплоя читает SSR-HTML и `ChunkLoadError` на клиенте **не видит**: зелёный пайплайн ≠ корректный результат.

**Правки глобалов сырым SQL** (`header_nav_items`, `footer_*`) не сбрасывают `unstable_cache`, а он персистится на диске и переживает `restart`. Правильно — через Payload Local API; после сырого SQL — `rm -rf web/.next/cache` + restart.

## 9. Отчёт

URL смерженных PR, что задеплоено, статус проверок. Если были миграции — сверить, что гейт увидел их применёнными.

## Если упало

- **Деплой красный на сверке `EXPECTED_SHA`** → в окно между мержем и стартом деплоя смержили ещё один PR (§6). Прод не пострадал — падение до сборки; дождаться следующего деплоя.
- **`gonba.service` в crash-loop** → `ssh GONBA "journalctl -u gonba -n 50 --no-pager -o cat"`. `ENOENT` на `.next/…json` — артефакт не доехал.
- **502 снаружи** → nginx проксирует на локальный порт, а сервис лежит.
- **`column … does not exist`** → пропущена миграция (§4).

**Откат** — `git revert` + обычный PR-flow. `scripts/safe-build.sh` — **аварийный инструмент отката, не часть релиза**: он собирает в `web/.next`, которую runtime больше не сервит, и после него нужно возвращать старый юнит из бэкапа. В штатном релизе не запускается никогда.

Прод в сломанном виде не оставляем.
