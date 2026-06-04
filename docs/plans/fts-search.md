# План: полнотекстовый поиск по сайту (Postgres FTS)

**Статус:** Phase 1 ✅ (на проде, `621c20a`) + Phase 2 ✅ «Coverage + подсветка» (2026-06-04, PR feat/fts-search-phase2). Phase 3 (pg_trgm/GIN) отложена. Идея из `brain` (`from-brain/2026-06-04-feature-ideas-fts-events-calendar.md`, одобрена владельцем, `suggest`).

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

## Phase 2 — охват и подсветка ✅ (2026-06-04, PR feat/fts-search-phase2)

Сделано (объём «Coverage + подсветка», одобрен владельцем):

- **Расширены индексируемые коллекции:** `searchPlugin({ collections: ['posts','pages','projects'] })`. Полиморфная связь `doc` теперь требует FK-колонки `search_rels.pages_id`/`projects_id` (зеркало `posts_id`) → миграция `20260604_120000` (+`.sql`), идемпотентна, по образцу проверенного footer-паттерна (DO-block guard на `pg_constraint`). На проде `push:true` после build не доезжает → явная миграция.
- **Reindex-скрипт** `web/scripts/reindex-search.ts` (`pnpm run search:reindex [-- --collections … --dry]`): пересохраняет published-документы (title→title, контент не меняется) → afterChange-хук плагина пересинкивает их в `search`. Ревалидация страниц глушится `context.disableRevalidate` (хуки уважают), синк поиска отрабатывает. Нужен т.к. плагин синкает только при save. **Прод-шаг ПОСЛЕ деплоя+миграции.**
- **beforeSync** робастен к коллекциям без SEO-группы `meta` (Projects): заголовок/описание/превью деривируются из собственных полей (`title`, `excerpt`/`summary`, `heroImage`). `meta.image` заполняется всегда (SEO-картинка → heroImage) — страница поиска берёт превью единообразно, поэтому **убран posts-only heroImage-запрос** в `page.tsx` (и устранён риск slug-коллизии между коллекциями).
- **Рендер-пайплайн:** результаты несут свою `relationTo` (из полиморфного `doc`) → `Card` строит правильный href (pages → `/slug`, posts → `/posts/slug`, projects → `/projects/slug`). `CollectionArchive` берёт per-doc `relationTo` с fallback `'posts'` (не ломает остальные 7 вызовов-архивов постов).
- **Подсветка совпадений** (`ts_headline`): SQL отдаёт сниппет с маркерами `⟦…⟧`; `Card` рендерит их как `<mark>` через React-сплит (экранированно, **без XSS** — markers, не raw HTML). Локальная проба на реальной БД: морфология + ранжирование + подсветка корректны (`олень`→оленей/олени/оленью, `мастер класс`→Мастер‑классы), мусор→0 без ошибок.

### Verify (локально, 2026-06-04)
- Script-проба FTS+ts_headline на живой БД (4 запроса) — морфология/ранжирование/подсветка ✅.
- `search:reindex --collections pages,projects` + проба покрытия: `search_rels` получил pages/projects, `doc.relationTo` резолвится верно (projects «Бронирование ЭКО-отеля», pages «Главная»/«Контакты»). ✅
- `pnpm typecheck` + `pnpm lint` — чисто.

## Phase 3 — опечатки и perf (отложено, требует прод-DB-операций)

- **Опечаткоустойчивость (pg_trgm):** `CREATE EXTENSION pg_trgm` (суперюзер на проде, под OK владельца) + fallback-ветка `similarity(title, q) > 0.3`/`word_similarity` когда FTS дал 0 результатов. Индекс `gin (… gin_trgm_ops)`.
- **GIN-индекс под FTS_EXPR** (perf) — миграция `CREATE INDEX … USING gin (FTS_EXPR)`; выражение IMMUTABLE, должно 1:1 совпадать с запросом. При ~184 строках — преждевременная оптимизация, поэтому отложено.

## Файлы

- `web/src/app/(frontend)/search/page.tsx` — FTS-запрос (Phase 1) + ts_headline/relationTo (Phase 2).
- `web/src/plugins/index.ts` — collections posts+pages+projects (Phase 2).
- `web/src/search/beforeSync.ts` — робастная деривация meta для Projects (Phase 2).
- `web/src/components/Card/index.tsx`, `CollectionArchive/index.tsx` — per-doc relationTo + подсветка (Phase 2).
- `web/src/migrations/20260604_120000.ts`(+`.sql`), `web/src/migrations/index.ts` — search_rels FK-колонки (Phase 2).
- `web/scripts/reindex-search.ts` + `package.json` script `search:reindex` (Phase 2).
