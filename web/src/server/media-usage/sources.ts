/**
 * Declarative map of EVERY place a Media document can be referenced.
 *
 * This is the single source of truth for "where is this image used" — it backs
 * the usage engine (`findMediaUsage`), which in turn backs safe-delete (Phase C)
 * and duplicate-merge (Phase D). See `docs/plans/media-library-integrity.md`.
 *
 * ⚠️  Completeness is load-bearing: if a media-referencing field is missing here,
 *     safe-delete can silently orphan content. When you add a new upload field,
 *     gallery array, rich-text field, or block that can hold media — ADD IT HERE.
 *
 * Schema verified by introspection against a prod-derived DB on 2026-06-06.
 * Two ways a media id is referenced in Postgres:
 *   - `fk`       — a foreign-key column (`*_id`) from an `upload` field.
 *   - `richtext` — a Lexical upload node `{type:'upload',relationTo:'media',value:<id>}`
 *                  embedded in a `jsonb` rich-text column. These are NOT tracked in
 *                  Payload's `*_rels` tables, so they must be scanned in the JSON.
 *
 * `hops` = how many `_parent_id` steps from the matching table up to the owning doc:
 *   0 — the matching table row IS the doc (main-table column / global single row).
 *   1 — array/block directly on the doc (`table._parent_id` = doc id).
 *   2 — array/rich-text nested inside a block (`table._parent_id` → `via.id` → doc).
 */

export type CollectionMeta = {
  /** payload collection slug, or global key when `isGlobal` */
  key: string
  /** human, singular */
  label: string
  isGlobal?: boolean
  /** builds the public site URL from the doc slug (omit when none) */
  frontend?: (slug: string) => string
  /** title field to read when resolving doc labels (default 'title') */
  titleField?: string
}

export const COLLECTION_META: Record<string, CollectionMeta> = {
  posts: { key: 'posts', label: 'Запись', frontend: (s) => `/posts/${s}` },
  pages: { key: 'pages', label: 'Страница', frontend: (s) => `/${s}` },
  projects: { key: 'projects', label: 'Проект', frontend: (s) => `/projects/${s}` },
  events: { key: 'events', label: 'Событие', frontend: (s) => `/events/${s}` },
  services: { key: 'services', label: 'Услуга', frontend: (s) => `/services/${s}` },
  products: { key: 'products', label: 'Товар', frontend: (s) => `/shop/${s}` },
  // Ключ записи = slug коллекции Payload (для title-хидрейта/findByID), НЕ имя таблицы.
  vkImportQueue: { key: 'vkImportQueue', label: 'Очередь VK' },
  media: { key: 'media', label: 'Подпись медиафайла', titleField: 'alt' },
  // Глобал: slug 'homeCarousel' (таблица home_carousel). key → adminUrl /admin/globals/homeCarousel.
  home_carousel: { key: 'homeCarousel', label: 'Карусель (глобал)', isGlobal: true },
}

export type MediaSource = {
  /** key into COLLECTION_META */
  collection: string
  /** human label for WHERE in the doc this reference lives */
  field: string
  /** how the media id is matched */
  match: 'fk' | 'richtext'
  /** table holding the matching column */
  table: string
  /** the column: a `*_id` FK (match 'fk') or a jsonb rich-text column (match 'richtext') */
  col: string
  /**
   * `_parent_id` hops from `table` up to the owning row:
   *   - обычный источник — до самого документа (main-таблица).
   *   - версионный источник (`versionTable` задан) — до строки `_<coll>_v`
   *     (а уже её `parent_id` указывает на документ; см. `versionTable`).
   */
  hops: 0 | 1 | 2
  /** intermediate table (required iff hops === 2) */
  via?: string
  /**
   * Версионный (`_<coll>_v`) источник: draft-only ссылка, которой нет в main-
   * таблице, пока черновик не опубликован (Phase C.2 хвост «а»). Когда задан —
   * `doc_id` берётся из `<versionTable>.parent_id`, и считается только ПОСЛЕДНЯЯ
   * версия (`latest IS TRUE`) — текущее состояние черновика. Исторические версии
   * намеренно не блокируют удаление (их FK деградирует SET NULL, см. план Phase D).
   * Для `hops:0` table === versionTable (сама `_<coll>_v`).
   */
  versionTable?: string
}

export const MEDIA_SOURCES: MediaSource[] = [
  // ── Direct upload columns on main tables (hops 0) ───────────────────────────
  { collection: 'posts', field: 'Обложка', match: 'fk', table: 'posts', col: 'hero_image_id', hops: 0 },
  { collection: 'posts', field: 'SEO-картинка', match: 'fk', table: 'posts', col: 'meta_image_id', hops: 0 },
  { collection: 'pages', field: 'Hero', match: 'fk', table: 'pages', col: 'hero_media_id', hops: 0 },
  { collection: 'pages', field: 'SEO-картинка', match: 'fk', table: 'pages', col: 'meta_image_id', hops: 0 },
  { collection: 'projects', field: 'Обложка', match: 'fk', table: 'projects', col: 'hero_image_id', hops: 0 },
  { collection: 'projects', field: 'Логотип', match: 'fk', table: 'projects', col: 'logo_id', hops: 0 },
  { collection: 'events', field: 'Обложка', match: 'fk', table: 'events', col: 'hero_image_id', hops: 0 },
  { collection: 'services', field: 'Обложка', match: 'fk', table: 'services', col: 'hero_image_id', hops: 0 },
  { collection: 'vkImportQueue', field: 'Обложка', match: 'fk', table: 'vk_import_queue', col: 'hero_image_id', hops: 0 },
  { collection: 'home_carousel', field: 'Центр карусели', match: 'fk', table: 'home_carousel', col: 'center_image_id', hops: 0 },

  // ── Gallery / image arrays directly on a doc (hops 1) ───────────────────────
  { collection: 'projects', field: 'Галерея', match: 'fk', table: 'projects_gallery', col: 'image_id', hops: 1 },
  { collection: 'events', field: 'Галерея', match: 'fk', table: 'events_gallery', col: 'image_id', hops: 1 },
  { collection: 'products', field: 'Изображения', match: 'fk', table: 'products_images', col: 'image_id', hops: 1 },
  { collection: 'home_carousel', field: 'Элемент карусели', match: 'fk', table: 'home_carousel_items', col: 'image_id', hops: 1 },

  // ── Image arrays nested inside Pages blocks (hops 2) ────────────────────────
  { collection: 'pages', field: 'Блок «Галерея»', match: 'fk', table: 'pages_blocks_gallery_items', col: 'image_id', hops: 2, via: 'pages_blocks_gallery' },
  { collection: 'pages', field: 'Блок «Медиа»', match: 'fk', table: 'pages_blocks_media_block_items', col: 'media_id', hops: 2, via: 'pages_blocks_media_block' },
  { collection: 'pages', field: 'Блок «Отзывы»', match: 'fk', table: 'pages_blocks_testimonials_items', col: 'photo_id', hops: 2, via: 'pages_blocks_testimonials' },

  // ── Rich-text on main tables (hops 0) ───────────────────────────────────────
  { collection: 'posts', field: 'В тексте', match: 'richtext', table: 'posts', col: 'content', hops: 0 },
  { collection: 'pages', field: 'Hero (текст)', match: 'richtext', table: 'pages', col: 'hero_rich_text', hops: 0 },
  { collection: 'projects', field: 'Описание', match: 'richtext', table: 'projects', col: 'description', hops: 0 },
  { collection: 'events', field: 'В тексте', match: 'richtext', table: 'events', col: 'content', hops: 0 },
  { collection: 'services', field: 'Описание', match: 'richtext', table: 'services', col: 'description', hops: 0 },
  { collection: 'products', field: 'Описание', match: 'richtext', table: 'products', col: 'description', hops: 0 },
  { collection: 'media', field: 'Подпись', match: 'richtext', table: 'media', col: 'caption', hops: 0 },

  // ── Rich-text inside Pages blocks ───────────────────────────────────────────
  { collection: 'pages', field: 'Блок CTA (текст)', match: 'richtext', table: 'pages_blocks_cta', col: 'rich_text', hops: 1 },
  { collection: 'pages', field: 'Блок «Архив» (текст)', match: 'richtext', table: 'pages_blocks_archive', col: 'intro_content', hops: 1 },
  { collection: 'pages', field: 'Блок «Форма» (текст)', match: 'richtext', table: 'pages_blocks_form_block', col: 'intro_content', hops: 1 },
  { collection: 'pages', field: 'Блок колонок (текст)', match: 'richtext', table: 'pages_blocks_content_columns', col: 'rich_text', hops: 2, via: 'pages_blocks_content' },
]

/**
 * Версионные источники — те же поля, но в `_<coll>_v`-таблицах (Phase C.2 хвост «а»).
 * Покрывают **draft-only** ссылки: пока черновик не опубликован, media живёт только
 * в latest-версии, а в main-таблице её нет → без этого usage-движок вернул бы 0 и
 * safe-delete мог бы осиротить черновик. Считаем только `latest IS TRUE`.
 *
 * Версионируемые коллекции (drafts): posts, pages, projects, events, services
 * (products/vkImportQueue/глобалы — без версий). Имена таблиц/колонок выверены
 * интроспекцией prod-производной БД (machine B) 2026-06-13.
 *
 * `hops` здесь — шаги от `table` до строки `_<coll>_v` (а её `parent_id` → документ):
 *   0 — table === versionTable (`_<coll>_v`).
 *   1 — `table._parent_id` → `versionTable.id` (массив/блок на доке).
 *   2 — `table._parent_id` → `via.id` → `versionTable.id` (массив внутри блока).
 */
export const MEDIA_VERSION_SOURCES: MediaSource[] = [
  // posts → _posts_v
  { collection: 'posts', field: 'Обложка (черновик)', match: 'fk', table: '_posts_v', col: 'version_hero_image_id', hops: 0, versionTable: '_posts_v' },
  { collection: 'posts', field: 'SEO-картинка (черновик)', match: 'fk', table: '_posts_v', col: 'version_meta_image_id', hops: 0, versionTable: '_posts_v' },
  { collection: 'posts', field: 'В тексте (черновик)', match: 'richtext', table: '_posts_v', col: 'version_content', hops: 0, versionTable: '_posts_v' },

  // pages → _pages_v (+ вложенные блоки)
  { collection: 'pages', field: 'Hero (черновик)', match: 'fk', table: '_pages_v', col: 'version_hero_media_id', hops: 0, versionTable: '_pages_v' },
  { collection: 'pages', field: 'SEO-картинка (черновик)', match: 'fk', table: '_pages_v', col: 'version_meta_image_id', hops: 0, versionTable: '_pages_v' },
  { collection: 'pages', field: 'Hero (текст, черновик)', match: 'richtext', table: '_pages_v', col: 'version_hero_rich_text', hops: 0, versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок «Галерея» (черновик)', match: 'fk', table: '_pages_v_blocks_gallery_items', col: 'image_id', hops: 2, via: '_pages_v_blocks_gallery', versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок «Медиа» (черновик)', match: 'fk', table: '_pages_v_blocks_media_block_items', col: 'media_id', hops: 2, via: '_pages_v_blocks_media_block', versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок «Отзывы» (черновик)', match: 'fk', table: '_pages_v_blocks_testimonials_items', col: 'photo_id', hops: 2, via: '_pages_v_blocks_testimonials', versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок CTA (текст, черновик)', match: 'richtext', table: '_pages_v_blocks_cta', col: 'rich_text', hops: 1, versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок «Архив» (текст, черновик)', match: 'richtext', table: '_pages_v_blocks_archive', col: 'intro_content', hops: 1, versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок «Форма» (текст, черновик)', match: 'richtext', table: '_pages_v_blocks_form_block', col: 'intro_content', hops: 1, versionTable: '_pages_v' },
  { collection: 'pages', field: 'Блок колонок (текст, черновик)', match: 'richtext', table: '_pages_v_blocks_content_columns', col: 'rich_text', hops: 2, via: '_pages_v_blocks_content', versionTable: '_pages_v' },

  // projects → _projects_v (+ галерея)
  { collection: 'projects', field: 'Обложка (черновик)', match: 'fk', table: '_projects_v', col: 'version_hero_image_id', hops: 0, versionTable: '_projects_v' },
  { collection: 'projects', field: 'Логотип (черновик)', match: 'fk', table: '_projects_v', col: 'version_logo_id', hops: 0, versionTable: '_projects_v' },
  { collection: 'projects', field: 'Описание (черновик)', match: 'richtext', table: '_projects_v', col: 'version_description', hops: 0, versionTable: '_projects_v' },
  { collection: 'projects', field: 'Галерея (черновик)', match: 'fk', table: '_projects_v_version_gallery', col: 'image_id', hops: 1, versionTable: '_projects_v' },

  // events → _events_v (+ галерея)
  { collection: 'events', field: 'Обложка (черновик)', match: 'fk', table: '_events_v', col: 'version_hero_image_id', hops: 0, versionTable: '_events_v' },
  { collection: 'events', field: 'В тексте (черновик)', match: 'richtext', table: '_events_v', col: 'version_content', hops: 0, versionTable: '_events_v' },
  { collection: 'events', field: 'Галерея (черновик)', match: 'fk', table: '_events_v_version_gallery', col: 'image_id', hops: 1, versionTable: '_events_v' },

  // services → _services_v
  { collection: 'services', field: 'Обложка (черновик)', match: 'fk', table: '_services_v', col: 'version_hero_image_id', hops: 0, versionTable: '_services_v' },
  { collection: 'services', field: 'Описание (черновик)', match: 'richtext', table: '_services_v', col: 'version_description', hops: 0, versionTable: '_services_v' },
]

/** Полный набор: main-таблицы + версионные (`_v`) черновики. Движок строит UNION ALL по нему. */
export const ALL_MEDIA_SOURCES: MediaSource[] = [...MEDIA_SOURCES, ...MEDIA_VERSION_SOURCES]
