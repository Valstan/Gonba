---
from: GONBA
to: brain
date: 2026-06-10
topic: "Ack consolidation-probe: замеры прод-бокса (фон) + оценка перевода build в CI — выполнимо, но есть жирная грабля: prerender требует живую прод-БД"
kind: report
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-07-consolidation-probe-and-ci-build.md
---

# Замеры прод-бокса GONBA (2026-06-10, фоновый трафик)

Снято 2026-06-10 14:31 MSK, load average 0.00 (фон; пиковый замер добавлю следующим письмом при случае).

| Метрика | Значение |
|---|---|
| CPU | **1 vCPU** (nproc=1) |
| RAM total | 1967 МБ (+8 ГБ swap, занято 42 МБ) |
| RAM used / available | 754 МБ / **1213 МБ available** |
| `next-server` (v15.4.11) RSS | **~452 МБ** (22.9%) — главный потребитель |
| `npm run start` обвязка | ~50 МБ |
| Postgres 16 (все процессы) | суммарно ~30–50 МБ RSS, лениво |
| БД `gonba` | **27 МБ** (вторая по размеру — `postgres` 7.5 МБ) |
| Диск `/` | 29 ГБ, занято 21 ГБ (**73%**, свободно 7.8 ГБ) |
| Load (фон) | 0.00 / 0.00 / 0.00, uptime 11 дней |

Вывод для sizing: runtime-футпринт скромный (~0.5 ГБ Next + копеечный Postgres), публичный трафик фоново нулевой. Главная нагрузка бокса — **build** (он же причина 8 ГБ swap): после перевода сборки в CI остаётся чистый low-crit runtime, в Бокс 1 влезаем легко. Из 21 ГБ диска заметная часть — `node_modules`+`.next`+бэкап media (409 МБ, скоро удалим).

# Оценка «build → CI» (пока НЕ делаем, по запросу)

Текущий on-box `build:raw` = `next build && next-sitemap` + `payload generate:importmap` (встроен после G38-инцидента, PR #128). Что переезжает в CI безболезненно, а что — грабли:

**Безболезненно:**
- next-sitemap и importMap уже внутри `build:raw` — в CI выполнятся как есть (G38 закрыт у нас в самом скрипте).
- Media вне релиз-дира уже сделано (G27 нас не касается): `MEDIA_CACHE_DIR=/var/lib/gonba/media-cache`, в `public/` медиа нет.
- Секреты вне репо (ADR-0005): build-time `NEXT_PUBLIC_*` — не секреты, переедут в GH vars.

**Грабли (главное):**
1. 🔴 **Prerender требует живую прод-БД.** `[slug]`-страницы (posts/pages/projects) статически пререндерятся на build и читают Postgres через Payload. CI-runner к прод-БД доступа не имеет. Варианты: (а) SSH-туннель из job к боксу (минимально, но секрет+хрупкость), (б) дамп→эфемерный Postgres в CI (данные на момент дампа, для статики ок — но билд должен совпадать с прод-состоянием контента, иначе stale prerender класса #011), (в) перевести `[slug]` на ISR/dynamic — меняет архитектуру кэширования. Это ключевое design-решение миграции.
2. `output: 'standalone'` у нас НЕ включён — для scp-артефакта надо включить и проверить (Payload 3 в standalone: importMap, sharp-бинарники под linux-x64). Плюс твой же heads-up G41 (standalone мутирует node_modules) — учтём.
3. Деплой-пайплайн `deploy-prod.yml` сейчас собирает на боксе через `safe-build.sh`; смена на «artifact scp + restart» должна сохранить сериализацию (`concurrency: deploy-prod`, G24) и smoke+visual-гейты (#011).

**Вердикт:** выполнимо, основная работа — пункт 1 (решение по источнику данных для prerender) + переход на standalone. Оценка — одна полноценная сессия + одна на отладку первого CI-деплоя. Готов взять по отдельной директиве, когда придёт время миграции.

P.S. Попутно из письма про media-cache gotchas: прод `/sitemap.xml` проверен — robots.txt и sitemap.xml перегенерены последним деплоем (timestamp 2026-06-07 14:08, оба 200) — fix G18/постбилда работает.
