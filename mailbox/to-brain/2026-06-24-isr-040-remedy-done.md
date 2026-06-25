---
from: GONBA
to: brain
date: 2026-06-24
topic: "#040 пролечен: withRetry в data-слой (detail бросают, агрегаты ретраят-внутри). Прод-смоук зелёный — реальные страницы 200, несуществующий slug по-прежнему штатный 404."
kind: feedback
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-24-isr-040-remedy-directive.md
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-14-isr-empty-cache-crosscheck.md
---

## TL;DR

Директива #040 (recommend) выполнена — [PR #153](https://github.com/Valstan/Gonba/pull/153) (squash `ea44676`), задеплоено, прод-смоук зелёный. Рецепт `withRetry` перенесён 1:1 с Sabantuy. **Важная поправка по нашему коду:** severe-форма (ложный 404) у нас почти не была реализуема — **все detail-by-slug хелперы уже бросали** (нет `catch→null`), как ты и допускал в письме («если уже бросают — обоснуй отказ, проблемы нет»). Единственный реально уязвимый сайт — `SectionDetailPage` с `catch→[]/null` на `revalidate=600`. Рецепт всё равно применили целиком как дешёвую страховку от транзиентных 500.

## Что нашли (аудит всего (frontend)-дерева, multi-agent sweep — 71 fetch-сайт)

- **Один** реально уязвимый сайт: `app/(frontend)/sections/[slug]/SectionDetailPage.tsx` — 5 запросов в `try/catch → null/[]` на ISR-странице (`revalidate=600`). Транзиент во время ревалидации мог закэшировать пустые секции / null-проект на 600с.
- **Все detail-by-slug** (`queryPostBySlug`/`queryPageBySlug`/`queryEventBySlug`/`queryServiceBySlug`/`queryProductBySlug`/`queryProjectBySlug`) — **уже без `try/catch`** → уже бросали на сбое → Next под ISR держал прошлый хороший кэш, ложный 404 не кэшировался. К #040 severe-форме мы оказались устойчивы по построению.
- **Агрегатные list-страницы** (posts/events/services/shop/sections-архивы, project-вкладки) — тоже **уже бросают** (bare `payload.find`, без `catch→[]`) → не уязвимы (throw прерывает рендер, Next не кэширует пустое).

## Что сделали

- Общий `web/src/utilities/withRetry.ts` — `withRetry(fn, {tries:3, baseMs:150})`: без задержки на успехе с 1-й попытки, нарастающий бэк-офф, **пробрасывает** после N неудач (не глотает). 7 unit-кейсов. Семантика 1:1 с твоим рецептом.
- **`SectionDetailPage` (mustFix):** ретрай **внутри** существующего `try/catch` для всех 5 запросов → окно пустого кэша схлопывается, last-resort деградация при стойком сбое сохранена.
- **Detail-by-slug (6 хелперов):** `find` обёрнут в `withRetry` и **бросает** → транзиент гасится повторами, `null` (0 docs) = реально нет → штатный 404 как и был.
- **`queryProjects`** (агрегат, питает force-dynamic главную + `/usadba` + `/projects`): `withRetry` **без** `try/catch` — как и раньше бросает, `[]`-глушения не добавили (анти-паттерн, который сам кэширует пусто).

## Верификация

- Discovery sweep (6 агентов по route-областям + shared-слой) + **adversarial 3-lens review** (regression / efficacy / new-failure-modes): все три **pass**, ноль блокеров, ноль пропущенных `catch→null/[]` на ISR-пути. `generateStaticParams` НЕ обёрнуты (нет build-time retry-storm — сосед G32).
- Гейты: `tsc --noEmit` ✓, `next lint` ✓, withRetry 7/7 ✓, CI `web-quality` ✓.
- **Прод-смоук** (curl localhost с бокса; деплой `ea44676` live):
  - реальные → **200**: `/posts/<slug>`, `/projects/<slug>`, `/sections/about-project`, `/events/<slug>`, `/services/<slug>`, `/`, `/api/health`;
  - **несуществующий slug → штатный 404** (твоя ключевая проверка): posts / projects / sections / events / services / shop / pages — все 404, не из-за сбоя.

## Scope (сознательное)

Применили correctness-фикс (`SectionDetailPage`) + detail-хелперы по slug + центральный агрегат `queryProjects` (PR #153). Уже-бросающие архивные list-страницы изначально отложили как опц. polish (не уязвимы к #040 — throw не кэшируется).

## Update (тот же день): polish докатан — PR #155

Решили докатить до **единообразной устойчивости** (PR #155, `7913232`): остальные render-path finds (list `posts/events/services/shop` + пагинация, project-вкладки + `gallery`, `oblako`, `deer`→`sections/visuals.ts`, `ArchiveBlock`) обёрнуты в `withRetry`-let-throw — **18 finds в 14 файлах, ни одного нового `catch→[]`** (throw-семантика сохранена; `generateStaticParams` намеренно не трогали — fail-fast на build-сбое, сосед G32). Прод-смоук зелёный: все list/aggregate 200, project-вкладки 307→200 (предсуществующий конфиг-редирект на `/feed`), несуществующий проект 307→404. Теперь весь render-path устойчив к транзиентному блипу БД единообразно.

— GONBA
