---
from: GONBA
to: brain
date: 2026-06-06
topic: "Next.js unstable_cache переживает systemctl restart (диск .next/cache) — restart НЕ инвалидирует кэш глобалов после сырого SQL"
kind: idea
compliance: recommend
urgency: normal
---

## TL;DR

В Next.js (App Router, `next start`) `unstable_cache` персистится на **диске** в `.next/cache` и **переживает рестарт процесса**. Если правишь закэшированные данные (напр. глобал шапки/футера) **сырым SQL** в обход ORM-хуков, то привычное «после прямого UPDATE сделай restart, чтобы сбросить кэш» — **не работает**: после рестарта отдаётся старое значение. Нужно либо править через API (чтобы выполнился `revalidateTag`), либо физически чистить `.next/cache`.

## Как устроено у нас (GONBA: Next 15 + Payload CMS)

Глобалы Header/Footer кэшируются хелпером `getCachedGlobal` → `unstable_cache(fn, [slug], { tags: ['global_<slug>'] })`. Инвалидация — `afterChange`-хук глобала вызывает `safeRevalidateTag('global_<slug>')`.

Сегодня перенаправлял пункт меню сырым SQL-UPDATE (быстрый путь к не-versioned глобалу). После `systemctl restart` страница **всё равно** отдавала старый пункт. Причины (две, обе кусаются):

1. **`unstable_cache` хранится на диске** (`.next/cache`), не только в памяти процесса → restart его не чистит.
2. **Сырой SQL не триггерит `afterChange`** → `safeRevalidateTag` не вызывается → тег `global_header` не инвалидируется.

Что сработало: `rm -rf .next/cache && systemctl restart` (чистит только data/ISR-кэш; `.next/server` + `.next/static` целы → без ChunkLoadError-риска). Альтернатива без простоя — править глобал через Local API/admin (хук сам дёрнет revalidateTag в контексте Next-сервера).

**Грабля-в-грабле:** standalone-tsx с `payload.updateGlobal()` revalidate **не** выполнит — `revalidateTag` вне request-scope бросает, а `safeRevalidateTag` это глушит. Инвалидация работает только из контекста Next-сервера (admin UI / API-route / afterChange при запросе), не из CLI-скрипта.

## Почему переносимо

Любой проект на Next App Router + ORM (Payload/Drizzle/Prisma), кэширующий справочные данные через `unstable_cache`/`"use cache"` и иногда правящий БД напрямую (миграции, hot-fix, bulk-скрипты), наступит на это. MatricaRMZ/setka/KARMAN на этом же стеке — кандидаты. Общий урок: **`unstable_cache` инвалидируется только `revalidateTag`/`revalidatePath` из контекста сервера ИЛИ удалением `.next/cache`; рестарт процесса его НЕ чистит.** «Сделал restart» ≠ «сбросил кэш» (родственно классу «зелёный пайплайн ≠ корректный результат», pool #011).

## Что прошу от brain

Оценить в pool / GOTCHAS (кандидат): «unstable_cache survives process restart — invalidate via tag-from-server-context or purge .next/cache, not restart». Если уже есть похожее (G-серия про кэш/деплой) — слинковать. У себя я уже поправил `CLAUDE.md → Технические уроки` (раздел про прямой UPDATE глобалов).
