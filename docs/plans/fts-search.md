# План: полнотекстовый поиск по сайту (Postgres FTS)

**Статус:** Phase 1 в работе (2026-06-04). Идея из `brain` (`from-brain/2026-06-04-feature-ideas-fts-events-calendar.md`, одобрена владельцем, `suggest`).

## Контекст

Поиск уже есть: `@payloadcms/plugin-search` синкает коллекцию `posts` в служебную коллекцию `search`, страница `/search` (`web/src/app/(frontend)/search/page.tsx`) фильтрует её через `payload.find` с оператором `like` (= `ILIKE '%q%'`).

Проблемы наивного `like`:
- нет морфологии (рус. стемминга): «мероприятия» ≠ «мероприятие»;
- нет ранжирования по релевантности;
- мультислово матчится как буквальная подстрока (порядок слов важен);
- нет фраз/исключений.

## Факты по БД (введены 2026-06-04, локальный Postgres :5433, 152 строки в `search`)

- Таблица `search`, колонки: `id, title, priority, slug, meta_title, meta_description, meta_image_id, updated_at, created_at`. Полиморфный `doc` — в `search_rels` (для отображения не нужен: хидрейтим по `id`).
- TS-конфиг `russian` присутствует (встроенный snowball) — стемминг работает из коробки, **расширения не нужны**.
- `pg_trgm` **не установлен** → опечаткоустойчивость (trigram-fuzzy) требует `CREATE EXTENSION pg_trgm` (привилегия суперюзера) — вынесено в Phase 2.
- Прототип FTS на реальных данных: `websearch_to_tsquery('russian', 'ГОНЬБА')` → 5 ранжированных совпадений, стемминг/регистр свернулись корректно.

## Phase 1 — качество матчинга (без миграции, без прод-DB-операций) ✅ scope

Только прикладной слой — переписать запрос в `page.tsx`:

1. Если есть `q`: сырой SQL по таблице `search` →
   ```sql
   WHERE FTS_EXPR @@ websearch_to_tsquery('russian', $1)
   ORDER BY ts_rank(FTS_EXPR, websearch_to_tsquery('russian', $1)) DESC, priority DESC NULLS LAST, updated_at DESC
   LIMIT 12
   ```
   где `FTS_EXPR` — взвешенный вектор:
   ```
   setweight(to_tsvector('russian', coalesce(title,'')),        'A') ||
   setweight(to_tsvector('russian', coalesce(meta_title,'')),   'B') ||
   setweight(to_tsvector('russian', coalesce(meta_description,'')), 'C')
   ```
   Запрос через `payload.db.pool.query(text, [q])` (параметризовано — без SQL-инъекций). `websearch_to_tsquery` устойчив к мусору/спецсимволам (не бросает).
2. Полученные ранжированные `id` → хидрейтим через существующий `payload.find({collection:'search', where:{id:{in:ids}}, depth:1, select})` (сохраняет access-control + populate категорий/меты/картинки), затем пересортировка в порядке `ids`.
3. Пустой `q` → как раньше: свежие записи (без FTS-фильтра).
4. Downstream (heroImage по slug, `CollectionArchive`) — без изменений.

**Почему без индекса/миграции:** 152 строки → `to_tsvector` на лету = доли мс. GIN-индекс — чистая оптимизация; раздельная Phase 2 (плюс брезентовость expression-индекса под `push:true`). Корректность от индекса не зависит.

### Verify (локально)
- Скрипт-проба (FTS-SQL на реальной БД) — мультислово, морфология, пустой запрос.
- `pnpm typecheck` + `pnpm lint`.
- (опц.) dev-сервер `/search?q=...` — на Windows ловить «spawn UNKNOWN» (memory), достаточно скрипт-пробы.

## Phase 2 — охват и опечатки (follow-up, не в этом PR)

- **Расширить индексируемые коллекции:** `searchPlugin({ collections: ['posts','pages','projects'] })` + разовый реиндекс существующих Pages/Projects (плагин синкает только на save). Нужен reindex-скрипт/пересохранение. Прод-операция.
- **Опечаткоустойчивость (pg_trgm):** `CREATE EXTENSION pg_trgm` (суперюзер на проде, под OK владельца) + fallback-ветка `similarity(title, q) > 0.3` когда FTS дал 0 результатов, либо `word_similarity`. Индекс `gin (… gin_trgm_ops)`.
- **GIN-индекс под FTS_EXPR** (perf) — миграция `CREATE INDEX … USING gin (FTS_EXPR)`; выражение IMMUTABLE (2-арг `to_tsvector` + `setweight`/`||`), но должно 1:1 совпадать с запросом. На проде — через миграцию (не `push`).
- **Подсветка совпадений** (`ts_headline`) в выдаче — UX-плюс.

## Файлы

- `web/src/app/(frontend)/search/page.tsx` — переписан запрос (Phase 1).
- (Phase 2) `web/src/plugins/index.ts`, миграция в `web/src/migrations/`, reindex-скрипт.
