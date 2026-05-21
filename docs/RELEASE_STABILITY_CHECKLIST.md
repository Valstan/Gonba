# Release Stability Checklist

> ⚠️ **Этот документ — высокоуровневый ориентир.** Конкретный flow деплоя ушёл в slash-команды и GitHub Actions:
>
> - **Обычный релиз** — slash `/reliz` ведёт через commit → push → PR → merge → safe-build → restart → проверки.
> - **Auto-deploy** — после merge в `main` срабатывает `.github/workflows/deploy-prod.yml` (через `workflow_run` после успешного `CI`).
> - **БД-миграции** — применяются вручную ДО merge через `/sql` или `psql -f` (см. `docs/adr/0002-push-true-dev-migrations-prod.md`).
>
> Этот файл оставлен как «бумажная» референс-карта для случаев, когда нужно вспомнить ручные шаги без slash-команд.

---

## Pre-release (локально)

1. `bash scripts/dev-doctor.sh` — все 12 проверок должны быть зелёными
2. `corepack pnpm --dir web typecheck` — без ошибок
3. (Опционально, дольше) `corepack pnpm --dir web run lint`
4. (Опционально, ~3-5 мин) `corepack pnpm --dir web run test:int`
5. (Опционально, ~5-10 мин) `corepack pnpm --dir web run test:e2e`

Полное прохождение всех гейтов даёт CI workflow на push в любую ветку (`.github/workflows/ci.yml`) — поэтому ручной прогон опционален для не-конфликтных правок.

## Deploy

**Через slash `/reliz`** (рекомендуется):
- Один диалог = один шаг
- Учитывает БД-миграции (safety net)
- Знает про `safe-build.sh` и `systemd-run`

**Полностью автоматически** (если нет миграций):
- После squash-merge PR в `main`:
  1. `CI` workflow прогоняет lint+typecheck+test:int+build+E2E smoke
  2. На зелёном CI триггерится `Deploy to production` workflow_run
  3. SSH на прод → git pull → `scripts/safe-build.sh` → `wait-build.sh` → restart → smoke
- На failure workflow выгружает `journalctl -u gonba` и `gonba-build` в job output. Никакого автоматического отката — фикс делается вручную (см. ниже).

**Если нужны БД-миграции** (есть новые файлы `web/src/migrations/*.ts`):
- Применить вручную ДО merge через `/sql` или:
  ```bash
  ssh GONBA "cat /home/valstan/GONBA/web/src/migrations/<file>.sql | sudo -u postgres psql -d gonba -v ON_ERROR_STOP=1"
  ssh GONBA "sudo -u postgres psql -d gonba -c \"INSERT INTO payload_migrations (name, batch) VALUES ('<name>', N)\""
  ```
- Safety net в `deploy-prod.yml` фейлит ДО билда, если в коммите есть новые миграции — это защита от deploy без применённой схемы.

## Post-deploy (первые 15 минут)

1. Логи: `ssh GONBA "journalctl -u gonba -n 50 --no-pager"`
2. Health endpoint: `curl -fsS https://гоньба.рф/api/health` (HTTP 200)
3. Smoke critical pages:
   - `/`
   - `/projects`
   - `/posts`
   - `/admin` (HTTP 200 — login page)

## Rollback / восстановление

Принцип: **не откатываемся автоматически, чиним ситуацию.** Это сознательное решение (см. `docs/DEVELOPMENT_LOG.md` 2026-05-21, раунд 4).

При проблемах:

- **502 от nginx** — `ssh GONBA "sudo systemctl status gonba --no-pager -l"`. Если crash-loop с ENOENT на `.next/...json` — `.next` неполный, прогнать `scripts/safe-build.sh` ещё раз.
- **5xx в логах приложения** — `journalctl -u gonba -n 200`. Если виноват свежий коммит, либо точечный фикс + новый PR, либо откат через `git revert` + auto-redeploy.
- **БД-проблемы** — посмотреть `payload_migrations` (`sudo -u postgres psql -d gonba`), при необходимости применить недостающую миграцию.

## Ссылки

- `docs/PROJECT.md` → раздел «CI / автоматический деплой» — инструкции по setup secret SSH_PRIVATE_KEY
- `scripts/safe-build.sh` — обёртка билда через `systemd-run`
- `scripts/wait-build.sh` — poll-loop ожидания завершения build'а
- `docs/adr/0003-build-via-systemd-run-on-prod.md` — почему именно systemd-run
