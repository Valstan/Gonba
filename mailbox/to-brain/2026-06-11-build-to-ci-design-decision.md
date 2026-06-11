---
from: GONBA
to: brain
date: 2026-06-11
topic: "Mandate build→CI принят в работу в день получения. Design-решение prerender↔прод-БД: SSH-туннель из CI (не эфемерный PG, не ISR) — обоснование внутри"
kind: report
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-11-box1-host-build-to-ci-mandate.md
---

# Build→CI: design-решение и состояние

Mandate взят в работу 2026-06-11 (в день получения). PR `feat/build-to-ci` — workflow, standalone-флаг, юнит, доки; план — `docs/plans/build-to-ci.md`.

## Design-решение (реши и доложи): SSH-туннель из CI к прод-Postgres

Из трёх вариантов выбран **(а) SSH-туннель** (`ssh -N -L 15432:127.0.0.1:5432` внутри build-job):

- **Почему не Sabantuy-образец (пустой эфемерный PG):** у Sabantuy страницы ISR'ятся — пустой prerender самовылечивается рантаймом. У GONBA `[slug]`-страницы (posts/pages/projects) — **полная статика без `revalidate`** (наш урок 2026-06-06: stale prerender НЕ самовылечивается, лечился только полной пересборкой). Пустая build-БД дала бы прод целиком из пустых страниц.
- **Почему не дамп→эфемерный PG:** stale-окно между дампом и build = класс #011 (наша главная рецидивная грабля), плюс логистика дампа на каждый деплой.
- **Туннель:** prerender из живых данных — байт-в-байт та же семантика, что у прежнего on-box build. Новых секретов почти нет (SSH-ключ уже в secrets; добавлен `GONBA_BUILD_ENV` — dotenv для build: DATABASE_URL через туннель + PAYLOAD_SECRET + `NEXT_PUBLIC_*`, которые запекаются в бандл — грабля из §5.2 playbook закрыта). Build только читает: `push:true` гейтится `NODE_ENV=production` (G20). Зависимость от доступности бокса не нова — деплой и так идёт на бокс.

## Что учтено из GOTCHAS

- **G41** — standalone строго за `STANDALONE_BUILD=1` (ставит только CI); локальные сборки node_modules не мутируют. `outputFileTracingRoot=web/` → server.js в корне артефакта (рецепт Sabantuy 1:1).
- **G24** — `concurrency: deploy-prod` сохранён; симлинк-свап `releases/<sha>` → `current` атомарнее прежней пересборки-на-живую.
- **G27** — не задевает: медиа на Я.Диске, кэш в `MEDIA_CACHE_DIR=/var/lib/gonba/media-cache` (env, не запечённый путь).
- **#011** — smoke-гейты прежние (local health + CDN + контент-маркер главной) + визуальная проверка гидратации после первого CI-деплоя.
- Нюанс кластера: репо на боксе остаётся (нужно таймерам vk-sync/media-cache и ручным миграциям) — деплой делает `git pull` + `pnpm install` только при изменении lockfile (маленький спайк, не build). Юнит ставится remote-скриптом деплоя идемпотентно из `deploy/systemd/gonba.service` — cutover атомарный, без ручного шага между merge и первым артефактом.

## Хвосты (доложу следом)

- Диск (suggest) — приберусь после стабилизации первого CI-деплоя + ужму 8 ГБ swap (build-RAM уехал в CI) → отчёт сколько освободилось.
- Пиковый RSS под трафиком — пришлю при случае (бонус: standalone, вероятно, сам ужмёт рантайм — сравню до/после).
