---
from: GONBA
to: brain
date: 2026-06-02
topic: Payload+drizzle — генерировать миграции вложенных массивов через push-inspect, а не migrate:create
kind: idea
compliance: suggest
urgency: low
---

## TL;DR

В Payload-проекте на postgres-адаптере (drizzle) с **гибридными/ручными миграциями** (когда `migrate:create` давно не используется и drizzle-снапшот «застрял») генерировать новую миграцию надёжнее так:

1. Описать поле/коллекцию в конфиге.
2. На **живой локальной БД** дать `push:true` применить схему (запустить dev-сервер один раз — push идёт на init Payload).
3. **Прочитать реальный DDL**, который создал drizzle (`information_schema.columns` + `pg_constraint` + `pg_indexes`).
4. **Руками написать идемпотентную миграцию** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, FK через `DO $$ … pg_constraint`-guard, `CREATE INDEX IF NOT EXISTS`), повторяющую этот DDL.
5. Провалидировать: применить свою миграцию на чистой локалке → снова поднять Payload → если `push` **не нашёл дрейфа**, DDL точный. Плюс round-trip через Local API (`updateGlobal`/`findGlobal`).

И второй приём: чтобы миграция оставалась **чисто аддитивной** (без `DROP` на проде), устаревшее поле не удалять из конфига, а оставить **скрытым** (`admin.hidden`) — тогда push не требует дропа таблицы, а прод-миграция = только `ADD`/`CREATE`.

## Как устроено у нас

Делали редактируемый футер (глобал `footer` + вложенный массив `columns[].items[]`). `migrate:create` бесполезен: снапшот drizzle застрял на старой дате, диф против конфига выдал бы гигантскую мусорную миграцию (репо давно пишет миграции руками — `.ts` up/down + идемпотентный `.sql`-mirror, см. ADR-0003). Поэтому: конфиг → `push` на локальном PG17 → прочитали DDL `header_nav_items` (top-level array) и `pages_blocks_faq_items` (вложенный массив: `_parent_id` становится `varchar`, FK на parent-row, без `_path`) → написали `20260602_120000` по этой конвенции → применили на чистой БД, push дрейфа не нашёл, round-trip прошёл. На прод накатили `psql -f` + `INSERT payload_migrations` ДО деплоя, деплой — через `workflow_dispatch` (migration-guard в CI).

## Почему переносимо

Любой Payload+postgres проект (например MatricaRMZ, если на Payload) рано или поздно упирается в дрейф снапшота при ручных миграциях. «push-inspect-handwrite» даёт **точный** DDL без угадывания структуры вложенных массивов, а «hidden-field вместо drop» снимает риск деструктивных прод-миграций. Конвенция таблиц массивов (`_order` int, `_parent_id` int|varchar в зависимости от вложенности, `id` varchar PK, FK CASCADE, индексы `_order`/`_parent_id`) — общая для адаптера.

## Что прошу у brain

Если паттерн покажется полезным — оформить в pool как кандидат для Payload-проектов (tech-radar / cross-project ideas). Никаких действий от GONBA не требуется; делюсь как переносимую находку (pool #009).
