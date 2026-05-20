---
description: Релизный flow GONBA — commit → push → PR → merge → safe-build на проде → restart → проверки.
argument-hint: [короткое описание релиза, опционально]
allowed-tools: Read, Edit, Write, Bash, Glob, Grep, AskUserQuestion, mcp__ccd_session__mark_chapter
---

# /reliz — релиз правок на прод

Ведёт через все шаги один за другим. На каждом значимом шаге останавливается и проверяет с пользователем.

## Шаг 0. Pre-flight check

Параллельно:

- `git status --short --branch` — что меняется
- `git diff --stat HEAD` — насколько большой релиз
- `git log --oneline main..HEAD 2>/dev/null` — что в текущей ветке (если на feature)

Если рабочее дерево пустое — сказать пользователю, что коммитить нечего, и выйти.

## Шаг 1. Качественные ворота (опционально, по запросу пользователя)

Спроси: «Прогнать `tsc --noEmit` / `lint` / `test:int` перед коммитом?» — если да:

```bash
cd web && corepack pnpm exec tsc --noEmit
cd web && corepack pnpm run lint     # если такой скрипт есть
cd web && corepack pnpm run test:int # тяжёлый, дольше
```

Если что-то падает — стоп, показать пользователю, спросить как поступить.

## Шаг 2. Обновить `DEVELOPMENT_LOG.md` и `PENDING_FOLLOWUPS.md`

**Это критично** — не пропускать.

- Открой `docs/DEVELOPMENT_LOG.md`. Если за сегодняшнюю дату блока ещё нет — создай новый сверху. Если есть — допиши в него подзаголовок про текущий релиз.
- Открой `docs/PENDING_FOLLOWUPS.md`. Если что-то из закрываемой задачи висело в ⏳/🟡/🟢 — удали оттуда (или перенеси в `DEVELOPMENT_LOG.md` как «закрыто»). Если в процессе вылезли новые техдолги — допиши их.

Сделай это **перед** коммитом, чтобы они попали в тот же коммит.

## Шаг 3. Commit

Спроси у пользователя короткое сообщение коммита (или предложи своё на основе diff). Используй conventional-commit префикс:
- `feat:` — новая фича
- `fix:` — баг-фикс
- `style:` — стили (UI/scss/tailwind)
- `refactor:` — рефакторинг без смены поведения
- `docs:` — только документация
- `chore:` — обслуживание (deps, configs)

Шаги:

1. `git checkout -b feat/<short-name>` если ещё на `main`
2. `git add <конкретные пути>` (НЕ `git add -A` — слишком опасно)
3. `git commit -m "$(heredoc)"` с подробным телом + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

## Шаг 4. Push + PR

```bash
git push -u origin <branch>
gh pr create --title "..." --body "..."
```

PR-описание содержит: Summary, Test plan (чек-листом), что меняется в БД (если есть `ALTER TABLE`).

Покажи URL PR пользователю.

## Шаг 5. Решение о merge

Спроси: «Мерджим сразу (squash) или ждём ревью?»

- Если сразу: `gh pr merge <N> --squash --delete-branch`
- Если ревью: остановиться, попросить пользователя дать сигнал когда merge сделан, дальше деплой.

## Шаг 6. БД-миграции на проде (если нужны)

Если в релизе есть новые поля Payload-коллекций — нужен `ALTER TABLE` на прод-БД ПЕРЕД деплоем (потому что свежий код будет селектить новые колонки, а build для prerender'а упадёт с `column ... does not exist`).

Используй `/sql` или собери команду вручную. **Обязательно** через `AskUserQuestion` показать SQL пользователю и получить «да».

## Шаг 7. Deploy

```bash
# pull main на проде
ssh GONBA "cd /home/valstan/GONBA && git pull --ff-only origin main"

# почистить и запустить безопасный build (через systemd-run --uid=valstan)
ssh GONBA "/home/valstan/GONBA/scripts/safe-build.sh"
```

`scripts/safe-build.sh` сам:
- сбрасывает failed-state `gonba-build.service`
- `rm -rf web/.next`
- запускает `corepack pnpm run build:raw` через `systemd-run --unit=gonba-build --uid=valstan --gid=valstan`
- НЕ ждёт завершения

Затем — отдельный poll-loop в фоне (`run_in_background`) который ждёт `systemctl is-active gonba-build != active|activating`, проверяет наличие `.next/prerender-manifest.json` и `.next/BUILD_ID`, и сообщает результат одним уведомлением.

Build идёт ~6-8 минут. Не опрашивай вручную — жди нотификацию.

## Шаг 8. Restart + проверки

После BUILD_OK:

```bash
ssh GONBA "sudo systemctl restart gonba && sleep 6"
ssh GONBA "curl -s -o /dev/null -w '/api/health: %{http_code}\n' --max-time 15 http://127.0.0.1:3000/api/health"
# плюс смок-проверка изменённых страниц
```

Через CDN:
```bash
curl -s -o /dev/null -w '/: %{http_code}\n' --max-time 20 https://гоньба.рф/
curl -s -o /dev/null -w '/api/health: %{http_code}\n' --max-time 20 https://гоньба.рф/api/health
```

Если **что-то меняли в Header / Footer / других globals напрямую в БД** — `restart gonba` ещё раз, потому что `unstable_cache` залипает.

## Шаг 9. Финальный отчёт

- Список смерженных PR (URL'ы)
- Что задеплоено (краткий summary с BUILD_ID)
- Статус всех endpoint-проверок
- Если в PR были БД-миграции — напомни про техдолг «оформить как Payload migration в `web/src/migrations/`»

## Если что-то упало

- **Build failed** → прочитай `journalctl -u gonba-build --no-pager | tail -50`. Если `column does not exist` — забыли ALTER TABLE. Если `ENOENT prerender-manifest.json` — build не доехал, нужно перезапустить.
- **`gonba.service` в crash-loop** → `journalctl -u gonba -n 50`. Возможно `.next/` пустой / битый.
- **Public 502** → nginx проксирует на 127.0.0.1:3000, а `gonba.service` лежит. Restart.

Никогда не оставляй прод в сломанном виде. Если не можешь починить за 5 минут — откатывай (`git revert` + redeploy предыдущего BUILD_ID).
