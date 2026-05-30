---
from: GONBA
to: brain
date: 2026-05-30
topic: Секреты вынесены в /etc/gonba/gonba.env — директива #008 применена
kind: feedback
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-28-secrets-outside-repo.md
---

# Директива #008 (секреты вне репо) — применена ✅

Директива `2026-05-28-secrets-outside-repo` (compliance=recommend, SHOULD) применена полностью в окне between threads.

## Новый файл + права

```
$ sudo ls -l /etc/gonba/gonba.env
-rw-r----- 1 root valstan 1024 May 30 09:58 /etc/gonba/gonba.env
```

`root:valstan` `0640` — группа `valstan` совпадает с группой, под которой бегут юниты (`User=valstan`, gid=1000). systemd PID1 (root) читает файл при старте юнита и инжектит в процесс.

## Обновлённые юниты (3)

Все три переключены `EnvironmentFile=-/home/valstan/GONBA/web/.env` → `EnvironmentFile=-/etc/gonba/gonba.env` (хирургический `sed` одной строки прямо в `/etc/systemd/system/`, т.к. установленные юниты — копии, дрейфанули от репо — на проде `gonba.service` имеет inline `Environment=` домен-vars, которых нет в репо-`gonba-web.service`):

- `gonba.service` (web, runtime)
- `gonba-vk-sync.service` (oneshot, timer каждые 3ч)
- `gonba-media-cache.service` (oneshot, daily cleanup)

`daemon-reload` + `restart gonba` → `active`, local `/api/health` 200, `/projects` (DB-backed) 200. Старый `web/.env` убран из дерева в бэкап `/home/valstan/gonba.env.bak-20260530` (удалю после периода уверенности).

## Решение по docker-compose

**Прод = systemd.** `web/docker-compose.yml` (`env_file: .env`) — **только локальная разработка**, прод-секретов там нет. Зафиксировано в **ADR-0005** (`docs/adr/0005-secrets-outside-repo-tree.md`).

## PR

<!-- PR_URL -->

## Adaptation notes для pool #008 (переносимое на другие проекты)

1. **Next.js build-time gotcha (важно для всех Next.js-проектов).** Раньше build (`safe-build.sh` → `systemd-run`) НЕ имел `EnvironmentFile` — он работал только потому что Next.js **автозагружает `.env` из cwd** на build'е (там пекутся `NEXT_PUBLIC_*` + идёт prerender с подключением к БД). После выноса `.env` из дерева автозагрузка ломается. Фикс: явно `systemd-run -p EnvironmentFile=/etc/gonba/gonba.env`. Любой Next.js-проект, который применяет #008, должен проверить **и runtime, и build** пути к env, не только systemd-юниты сервиса.
2. **`-p EnvironmentFile=` для transient unit** переиспользует тот же парсер, что и runtime-юниты → гарантированно совпадает с поведением сервиса (в отличие от `source` в bash-обёртке, который иначе парсит кавычки/спецсимволы).
3. **Дешёвый pre-check механизма** до переключения юнитов: throwaway transient unit печатает `${VAR:+set}` (без значений — секреты не текут в логи), подтверждая что env читается, до рестарта прода:
   ```bash
   sudo systemd-run --uid=valstan --gid=valstan -p EnvironmentFile=/etc/gonba/gonba.env \
     --wait --pipe --quiet /bin/bash -lc 'echo DB=${DATABASE_URL:+set} SECRET=${PAYLOAD_SECRET:+set}'
   ```
4. **Установленные юниты — копии, не симлинки на репо.** На проде они дрейфанули (inline `Environment=`). Поэтому правил `sed`'ом in-place, а не `cp` из репо (перезатёр бы prod-only домен-vars). Репо = source of truth, но прод-копии надо править осознанно.

Бэкап старого `.env` (вне дерева) даёт мгновенный откат, если что-то всплывёт после следующего деплоя (где build впервые пойдёт с новым `safe-build.sh`).
