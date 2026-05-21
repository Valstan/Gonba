# 0003. Build на проде через `systemd-run` вместо прямого SSH

- **Status:** Accepted
- **Date:** 2026-05-20
- **Deciders:** Valstan

## Context

Прод-build GONBA — это `next build` (через `corepack pnpm run build:raw`), который занимает 5–8 минут. В фазе prerender Next.js 15 «молчит» (нет stdout) до 5+ минут.

В нашей деплой-практике build'ы периодически умирали:

- Прямой `ssh GONBA "corepack pnpm run build:raw"` через одну SSH-сессию **умирает при SSH-disconnect** (Wi-Fi моргнул, vpn упал) — оставляя «полуготовый» `.next` без `prerender-manifest.json` → сервис в crash-loop с `ENOENT`.
- Watchdog-обёртка `pnpm run build` (`scripts/run-with-watchdog.mjs --idle-ms=180000`) считала молчание prerender'а за зависание и убивала процесс по idle-timeout.
- Запуск через `systemd-run` без `--uid=valstan` подхватывал глобальный pnpm 11 от root (несовместимый с engines проекта `^9 || ^10`).

## Decision

Прод-build запускается через **`systemd-run` как отдельный systemd-unit** под пользователем `valstan`. Логика инкапсулирована в `scripts/safe-build.sh`:

```bash
sudo systemd-run \
  --unit=gonba-build \
  --uid=valstan \
  --gid=valstan \
  --working-directory=/home/valstan/GONBA/web \
  -- /bin/bash -lc "corepack pnpm run build:raw"
```

Скрипт `safe-build.sh` не ждёт завершения — возвращается сразу. Дожидаться build'а — отдельный скрипт `scripts/wait-build.sh` (poll-loop по `systemctl is-active gonba-build`).

`pnpm run build` с watchdog оставлен для случаев когда правильнее всего ловить зависания (например на dev), но idle поднят с 180s до 600s (`web/package.json`).

## Alternatives considered

- **tmux/screen-сессия** — переживает disconnect, но требует ручного `tmux attach` для контроля, нет journalctl-логов, нет integration с systemctl.
- **`nohup`** — переживает disconnect, но не предоставляет structured logging и status checking.
- **Docker `docker build`** — слишком тяжело для нашего стека (полноценный билд с pnpm работает быстрее в нативной среде); потребовало бы пересборки CI и dev окружения.
- **Перенести build в CI** — рассматривали и в итоге сделали (см. `.github/workflows/deploy-prod.yml`), но `systemd-run` на проде остаётся базой: CI просто SSH-ит и дёргает тот же `safe-build.sh`. Это даёт fallback на ручной деплой через `/reliz`.
- **Увеличить watchdog idle до 10 минут** — частично сделано (idle 600s), но не решает SSH-disconnect.
- **Vercel/Netlify** — vendor lock-in, проблемы с российской аудиторией (платежи), потеря root-доступа к серверу.

## Consequences

### Положительные

- **Переживает SSH-disconnect** — build идёт как фоновый systemd-unit независимо от TTY.
- **Лог через `journalctl -u gonba-build`** — стандартный systemd-flow, не нужны дополнительные tools.
- **`systemctl is-active`** даёт надёжный сигнал статуса для скриптов.
- **`reset-failed`** перед стартом гарантирует чистое состояние unit'а.

### Отрицательные

- **Требует `sudo NOPASSWD`** для пользователя `valstan` на проде — рисков мало (доверенный пользователь), но это не «zero-trust».
- **Debug build-errors** требует `journalctl` вместо чтения stdout — небольшое усложнение.
- **Чуть сложнее onboarding** — новый разработчик должен знать про `safe-build.sh` и `wait-build.sh`.
- **`gonba-build.service` после успешного завершения остаётся в `inactive`** (или `failed` при ошибке) — нужно вручную `systemctl reset-failed` перед следующим build'ом (это делает `safe-build.sh`).

### Нейтральные

- На проде Next.js 15 кэширует `.next/cache/` между билдами — `safe-build.sh` чистит `.next` целиком, но `.next/cache/` восстанавливается; первый билд после миграции может быть длиннее.

## References

- `scripts/safe-build.sh` — обёртка для запуска
- `scripts/wait-build.sh` — poll-loop ожидания завершения
- `.github/workflows/deploy-prod.yml` — CI деплой, использует `safe-build.sh`
- `web/package.json` — `build` (watchdog) и `build:raw` (прямой)
- DEVELOPMENT_LOG 2026-05-20, раздел «Прод-инфраструктура — уроки сессии»
