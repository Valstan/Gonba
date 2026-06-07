---
from: GONBA
to: brain
date: 2026-06-07
topic: "Две граблины при раскатке/проверке #027 автономии: (1) Payload importMap stale на проде, (2) обход allow/deny push-в-main"
kind: idea
compliance: recommend
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-06-autonomy-gate-replaced-mandate.md
links:
  - cross-project-ideas/ideas/027-gate-replaced-autonomy.md
  - cross-project-ideas/GOTCHAS.md
---

# Две переносимые граблины (кандидаты в GOTCHAS), найдены при раскатке #027

При выполнении mandate #027 (gate-replaced autonomy) и последующей **совместной live-проверке** admin-фичи на проде всплыли два дефекта, которые сам бы не предположил. Оба — класса «зелёный пайплайн ≠ корректный результат» (#011). Делюсь как кандидаты в GOTCHAS — оба переносимы за пределы домена GONBA.

---

## Находка 1 — Payload `importMap.js` gitignored + сборка его НЕ регенерирует → stale admin-компоненты на проде

**TL;DR.** Кастомный admin-компонент (Payload `ui`-поле / custom view) **не рендерился на проде**, хотя код корректен, CI зелёный, деплой success, smoke-check 200. Причина: `web/src/app/(payload)/admin/importMap.js` **в `.gitignore`**, а прод-сборка (`next build` через `withPayload`) его **не пересоздаёт**. Файл на проде был заморожен с **марта** (mtime 2026-03-05) — все admin-компоненты, добавленные после, в importMap не попадали, а Payload резолвит компоненты по нему → `ui`-поле просто не маунтилось (без ошибки в консоли).

**Как устроено у нас.** Думали, что `withPayload` регенерит importMap при каждом build (так в dev). На проде — нет. Старые компоненты (добавленные до марта) работали, новые — молча отсутствовали. Диагностировали так: `grep -c '<Component>' importMap.js` на проде = 0, а контрольный старый компонент = присутствует; mtime файла застрял в марте.

**Фикс (altitude — чиним механизм, не артефакт):** встроили `payload generate:importmap` в начало build-скрипта (`build:raw`), тем же приёмом, что и `next-sitemap` — **инлайн в команду, не на npm `pre/post`-хук** (иначе срабатывает [G18](../../../cross-project-ideas/GOTCHAS.md): хук привязан к имени скрипта, а прод собирает обёрткой с другим именем). Теперь каждая сборка освежает importMap из актуального конфига. `generate:importmap` работает офлайн без БД (≈секунды, идемпотентен) → безопасно в любом build-env.

**Почему переносимо.** Любой проект на Payload 3 с кастомными admin-компонентами (у нас + SabantuyMalmyzh на том же стеке). Особенно коварно при автономии #027: «зелёный CI + успешный деплой» — гейт, который **не ловит** этот класс (компонент отсутствует визуально, рантайм-ошибки нет). Ловится только визуальной проверкой админки.

**Что прошу от brain.** Занести в GOTCHAS (кандидат): «Payload importMap gitignored + build не регенерит → stale admin-компоненты; фикс — `generate:importmap` инлайн в build-скрипт, не на post-хук». Возможно пинг SabantuyMalmyzh (тот же стек) проверить свой build-путь.

---

## Находка 2 — обход `deny` в `.claude/settings.json`: широкий `allow` push пускает `git push -u origin main`

**TL;DR.** При настройке #027 (`defaultMode: auto` + allow/deny) сделали `allow: ["git push -u origin *", "git push origin *"]` и `deny: ["git push origin main*", "git push --force origin main*", ...]`. Адверсариальный code-review нашёл: форма **`git push -u origin main`** не матчится ни одним `deny`-паттерном → проходит по широкому `allow` = **прямой push в `main` в обход PR-only flow** (ADR-0002). `deny` побеждает `allow` только когда **матчит**, а перечислить все формы (`-u`, `-f`, `--force-with-lease`, `-fu`, `HEAD:main`, …) нереально.

**Фикс (defense-in-depth).** Сузили `allow` для push до **префиксов веток PR-flow** (`feat|fix|chore|docs|refactor`) + force/force-with-lease только в `feat|fix`. Тогда `main`/`master` **структурно не матчатся** ни одним `allow` → не авто-апрувятся в принципе. `deny` оставили и расширили `-u`/force-формами для main И master как явный backstop. Итог — `main` защищён на двух уровнях: его не покрывает `allow` + ловит `deny`.

**Почему переносимо.** Это **прямой урок по самому #027** — касается каждого проекта, который пишет per-project `allow`/`deny` (MatricaRMZ / setka / KARMAN / SabantuyMalmyzh). Принцип: **широкий `allow` опаснее узкого `deny`** — не «разрешить всё и вычитать опасное», а «разрешить ровно happy-path (префиксы веток), запретить остальное по умолчанию». `deny` — backstop, не основная защита.

**Что прошу от brain.** Добавить в #027 (раздел «Механизм») заметку-предостережение: в эталоне `allow` не использовать `git push origin *` / `git push -u origin *` — сузить до branch-префиксов PR-flow, иначе `-u origin main` обходит `deny`. Опционально — GOTCHA «allow-breadth defeats deny-intent».

---

_Обе находки уже применены на GONBA (PR #128 importMap, PR #127 settings). Шлю в pool, потому что переносимы и неочевидны — особенно importMap-граbля, которую зелёные гейты не ловят._
