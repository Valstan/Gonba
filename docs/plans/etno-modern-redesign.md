# План — этно-модерн редизайн главной страницы

**Цель.** Переключить главную страницу сайта на визуальный язык «направление B (Этно-модерн)» из [handoff-bundle Claude Design 2026-05-23](../design/handoff-2026-05-23/INDEX.md), сохранив архитектуру коллекций Payload и не потеряв ни одного из 10 проектов экосистемы Гоньбы.

**Источник правды по визуалу:** [`docs/design/handoff-2026-05-23/gonba-home.html`](../design/handoff-2026-05-23/gonba-home.html). При вопросах «как должен выглядеть блок X» — смотри туда, ищи нужную секцию по комментариям `═══ HEADER ═══` / `═══ HERO ═══` и т.д.

**Архитектурное решение и обоснование:** [ADR-0004](../adr/0004-frontpage-ethno-modern-redesign.md). Краткое: orbit-карусель → на `/orbit`, `/projects` остаётся каталогом, все 10 проектов остаются `Projects`-коллекцией с новым полем `group`.

---

## Этапы (4 PR)

### PR1 — Дизайн-токены + типографика + Header/Drawer/Footer + чистка слагов

**Что меняется на сайте:** появятся новые шрифты, шапка и подвал во всех маршрутах. Главная всё ещё старая (orbit-карусель), но в новой шапке/подвале.

**Что в коде:**

1. **`web/src/app/(frontend)/globals.css`** — расширяем CSS-vars значениями из [`proto-tokens.css`](../design/handoff-2026-05-23/proto-tokens.css). Готовый блок ниже **вставить внутрь существующего `:root { ... }` (примерно после `--brand-olive` в `globals.css:142`)**:

   ```css
   /* === Ethno-modern tokens (PR1) === */

   /* base palette — paper / forest / ochre / oxblood / ink */
   --paper: #ede3cf;
   --paper-deep: #e2d6b8;
   --paper-light: #f4ecd9;
   --ink: #1f2418;
   --forest: #2d4029;
   --forest-deep: #1e2c1c;
   --ochre: #a86a1d;
   --ochre-light: #c98a35;
   --oxblood: #6e2018;

   /* utility shades */
   --rule: #c9bd9d;          /* hairline rule on paper */
   --rule-light: #d9cfb0;    /* lighter hairline */
   --text-muted: #6b6450;    /* muted body text — NB: --muted уже занят shadcn-токеном (globals.css:154), поэтому используем --text-muted */

   /* typography (значения см. подключение шрифтов через next/font ниже) */
   --serif: var(--font-pt-serif), 'PT Serif', Georgia, serif;
   --sans: var(--font-manrope), 'Manrope', system-ui, sans-serif;
   --mono: var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace;

   /* layout */
   --pad-x: clamp(18px, 4vw, 64px);
   --pad-y: clamp(12px, 3vw, 48px);

   /* aliases — переопределение старых brand-токенов через ethno-палитру (визуальный шаг к новой эстетике;
      затронет ВСЕ места которые сейчас используют bg-brand-forest / text-brand-amber / ... — это намеренно) */
   --brand-forest: var(--forest);
   --brand-amber: var(--ochre);
   --brand-clay: var(--oxblood);
   --brand-sand: var(--paper-light);
   --brand-olive: var(--forest-deep);
   ```

   **Внимание для dark-theme:** в `[data-theme='dark']` (`globals.css:193+`) shadcn-токены меняются под тёмную тему, но ethno-палитра здесь **paper-based** (светлый бумажный фон) — выбор страницы. В PR1 dark-вариант ethno-токенов **не делаем**, главная всегда «дневная» (как в handoff-bundle). Если в будущем потребуется dark-mode — добавить в `[data-theme='dark']` блок переопределений `--paper → --ink`, `--forest → --paper`, etc. — задача отдельная.

2. **`web/src/app/layout.tsx` или `web/src/app/(frontend)/layout.tsx`** — подключение шрифтов через `next/font/google`. Готовый snippet:

   ```ts
   import { PT_Serif, Manrope, JetBrains_Mono } from 'next/font/google'

   const ptSerif = PT_Serif({
     subsets: ['cyrillic', 'latin'],
     weight: ['400', '700'],
     style: ['normal', 'italic'],
     variable: '--font-pt-serif',
     display: 'swap',
   })

   const manrope = Manrope({
     subsets: ['cyrillic', 'latin'],
     weight: ['300', '400', '500', '600', '700', '800'],
     variable: '--font-manrope',
     display: 'swap',
   })

   const jetbrainsMono = JetBrains_Mono({
     subsets: ['cyrillic', 'latin'],
     weight: ['400', '500'],
     variable: '--font-jetbrains-mono',
     display: 'swap',
   })

   // в JSX:
   // <html lang="ru" className={`${ptSerif.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
   ```

   Подписки PT Serif `italic` нужны для акцентов («*жемчужина*» в hero, italic-oxblood в featured). `display: 'swap'` — стандарт для main-thread blocking-free загрузки.

3. **Хедер** — переписать `web/src/Header/` под новую раскладку:
   - Лого с rhomb-знаком (☖ повёрнутый квадрат с точкой внутри) + текст «Гоньба»
   - Десктоп-nav из 5 пунктов: **Пожить / Делать / Смотреть / Лавка / О проекте** (берём из `header_nav_items`, но переопределяем как 5 фиксированных групп)
   - Кнопка-гамбургер на mobile (≤899px)
   - Прозрачный фон с белым текстом поверх hero (`position: absolute`, `z-index: 50`)
   - Drawer (slide-in справа) с группировкой по 4 категориям + подзаголовками («ЭКО-отель / над рекой, 6 номеров»). Body scroll-lock, Esc-close.

4. **Footer** — переписать `web/src/Footer/`:
   - 3-колонник: бренд + разделы + контакты+соцсети
   - Фон `--ink` (тёмный), текст `--paper`
   - Орнаментальные h3 «· Разделы ·» / «· Контакты ·»

5. **Чистка слагов в навигации** — открыть admin Payload и для 3 проектов проставить русские `title`:
   - `eco-hotel-booking` → «ЭКО-отель» (или какое финальное имя)
   - `about-project` → «О проекте»
   - `vyatskiy-sbor` → «Вятский сбор»

6. **Глобал `Header` collection** — добавить fixture-набор из 5 групп (`Пожить / Делать / Смотреть / Лавка / О проекте`), убрать старые 10 пунктов. На проде — миграция данных через `payload.updateGlobal` (по аналогии с `web/src/endpoints/seed/index.ts:300`).

   **Готовый snippet (создать как `web/scripts/seed-header-nav-ethno.ts`):**

   ```ts
   import { getPayload } from 'payload'
   import config from '@/payload.config'

   const payload = await getPayload({ config })

   await payload.updateGlobal({
     slug: 'header',
     data: {
       navItems: [
         { link: { type: 'custom', url: '/projects?group=stay', label: 'Пожить' } },
         { link: { type: 'custom', url: '/projects?group=do', label: 'Делать' } },
         { link: { type: 'custom', url: '/projects?group=see', label: 'Смотреть' } },
         { link: { type: 'custom', url: '/projects?group=shop', label: 'Лавка' } },
         { link: { type: 'custom', url: '/projects/about-project', label: 'О проекте' } },
       ],
     },
   })

   console.log('header.navItems обновлён (5 групп этно-модерна)')
   process.exit(0)
   ```

   В `web/package.json` — добавить script: `"seed:header-ethno": "tsx scripts/seed-header-nav-ethno.ts"`. После merge PR1 — запустить локально один раз (`corepack pnpm run seed:header-ethno`) **на dev-БД для проверки**, потом на проде через `ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run seed:header-ethno"` после restart (или через локальный запуск с прод-DATABASE_URL — на dev-машине, **не** на Windows).

   **Маршрут `/projects?group=<stay|do|see|shop>`** — query-фильтр. Реализация фильтра на странице `/projects` — это часть PR3 (там же где GroupCards). На момент применения fixture'а в PR1 ссылки будут указывать на `/projects` (фильтр пока игнорируется, страница показывает весь каталог) — не блокер, корректно деградирует.

   **Drawer-подменю в Header** — **хардкод по handoff'у** (`gonba-home.html` строки 191-298), не зависит от Payload. Подзаголовки («над рекой, 6 номеров») тоже в Header-компоненте. Перенос в Payload (через nested array `subItems` или относительный фильтр по `Projects.group` после PR2) — отдельная задача, можно сделать в PR2+ или оставить хардкод до момента когда захочется редактировать через админку.

   **Откат fixture'а** при необходимости — запустить тот же скрипт со старым массивом из `web/src/endpoints/seed/index.ts:300` (5 пунктов: Проекты / События / Сервисы / Магазин / Контакты).

**Smoke:**
- Открыть `/`, `/projects`, `/posts/<любой>` — везде новая шапка/подвал.
- Mobile (390px) — drawer открывается/закрывается, scroll-lock работает.
- TypeScript — clean.
- Lighthouse mobile — нет регрессий по а11y.

**Файлы handoff'а для сверки:** строки 191-298 (HEADER + DRAWER), 651-701 (FOOTER) в [`gonba-home.html`](../design/handoff-2026-05-23/gonba-home.html).

---

### PR2 — Схема `Project` под этно-модерн (без визуальных изменений)

**Что меняется на сайте:** ничего. Только новые поля в админке.

**Что в коде:**

1. **`web/src/collections/Projects.ts`** — добавить поля:
   - `group: 'stay' | 'do' | 'see' | 'shop' | null` (radio-select, optional) — категория главной
   - `isHeroOfHomepage: boolean` (default false) — главное фото hero
   - `isFeatured: boolean` (default false) — попадает в featured-секцию
   - `excerpt: string` (max ~140 символов) — короткая выжимка под заголовком
   - `chapterRoman?: 'I' | 'II' | 'III' | 'IV' | 'V'` (необязательно, для маркера главы в featured/people секциях)
   - `kind: 'project' | 'person' | 'studio' | 'workshop' | 'event' | 'shop'` (radio) — определяет какая карточка-шаблон используется на главной

2. **Миграция** — `web/src/migrations/<TS>_add_project_group_fields.ts` + зеркало `.sql` (паттерн как `web/src/migrations/20260521_120000.ts` + `.sql`).

   **Важно:** `group` — зарезервированное слово SQL. Drizzle/Payload оборачивает все идентификаторы в `"..."`, поэтому работает, но **в SQL-зеркале писать строго `"group"` с кавычками**. Альтернатива (если не хочется reserved-word) — переименовать поле в Payload в `homepageGroup` → колонка `homepage_group`; решение в начале PR2.

   **Заготовка `.ts`:**

   ```ts
   import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

   export async function up({ db }: MigrateUpArgs): Promise<void> {
     await db.execute(sql`
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "group" varchar;
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_hero_of_homepage" boolean DEFAULT false NOT NULL;
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "excerpt" varchar;
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "chapter_roman" varchar;
       ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "kind" varchar DEFAULT 'project' NOT NULL;
     `)
   }

   export async function down({ db }: MigrateDownArgs): Promise<void> {
     await db.execute(sql`
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "kind";
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "chapter_roman";
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "excerpt";
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "is_featured";
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "is_hero_of_homepage";
       ALTER TABLE "projects" DROP COLUMN IF EXISTS "group";
     `)
   }
   ```

   **Заготовка `.sql` (зеркало `up()` для `psql -f`, идемпотентно):**

   ```sql
   -- Mirror of <TS>_add_project_group_fields.ts up() for direct psql apply.
   -- Idempotent: safe to run on a database where columns already exist.
   BEGIN;

   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "group" varchar;
   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_hero_of_homepage" boolean DEFAULT false NOT NULL;
   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "excerpt" varchar;
   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "chapter_roman" varchar;
   ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "kind" varchar DEFAULT 'project' NOT NULL;

   COMMIT;
   ```

   **Регистрация в `web/src/migrations/index.ts`:** добавить import + entry в массив `migrations`:

   ```ts
   import * as migration_<TS>_add_project_group_fields from './<TS>_add_project_group_fields';

   // ...
   {
     up: migration_<TS>_add_project_group_fields.up,
     down: migration_<TS>_add_project_group_fields.down,
     name: '<TS>_add_project_group_fields',
   },
   ```

   **Timestamp:** при создании на dev-машине — `corepack pnpm payload migrate:create --name add_project_group_fields` сгенерирует актуальный, либо вручную в формате `YYYYMMDD_HHMMSS`. Существующие миграции: `20260521_120000` последняя — должно быть строго позже.

   **Файлы не созданы в `web/src/migrations/` сейчас намеренно** — добавление миграции без сопровождающего изменения коллекции (Payload `push: true` на проде → попытка убрать «лишнюю» колонку при следующем restart) опасно. Создавать на dev-машине **вместе** с изменениями в `web/src/collections/Projects/` (см. §1 выше) одним PR.

3. **`payload generate:types`** — обновить `web/src/payload-types.ts`.

4. **Маппинг 10 проектов на группы** — после миграции, через админку (или через скрипт `web/scripts/seed-project-groups.ts`):

   | Slug / название | `kind` | `group` | `isFeatured` | `isHero` |
   |---|---|---|---|---|
   | `eco-hotel` | project | stay | — | — |
   | `village-and-temple` («Село и храм») | project | see | ✓ | ✓ |
   | `workshops` (умбра) | project | do | — | — |
   | `excursions` | project | do | — | — |
   | `horse-club` | studio | do | — | — |
   | `vyatskaya-lepota` | studio | see | — | — |
   | `gulfia` | person | see | — | — |
   | `events` (агрегат) | project | see | — | — |
   | `vyatskiy-sbor` | shop | shop | — | — |
   | `about-project` | project | — (не на главной) | — | — |

   **Точный маппинг уточняет пользователь в начале PR2**, потому что некоторые slug'и в БД могут быть другие.

5. **`/orbit` страница** — создать `web/src/app/(frontend)/orbit/page.tsx` и **перенести туда** существующий `HomeCarouselMenuClient`. Главная (`/page.tsx`) — пока без изменений (старый компонент остаётся в `Home/`), это сделаем в PR3.

**Smoke:**
- Админка показывает новые поля, типы корректны.
- `payload migrate` идёмпотентен.
- `/orbit` показывает то же, что было на `/`.
- Старая `/` пока не сломана.

---

### PR3 — Новая главная: hero + 4-group cards + featured + quote

**Что меняется на сайте:** главная превращается в этно-модерн. Орбит-карусель окончательно уезжает на `/orbit`.

**Что в коде:**

1. **`web/src/app/(frontend)/page.tsx`** — переписать главную как composition новых секций:
   ```
   <HeroFeaturedProject />
   <GroupCards />
   <FeaturedChapter chapter="I" />
   <QuoteSection />
   ```

2. **`web/src/components/Home/Hero.tsx`** — full-viewport hero:
   - Берёт проект с `isHeroOfHomepage: true` (fallback — village-and-temple)
   - Поле `mainImage` рендерится как `<img loading="eager">` фоном
   - Overlay `linear-gradient(180deg, rgba(20,18,14,.45) 0%, rgba(20,18,14,.05) 30%, rgba(20,18,14,.85) 100%)`
   - Заголовок «Гоньба — *жемчужина* Вятки.» (italic-янтарный на «жемчужина»)
   - Подзаголовок из `excerpt`
   - Файлы handoff'а: строки 303-349, 826-837 в `gonba-home.html`.

3. **`web/src/components/Home/GroupCards.tsx`** — 4-group cards:
   - Сетка: `2×2` mobile, `1×4` desktop (≥900px)
   - 4 карточки: stay/do/see/shop с цветной обводкой (`--forest` / `--ochre` / `--oxblood` / `#3a5236`)
   - Каждая ведёт на `/projects?group=<...>` или прямо на конкретный slug, **уточнить в начале PR3**
   - Файлы handoff'а: строки 351-392, 840-866.

4. **`web/src/components/Home/FeaturedChapter.tsx`** — featured-секция:
   - Берёт проект с `isFeatured: true` и `chapterRoman: 'I'`
   - Двухколоночная вёрстка: фото в `frame` (рамка `padding 8px` + светлый `--paper-deep`) слева, текст справа
   - Заголовок с italic-oxblood вторым строкой
   - CTA-кнопка `Читать главу →` (btn--ghost)
   - Файлы handoff'а: строки 397-460, 870-887.

5. **`web/src/components/Home/QuoteSection.tsx`** — цитата Радищева:
   - Центрированный блок, фон `--paper-deep`
   - Rhomb-знак сверху
   - Italic serif blockquote, max-width `22ch`
   - Цитата+автор — пока хардкод (потом можно вынести в Global `Quotes`)
   - Файлы handoff'а: строки 625-647, 1041-1048.

6. **`web/src/Home/HomeCarouselMenuClient.tsx` + `HomeProjectGridMobile.tsx`** — **не удаляем**, остаются для `/orbit`. Из `/page.tsx` — выпиливаем импорт.

**Smoke:**
- Hero на mobile (390px) — фото full-bleed, заголовок читается, кнопка nav поверх.
- 4-group cards меняются на 2×2/1×4 по resize.
- Featured-проект кликается, ведёт на правильный проект.
- Старая orbit-карусель доступна по `/orbit` (теперь это её единственный entry).
- Lighthouse mobile performance — пересчитать.

---

### PR4 — Остальные секции главной: people + crafts + shop banner + events

**Что меняется на сайте:** главная дополняется секциями «II / III / IV / V». Сайт становится полностью соответствующим шаблону.

**Что в коде:**

1. **`web/src/components/Home/PeopleSection.tsx`** — карточки людей/студий (3-up grid):
   - Берёт `Projects` с `kind in ('person', 'studio')`, ограничение по 3 первых с сортировкой по `order` (или вручную через `isFeatured`)
   - Фото 4:5, eyebrow («Малмыж · керамика»), заголовок serif, кнопка «История →»
   - Фон секции `--paper-deep`
   - Маркер главы `II · люди села`
   - Файлы handoff'а: строки 465-491, 893-932.

2. **`web/src/components/Home/CraftsSection.tsx`** — 4 мастерских:
   - Берёт `Projects` с `kind = 'workshop'` (или альтернатива — отдельная `Workshops`-коллекция в PR5; для PR4 — `kind`)
   - Сетка 2×2 mobile, 4×1 desktop
   - Карточка: фото 4:3, rhomb, заголовок, длительность+цена (`2 ч · 1 800 ₽`)
   - Длительность и цена пока **из поля `excerpt`** в формате «`2ч · 1800₽`», расширить в PR5 при необходимости
   - Маркер главы `III · что можно руками`
   - Файлы handoff'а: строки 496-525, 936-968.

3. **`web/src/components/Home/ShopBanner.tsx`** — баннер «Вятский сбор»:
   - Берёт `Projects` с `slug = 'vyatskiy-sbor'` (или `group = 'shop' && isFeatured`)
   - Фон `--forest`, текст `--paper`
   - Двухколоночная вёрстка: текст + фото
   - CTA `В магазин →` (btn--ochre)
   - Файлы handoff'а: строки 530-567, 972-988.

4. **`web/src/components/Home/EventsList.tsx`** — календарь событий:
   - Берёт ближайшие 4 события из `Events`-коллекции (sort by `date asc`, `where: { date: { greater_than_equal: now } }`)
   - Каждая строка: дата (день+месяц) | название | подзаголовок | →
   - Кнопка «Все события сезона →» внизу
   - Маркер главы `V · что будет летом`
   - Файлы handoff'а: строки 571-621, 992-1039.

5. **`web/src/app/(frontend)/page.tsx`** — собрать всё в композицию:
   ```
   <HeroFeaturedProject />
   <GroupCards />
   <FeaturedChapter chapter="I" />
   <PeopleSection chapter="II" />
   <CraftsSection chapter="III" />
   <ShopBanner chapter="IV" />
   <EventsList chapter="V" />
   <QuoteSection />
   ```

6. **Schema.org** — обновить `<head>` главной: `TouristAttraction` JSON-LD + OG-теги (см. handoff строки 7-37). Это можно подключить через Payload Globals (поле `seo`).

**Smoke:**
- Полная главная на mobile + desktop — все 7 секций отрисовываются.
- Lighthouse mobile — performance 90+, accessibility 95+.
- Прод-build через `/reliz` проходит.

---

## После PR4 — открытые задачи (возможный PR5+)

Это **не блокеры**, можно делать когда руки дойдут или по запросу:

- **`Workshops`-коллекция** с полями `durationMinutes` и `priceRub` для нормального вывода цен мастерских (вместо хардкода в `excerpt`).
- **`Quotes` Global** — чтобы цитата Радищева на главной была редактируемой (сейчас хардкод).
- **`/people/` страница** — листинг всех проектов с `kind in ('person', 'studio')`, если их станет больше 3 (пока на главной — все 3).
- **A/B-test old vs new** через flag — если страшно катить сразу. Не обязательно.
- **Удалить старые компоненты orbit-карусели**, если они так и не понадобятся на `/orbit` (или /orbit окажется ненужной).

---

## Текущий этап

🟢 **Plan locked + входные данные для PR1/PR2 зафиксированы** (сессия 2026-05-23, ч.2).

**Решения пользователя (2026-05-23):**

1. **Русские имена slug-only проектов** (применить при PR1 в `header_nav_items` и drawer):
   - `eco-hotel-booking` → **«ЭКО-отель»**
   - `about-project` → **«О проекте»**
   - `vyatskiy-sbor` → **«Вятский сбор»**
2. **Шрифты** — подтверждены: **PT Serif** (заголовки) + **Manrope** (sans) + **JetBrains Mono** (eyebrows), все через `next/font/google`.
3. **Маппинг 10 проектов на 4 группы** — принят как в PR2 §4 (см. таблицу выше). Финальные коррективы (если slug'и на проде отличаются) — в начале PR2 при доступе к админке.

Следующая сессия начинает с **PR1** на машине с рабочим dev-окружением.

---

## Связь с другими документами

- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](../adr/0004-frontpage-ethno-modern-redesign.md) — обоснование выбора направления B.
- **Handoff-источник:** [`docs/design/handoff-2026-05-23/`](../design/handoff-2026-05-23/INDEX.md) — все дизайн-файлы.
- **PENDING_FOLLOWUPS:** на момент 2026-05-23 ни одна запись не относится к этому плану. Это **новая** многоэтапная задача, не разгребание долгов.
- **SESSION_HANDOFF:** активная нитка — этот план. См. `docs/SESSION_HANDOFF.md`.
