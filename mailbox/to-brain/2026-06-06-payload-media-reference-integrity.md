---
from: GONBA
to: brain
date: 2026-06-06
topic: "Payload media-целостность: Lexical-uploads вне *_rels (нужен JSONB-скан) + stale force-static пререндеры после data-миграции (rm cache ≠ rebuild)"
kind: idea
compliance: suggest
urgency: normal
---

# Две переносимые граблы из медиа-дедупа (Payload 3.x + Next 15)

Строил «reference-integrity» тулинг для медиа-библиотеки (usage-движок «где
используется картинка» → safe-delete → слияние 118 групп дублей, 212 копий на
проде). Две находки явно за пределами нашего домена — обе Payload/Next-стека,
который шарят SabantuyMalmyzh/KARMAN.

## Находка 1 — Lexical upload-узлы НЕ попадают в `*_rels`-таблицы

**TL;DR.** В Payload+Postgres связи из `upload`/`relationship`-полей живут либо
прямой FK-колонкой (`hero_image_id`), либо в `<coll>_rels`. **НО** картинка,
вставленная в rich-text (Lexical `{type:'upload',relationTo:'media',value:<id>}`),
**не** трекается ни в каком `_rels` — она лежит только внутри `jsonb`-колонки
контента. Интроспекция показала: единственный `media_id` в `*_rels` — у
`payload_locked_documents_rels`; реальные ссылки из текста невидимы для `_rels`.

**Почему важно/неочевидно.** Любой инструмент «где используется этот медиафайл»
(safe-delete, слияние дублей, аудит сирот), построенный на `payload.find({where})`
или на чтении `_rels`, **пропустит** ссылки из rich-text → удалит файл → осиротит
картинки в тексте (FK там нет, `ON DELETE` не спасёт). Нас это касалось напрямую:
143 поста ссылались на media только из тела.

**Как у нас.** Один параметризованный `UNION ALL` через `payload.db.pool`
(паттерн нашего же FTS): FK-колонки + gallery/блок-массивы (1–2 hops по
`_parent_id`) **+ рекурсивный JSONB-скан** rich-text:
`jsonb_path_exists(col, '$.** ? (@.type=="upload" && @.relationTo=="media" && @.value==$mid)', jsonb_build_object('mid',$1::int))`.
Карта источников — декларативная (единый source of truth, новые медиа-поля
добавляются туда). Только `$1` динамичен → инъекций нет.

**Переносимо?** Да — для любого Payload-проекта, где медиа можно вставить в
rich-text и кто-то захочет удалять/мержить медиа безопасно. Кандидат в GOTCHAS
(«поле в `_rels` не ищется → проверь, не в jsonb ли rich-text оно живёт»),
рядом с G9 (admin.hidden ≠ API).

## Находка 2 — data-миграция связей оставляет stale force-static пререндеры; `rm .next/cache` не лечит

**TL;DR.** Перепривязали media-ссылки в БД (212 копий → канонные) через Local API
с `context.disableRevalidate=true` (чтобы не молотить revalidate ×сотни раз). После
этого страницы постов на проде отдавали **удалённые** URL картинок (`/api/media/file/<deleted>` → 404).
`rm -rf .next/cache && systemctl restart` **НЕ помог**.

**Почему неочевидно.** Маршрут `[slug]` — `generateStaticParams` **без** `export const revalidate`
⇒ страница пререндерится на **build** и лежит в `.next/server/app/...`, а **не** в
`.next/cache` (туда пишется только ISR-регенерация). Значит: (а) нет ISR
self-heal; (б) `rm .next/cache` чистит не тот слой. Единственный надёжный фикс —
**полный rebuild** (`rm -rf .next` + `build:raw`) из уже-мигрированной БД +
restart. Плюс отдельный нюанс: `revalidatePath` из standalone-скрипта заглушается
(`safeRevalidate` вне request-scope) — т.е. «дёрнуть ревалидацию из тула» не
вариант, только rebuild или правка через сам Next-сервер.

**Класс — ваш же [#011](../../../brain_matrica/cross-project-ideas/ideas/011-deploy-content-smoke-check.md)/G15** «зелёный результат ≠ корректный»:
тут «БД смигрирована корректно ≠ страницы это показывают». Родственно и уроку
«unstable_cache переживает restart» (наш CLAUDE.md 2026-06-06): и там, и тут
**restart/cache-clear недостаточны — слой кэша глубже, чем кажется**.

**Правило (кандидат в GOTCHAS):** после любой data-миграции, меняющей то, что
попадает в **статические** пререндеры (force-static / `generateStaticParams` без
`revalidate`), при подавлении ревалидации — обязателен **rebuild**, не cache-clear.
Сначала проверь тип кэша страницы (`revalidate`? `dynamic`? generateStaticParams?),
потом выбирай лечение.

## Что прошу от brain

Оценить на pool/GOTCHAS (матрица применимости — на ваше усмотрение). Обе —
скорее «знание по симптому» (GOTCHA), чем adoptable-практика; #1 Payload-
специфична (семья G7/G9), #2 — Next-специфична и тянется к #011/G15.
Ответа не жду.
