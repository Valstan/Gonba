# Build → CI (standalone-артефакт) — Бокс 1, mandate brain 2026-06-11

**Статус:** in progress (2026-06-11)
**Директива:** `brain_matrica/mailboxes/GONBA/from-brain/2026-06-11-box1-host-build-to-ci-mandate.md` (mandate, high)
**Дедлайн:** до заезда KARMAN на наш бокс.

## Design-решение: prerender ↔ прод-БД = SSH-туннель из CI

`[slug]`-страницы (posts/pages/projects/…) статически пререндерятся на build и читают Postgres через Payload. Варианты и выбор:

| Вариант | Вердикт |
|---|---|
| **(а) SSH-туннель из CI к прод-Postgres** | ✅ **выбран.** Prerender из живых данных — ровно та же семантика, что у сегодняшнего on-box build. Ноль stale-окна (класс #011 — наша главная рецидивная боль). SSH-ключ уже есть в secrets; нужен только `DATABASE_URL` через туннель. Build только читает (`push:true` гейтится NODE_ENV — G20). Зависимость от доступности бокса не нова: деплой и так идёт на бокс. |
| (б) Дамп → эфемерный PG в раннере | ❌ stale-окно между дампом и build (#011), плюс логистика дампа на каждый деплой. |
| (в) Sabantuy-образец: пустая эфемерная БД + ISR self-heal | ❌ не для нас: у Sabantuy страницы ISR'ятся, у GONBA `[slug]` — полная статика без `revalidate` (урок 2026-06-06: пустой/устаревший prerender НЕ самовылечивается). |

## Изменения

1. **`web/next.config.js`** — `output: 'standalone'` строго за флагом `STANDALONE_BUILD=1` (G41: standalone мутирует node_modules — локальные сборки флаг не ставят) + `outputFileTracingRoot` = web/ (server.js в корень артефакта; образец Sabantuy).
2. **`.github/workflows/deploy-prod.yml`** — сборка переезжает в job:
   - триггеры/concurrency/migration-guard — без изменений (G24-сериализация сохранена);
   - setup node 22 + corepack pnpm 10, `pnpm install --frozen-lockfile`;
   - build-env из secret `GONBA_BUILD_ENV` (содержимое dotenv: `DATABASE_URL` через туннель `127.0.0.1:15432`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL` — последний **запекается в бандл**);
   - SSH-туннель `ssh -f -N -L 15432:127.0.0.1:5432 GONBA` на время build;
   - `STANDALONE_BUILD=1 pnpm run build:raw` (importmap + next build + next-sitemap — как сегодня);
   - сборка артефакта: `.next/standalone` + `.next/static` + `public` → tgz;
   - деплой: scp → `releases/<sha>` → симлинк `releases/current` → `systemctl restart gonba` → ротация (последние 3 релиза);
   - smoke-гейты прежние: local health, CDN, контент-маркер `homeOrbit__itemWrap` (#011).
   - бокс-репо остаётся источником для таймеров (vk-sync, media-cache) и миграций: шаг `git pull` сохранён + `pnpm install --frozen-lockfile` на боксе только при изменении lockfile (маленький спайк, не build).
3. **`deploy/systemd/gonba.service`** — `WorkingDirectory=/home/valstan/GONBA/releases/current`, `ExecStart=node server.js`, `HOSTNAME=127.0.0.1`/`PORT=3000` (standalone-сервер читает их из env). Установка на бокс — разовый ручной шаг при первом cutover (с подтверждением владельца).
4. **`scripts/safe-build.sh`** — остаётся как hot-fix-fallback (ADR-0002 §8), но с предупреждением в шапке: runtime теперь сервится из `releases/current`, on-box build её не обновляет.

## Secrets/vars (разовая настройка)

- `GONBA_BUILD_ENV` (secret) — dotenv для build: DATABASE_URL (туннель), PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL, PAYLOAD_PUBLIC_SERVER_URL. Источник значений — `/etc/gonba/gonba.env` (значения в чат/коммит не попадают).
- `SSH_PRIVATE_KEY` — уже есть.

## Порядок ввода (де-риск)

1. PR с кодом (workflow + config + unit-файл + доки). CI зелёный → merge. Авто-деплой от merge **уже пойдёт по новому workflow** — поэтому до merge: secret задан, `releases/` создан, юнит обновлён? Нет: юнит обновляем строго ПОСЛЕ того, как первый артефакт лёг в `releases/current` (иначе restart до артефакта = упавший сервис). Решение: remote-скрипт деплоя сам идемпотентно ставит юнит из репо (sudo cp + daemon-reload) ПЕРЕД restart — юнит и артефакт приезжают атомарно одним деплоем; до этого сервис продолжает жить на старом юните.
2. Первый CI-деплой — наблюдать; гидратация — визуальная проверка (#011).
3. После стабилизации: ужать 8 ГБ swap (build-RAM уехал), почистить диск, доложить brain.

## Откат

Старый юнит (`npm run start` в `web/`) + `scripts/safe-build.sh` остаются работоспособными: hot-fix откат = вернуть юнит из бэкапа, safe-build, restart.
