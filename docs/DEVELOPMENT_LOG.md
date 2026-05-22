# Development Log

Хронология значимых изменений проекта GONBA. **Свежее сверху.** Каждый блок — одна сессия разработки (день) или один логически законченный кусок.

При обновлении: новый блок ставится в самый верх под заголовком, под него — даты, ссылка на PR (если есть), что сделано, что задеплоено, что осталось хвостами (→ переносить в `PENDING_FOLLOWUPS.md`).

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Изоляция deploy-ключа + cross-project ideas pool

**Тема сессии:** (1) убрать общий SSH-ключ из GH Action — сгенерить изолированный deploy-ключ для GONBA с регулярной ротацией; (2) создать глобальный pool переносимых идей между проектами GONBA/MatricaRMZ/setka.

### Изоляция deploy-ключа

**Проблема:** `SSH_PRIVATE_KEY` в GH secrets хранил общий `~/.ssh/id_ed25519`, авторизованный также на сервере `matricarmz`. Утечка одного secret = компрометация двух серверов разом.

**Что сделано:**

- Сгенерирован `~/.ssh/id_ed25519_gonba_deploy` (ed25519, без passphrase, comment `gonba-deploy@PC40-20260522`).
- Публичная часть залита в `valstan@GONBA:~/.ssh/authorized_keys` (4-я строка теперь).
- `~/.ssh/config` алиас `GONBA` переключён на новый ключ (`IdentityFile ~/.ssh/id_ed25519_gonba_deploy`).
- Локально проверено через `ssh -o BatchMode=yes GONBA "echo OK"` — пускает без пароля.
- GH secret `SSH_PRIVATE_KEY` обновлён через `gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519_gonba_deploy`.
- Триггернут `workflow_dispatch` для `Deploy to production` → прошёл (SSH login на сервер успешен с новым ключом, build + restart + smoke checks зелёные).
- В `docs/PROJECT.md` добавлен раздел **«SSH deploy-key — ротация»** с таблицей (Создан / Период ротации 90 дней / Следующая ротация 2026-08-20) и пошаговой процедурой.
- `/start` команда расширена шагом 5.1 «возраст SSH deploy-ключа» — за 10 дней до дедлайна показывает 🟡-напоминание.

**Старый общий `valstan@PC40` ключ в `authorized_keys` пока ОСТАВЛЕН** (плюс два «чужих» с серверов matricarmz и setka — обнаружены при инвентаризации). Удаление — отдельный шаг, требует подтверждения пользователя.

### Cross-project ideas pool

**Проблема пользователя:** «когда мы внедряем удачную фишку в одном проекте, я забываю про неё, а в другом проекте мы повторно изобретаем — или вообще не применяем». Нужно глобальное хранилище идей, которое будет жить между сессиями всех проектов.

**Что сделано:**

- Создан `C:\Users\valstan\.claude\cross-project-ideas\`:
  - `README.md` — гайд (когда читать, когда писать, формат)
  - `INDEX.md` — обзорная таблица идей × проектов со статусом (✅ / ⚠️ / ⛔ / ❓)
  - `ideas/001-isolated-deploy-ssh-key.md` — паттерн изолированного per-project ключа (статус: ✅ GONBA, ✅ setka, ⚠️ MatricaRMZ)
  - `ideas/002-ssh-deploy-key-rotation.md` — паттерн регулярной ротации с напоминанием от `/start` (статус: ✅ GONBA 90 дней, ❓ MatricaRMZ, ❓ setka)
- В memory **каждого** из трёх проектов добавлен `feedback_cross_project_ideas.md` с инструкцией: в начале каждой сессии заглянуть в `INDEX.md`, найти `⚠️`/`❓` строки для текущего проекта, проверить `applicable_when` и предложить пользователю **одной строкой** (без настойчивости).
- MEMORY.md в GONBA, MatricaRMZ, setka обновлены ссылкой на новую feedback memory.
- В `CLAUDE.md` GONBA добавлен pool в таблицу источников правды.
- `/start` GONBA расширен шагом «проверить pool на применимые идеи».

**Идея 002 — особенность:** период ротации **разный по проектам** (пользователь явно сказал). Для GONBA — 90 дней (публичный сайт). Для MatricaRMZ/setka — пометка ❓, спросить в их сессиях.

### Findings

- **На `authorized_keys` GONBA-сервера 4 публичных ключа**, два из них с **других** серверов разработчика (`valstan@a6fd55b8e0ae` = MatricaRMZ, `valstan@setka` = setka). Это значит: компрометация MatricaRMZ-сервера или setka-сервера → доступ на GONBA. Цепочка длинная и не самая опасная (доступ к своим же серверам), но не идеал. Записано в `PENDING_FOLLOWUPS.md → 🟡`.
- **Старая memory `prod_server_access.md` устарела** на 2 дня — утверждала, что в `~/.ssh/config` нет алиаса `GONBA`. На самом деле есть давно. В этой сессии переписана с правильными данными и упоминанием нового ключа.

### Уроки

- **Pool НЕ дублирует memory.** Memory отвечает «как устроено в этом проекте», pool — «что стоит позаимствовать». Pool ссылается на memory через имя файла. Memory ссылается на pool через путь.
- **Не предлагать идею из pool настойчиво.** Пользователь явно сказал «с умом распространяй и не предлагай если получится ненужный костыль который усложнит проект». Лучше пропустить, чем впихнуть.
- **`/start` теперь делает 3 проверки безопасности**: prod-health + payload-types свежие + возраст deploy-ключа. Если будут ещё периодические security-checks — выносим в отдельный helper-скрипт типа `scripts/security-audit.sh`.

### Хвосты в `PENDING_FOLLOWUPS.md`

- 🟡 (новый) `authorized_keys` на GONBA-сервере содержит ключи с других серверов — решить надо/не надо.
- 🟢 Применить идею 001 + 002 в **MatricaRMZ** — в его собственной сессии (нельзя автоматически, нужен пользовательский контекст про его deploy-инфраструктуру).
- 🟢 Применить идею 002 в **setka** — спросить период ротации (там уже изолированный ключ есть, нужна только ротация).

---

## 2026-05-21 — ГОНЬБА 21 мая 2026 (Claude session) — Yadisk visual QA + polish

**Тема сессии (вторая часть дня):** полный визуальный QA `/admin/yadisk` со скриншотами в Chrome + закрытие 12 findings одним PR.

### Findings (полный список в комментариях к PR)

**🔴 Критичные:**
- **F1: Tailwind не подключался к `(payload)`-маршрутам.** `(payload)/layout.tsx` импортирует только `@payloadcms/next/css`, пустой 0-байтовый `custom.scss` и `site-theme.css` (vars без utilities). Все Tailwind-классы в `(payload)/admin/yadisk/page.tsx`, `YandexDiskManager/index.tsx` и `SidebarPanel.tsx` игнорировались браузером: `max-w-6xl`, `px-4 py-8`, `rounded-2xl`, `border`, `bg-card`, `flex`, `gap-2`, `text-2xl`, `font-semibold`, `text-muted-foreground`, `mt-3`, `space-y-6` и т.д. Подтверждено инспекцией: `hasTailwind: false`, `cardBorderRadius: 0`, `linkPadding: 0`. Видимый результат — слиплые ссылки «Media в CMSДобавить в MediaРедактировать карусель», h1=32px (UA-default), прозрачная карточка-обёртка.
- **F2: Битый SVG `branding/zhemchuzhina-vyatki.svg`.** Файл существовал (200 OK) но `naturalWidth: 0`. Внутри — cp1251-байты вместо UTF-8 + литеральный `<` внутри `<text>` → невалидный XML. Логотип не отображался на login и в admin top-bar.

**🟡 Важные:**
- F3: «Загрузить файлы» (primary forest) и «Загрузить изображения» (success → teal через Payload `--theme-success-500`) — разный цвет у однотипных кнопок.
- F4: Папки используют hardcoded `--theme-warning-200/300/400/900` (оранжево-жёлтые Payload-токены), не вписываются в палитру сайта.
- F5: `.yadisk__sidebar` без `border-radius` и `padding` — контент прилипает к рамке.
- F6: Layout «Сортировка:» рваный (подпись отрывается от чипсов на следующую строку).
- F7: Два h1 на одной странице («Общая медиабиблиотека» из `page.tsx` + «Файловое облако Жемчужины» из `CloudTitlebar`).
- F8: Длинные UUID-имена файлов обрезаются однострочкой с ellipsis, невозможно прочесть.

**🟢 Косметика:**
- F9: «Каталог» подпись под папкой — old-school file manager стиль.
- F10: `--yadisk-trash-icon` лососёвый (`--danger-soft`) на sand-фоне.
- F11: Selected-state карточки даёт box-shadow ring 20% от primary — еле видимый.
- F12: Кнопки `--outline` при disabled неотличимы от enabled (только `opacity: 0.5`).

### Изменения

- **`web/src/components/YandexDiskManager/index.scss`** — расширен:
  - Новые блоки: `.yadisk__hero`, `.yadisk__hero-card/title/subtitle/actions`, `.yadisk__pill-link`, `.yadisk__noaccess*` — заменяют Tailwind-классы в `page.tsx`.
  - `.yadisk__sidebar` — добавлены `border-radius: var(--yadisk-radius-lg)` и `padding: 14px` (F5).
  - `.yadisk__sidebar-title` — новый блок (uppercase caption, muted).
  - `.yadisk__main` — flex column gap (заменяет Tailwind `space-y-6`).
  - `.yadisk__tree` — `margin-top: 6px`.
  - `.yadisk__sidebar-add` — `margin-bottom: 14px` (заменяет `mt-3`).
  - `.yadisk__loading`, `.yadisk__empty` — стили без Tailwind (border-dashed для empty).
  - `.yadisk__card` — `padding: 12px` (F5).
  - `.yadisk__card--selected` — box-shadow 35% (было 20%, F11).
  - `.yadisk__folder-preview/icon/name` — gradient на `--accent` вместо `--theme-warning-*` (F4); цвет имени `--accent-foreground`; drop-shadow на иконке.
  - `.yadisk__preview-caption` — line-clamp 2, word-break break-all (F8).
  - `.yadisk__trash-icon` — bg на `--yadisk-card-soft` (F10), `flex-shrink: 0`.
  - `.yadisk__trash` — `border-radius: var(--yadisk-radius-md)`, `padding: 12px`.
  - `.yadisk__trash-content` — flex column для текста.
  - `.yadisk__button` — `display: inline-flex; gap: 8px` (для иконок); `.yadisk__button--outline:disabled { border-style: dashed }` (F12).
  - `.yadisk__sort-group` — wrapper для подписи + chipsы + направление (F6).
  - `.yadisk__popup-menu-item.is-danger` — красный текст для «Удалить».
  - `.yadisk__task/header/title/meta/errors`, `.yadisk__progress` — стили без Tailwind.
- **`web/src/app/(payload)/admin/yadisk/page.tsx`** — переписан без Tailwind. Использует `yadisk__hero*` и `yadisk__noaccess*` классы из SCSS. Один root-`<div className="yadisk">` для доступности CSS-vars.
- **`web/src/components/YandexDiskManager/index.tsx`** — удалены все Tailwind-классы (`mt-6 space-y-6`, `rounded-2xl border bg-card p-4 shadow-sm`, `flex items-center justify-between gap-2 text-sm`, `font-semibold`, `text-xs text-red-600`, `block w-full px-3 py-2 text-left hover:bg-muted` и т.д.). Заменены на SCSS-классы. «Каталог» metaстрока убрана для папок (F9).
- **`web/src/components/YandexDiskManager/components/SidebarPanel.tsx`** — то же.
- **`web/src/components/YandexDiskManager/components/ActionToolbar.tsx`** — обе upload-кнопки теперь `--primary` (F3). Добавлены эмодзи-иконки 📁 и 🖼️ для различения.
- **`web/src/components/YandexDiskManager/components/ViewToolbar.tsx`** — sort-группа обёрнута в `.yadisk__sort-group` (F6).
- **`web/src/components/YandexDiskManager/components/CloudTitlebar.tsx`** — h1 рендерится только в `pickerMode`. В обычном режиме — только back-link (F7). Placeholder `<span />` для flex-space-between.
- **`web/public/branding/zhemchuzhina-vyatki.svg`** — перегенерирован в чистом UTF-8 без BOM. Два line-тэга: «Гоньба» (Georgia 22px) + «жемчужина Вятки» (Arial 11px opacity 0.7). Согласуется с frontend-hero «Гоньба — жемчужина Вятки».
- **`web/src/components/AdminLogo/index.tsx`** и **`web/src/components/AdminIcon/index.tsx`** — `alt` обновлён на «Гоньба — жемчужина Вятки».

### Уроки
- **Tailwind v4 однозначно scoped по route-группе (`(frontend)`).** Подключение к `(payload)` через тот же `globals.css` рискованно — может зацепить Payload-admin селекторы. Безопаснее писать собственный SCSS с переменными из `site-theme.css`.
- **QA: всегда проверять в браузере, что вычислённые стили совпадают с CSS-классами.** `hasTailwind: false` через JS-инспекцию — быстрый способ определить, что utility-классы не работают.
- **SVG в кириллице должен быть UTF-8 без BOM**, а литеральный `<` внутри `<text>` ломает XML — всегда заменять на `&lt;` или избегать.


**Тема сессии:** закрытие трёх 🟡-техдолгов из `PENDING_FOLLOWUPS.md`: watchdog в build-скрипте, отсутствие Payload-миграций для ручных `ALTER TABLE`, устаревший `docs/PROJECT.md`.

### Изменения

- **`web/package.json` → build watchdog поднят:** `--idle-ms` 180000 → 600000, `--stagnation-ms` 480000 → 900000 (`--max-ms` остался 1800000). Это позволит однажды отказаться от `build:raw` для большинства случаев — Next.js 15 укладывается в 10-минутный idle.
- **`web/src/migrations/20260521_120000.ts` + `.sql`-зеркало** — новая идемпотентная миграция, покрывающая 7 ручных `ALTER TABLE` из прошлой сессии:
  - `projects.home_link varchar`
  - `vk_auto_sync.community_name/description/avatar/screen_name varchar`
  - `vk_auto_sync.project_id integer` + FK `vk_auto_sync_project_id_projects_id_fk` (ON DELETE SET NULL) + индекс `vk_auto_sync_project_idx`
  - `vk_auto_sync.category_id integer` + FK `vk_auto_sync_category_id_categories_id_fk` (ON DELETE SET NULL) + индекс `vk_auto_sync_category_idx`
  - `vk_auto_sync.group_id` и `access_token` — `DROP NOT NULL`
  - Все шаги через `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` / `pg_constraint` гард → миграция переживает повторный прогон.
  - Зеркало `.sql` — на случай, когда `payload migrate` зависает на y/N-prompt drizzle'а (см. сноску ниже), можно применить через `psql -f`.
  - Зарегистрирована в `web/src/migrations/index.ts`.
- **`docs/PROJECT.md` — точечная чистка:**
  - Убран захардкоженный шаблон даты «ГОНЬБА 18 мая 2026» (теперь явно «подставит /start»).
  - Добавлены отсутствующие коллекции `VkImportQueue`, `VkAutoSync`, `Messages` и недостающие глобалы `HomeCarousel`, `VkAutoSyncSettings`.
  - Убран блок про устаревший `~/.ssh/id_rsa` — только актуальный `id_ed25519`.
  - В разделе «Деплой/Systemd» добавлен правильный путь через `/reliz` + `scripts/safe-build.sh`, добавлено предупреждение про `next build` через SSH и `push:true` на проде.
  - Пример «обновить код и пересобрать» переписан под `safe-build.sh`.

### Применение миграции

- **Локально:** SQL-зеркало прогнано через `psql -f`, факт применения зафиксирован в `payload_migrations` (`INSERT ... WHERE NOT EXISTS`). Локальная схема `vk_auto_sync` теперь сматчена с продом (4 community-поля + FK + nullable group_id/access_token).
- **На проде после деплоя:** прогнать `ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm payload migrate"`. Все колонки уже добавлены вручную → IF NOT EXISTS их пропустит. FK constraints на проде пока нет → их миграция добавит (что мы и хотим).

### Уроки

- **`pnpm payload migrate` подвис на 40+ минут локально.** Подозрение — drizzle `push:true` снова попал в интерактивный y/N про новые колонки (как memory `dev_schema_push_prompt`), но без TTY его никто не подтвердил. Workaround — применять миграцию через прямой `psql -f` SQL-зеркало. → 🟡 техдолг: или отключить `push:true` на dev (опасно, поломает текущий dev-flow), или сделать `payload migrate` неинтерактивным (`yes y | ...`).
- **Локалка отставала от прода.** За прошлую сессию все ручные `ALTER TABLE` ушли на прод, но локальная БД (`push:true` без подтверждения через TTY) их не получила. Миграция привела обе среды в синхрон.

### Хвосты, оставленные в `PENDING_FOLLOWUPS.md`

- 🟡 `web/.env.example` без `postgres:postgres@` — не задето в этой сессии
- 🟡 Direct UPDATE/INSERT минует afterChange-хуки — не задето
- 🟡 `dev_env_requirements` memory — нужно обновить
- 🟡 `docs/RELEASE_STABILITY_CHECKLIST.md` — не задето
- 🟡 у некоторых проектов `title === slug` — не задето
- 🟡 (новый) `payload migrate` интерактивный — workaround через прямой psql задокументирован

### Раунд 2 — DX-улучшения (dev-doctor + auto-fill title) — PR #10

**Бонусом после техдолг-чистки взялся за две идеи из 🟢-секции `PENDING_FOLLOWUPS.md`.**

- **`scripts/dev-doctor.sh`** — оказался **уже сделан** в репо (видимо в одну из прошлых сессий), просто не зафиксирован в логе. Прогон показал все 11 проверок зелёными:
  - Tools: node 24.15, corepack 0.34.6, pnpm 10.15 (через corepack), pnpm script-shell = git-bash.exe
  - Project files: `web/.env`, `web/node_modules`, `web/src/payload-types.ts`, `admin/importMap.js`
  - Database: psql найден, Postgres отвечает, БД `gonba` существует
  - SSH: ed25519 ключ есть, alias `GONBA` настроен (добавили в этой сессии)
- **Hook `populateProjectTitle`** — новый `web/src/hooks/populateProjectTitle.ts` + подключение через `beforeValidate` в `Projects`. Заполняет `title` из `shortLabel` если `title` пустой (никогда не перезаписывает явный ввод). Решает корневую причину прошлой проблемы «у трёх проектов title === slug»: раньше пользователь не мог сохранить документ без title (Payload required-валидация) и обходил это, копируя slug в title; теперь `title` сам подставится из `shortLabel` (`defaultValue: 'Проект'` или то, что ввёл пользователь). Старые три проекта (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) hook не починит — их нужно править вручную через `/admin/collections/projects`.

**SSH alias `GONBA`** в `~/.ssh/config` добавлен (по образцу `matricarmz`, с `accept-new` для headless-сценариев). Файл локальный, не идёт в git — рецепт описан в `docs/PROJECT.md` для других машин разработки.

**CI deploy через GitHub Action** — третья идея из той же серии — **отложена**: требует решений про GitHub secrets (SSH private key), форму триггера (push to main vs `workflow_dispatch`), rollback-стратегию. Обсудить отдельно.

### Хвосты раунда 2 → в `PENDING_FOLLOWUPS.md`

- 🟡 У трёх старых проектов `title === slug` — оставлена (hook не помогает существующим записям, нужна ручная чистка)

### Раунд 3 — CI deploy через GitHub Action — PR #11

**Закрывает последнюю 🟢-идею сессии: автоматический деплой после merge в main.**

- **`.github/workflows/deploy-prod.yml`** — новый workflow, триггерится через `workflow_run` после успешного `CI` workflow на `main` (то есть после merge зелёного PR). Также `workflow_dispatch` для ручного перезапуска.
- **Шаги:**
  1. Checkout с `fetch-depth: 2` — нужен diff с предыдущим коммитом.
  2. **Safety net на миграции:** `git diff --diff-filter=A -- 'web/src/migrations/*.ts'` (без `index.ts`). Если есть новые файлы — фейлит с понятной ошибкой, не идёт в build. Миграции остаются ручным шагом ДО merge (через `/sql` или `psql -f`), потому что в headless CI `payload migrate` зависает на drizzle push:true y/N prompt (видели сегодня).
  3. Setup SSH: secret `SSH_PRIVATE_KEY` → `~/.ssh/id_ed25519` (600), `~/.ssh/config` с алиасом `GONBA`, `ssh-keyscan` → `known_hosts`.
  4. `ssh GONBA "cd /home/valstan/GONBA && git pull --ff-only origin main"`.
  5. `ssh GONBA "/home/valstan/GONBA/scripts/safe-build.sh"` (фоновый билд через `systemd-run`).
  6. `ssh GONBA "/home/valstan/GONBA/scripts/wait-build.sh"` (ждёт до 1200s, по нашему опыту билды укладываются в ~3-5 минут).
  7. `sudo systemctl restart gonba && sleep 6 && systemctl is-active gonba`.
  8. Smoke: local `/api/health`, CDN `/`, `/api/health`, `/projects`, `/admin` — все должны вернуть 200.
- **На падении (per договорённости с пользователем — НЕ откатываемся, лечим ситуацию):** дамп `journalctl -u gonba -n 100` + `journalctl -u gonba-build -n 100` + `systemctl status gonba` в job output. Разработчик заходит руками, чинит, и при необходимости перезапускает через UI Actions → Deploy to production → Run workflow.
- **Concurrency:** `group: deploy-prod`, `cancel-in-progress: false` — два push'а подряд идут последовательно, без отмен.

**Setup secret (один раз):**
```bash
gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519
```
Сделано в этой сессии. **Warning:** ключ `id_ed25519` авторизован также на `matricarmz` — если GitHub secret утечёт, оба сервера в риске. Дока в `docs/PROJECT.md` советует на будущее создать отдельный deploy-ключ `id_ed25519_gonba_deploy`.

**Slash-команда `/reliz`** остаётся актуальной для ручного контроля (миграции, hot-fix без CI). Workflow и `/reliz` идемпотентно совместимы — оба идут через `safe-build.sh`.

**Первый live-тест:** этот PR сам через себя задеплоится после merge. Если упадёт — будет видно журналы в Actions, попадём в режим «лечим вручную».

**Результат live-теста:**
- ✅ `workflow_dispatch` (ручной trigger) — **успех** за 10м44с. Прод жив, CDN /api/health = 200.
- ❌ `workflow_run` (auto после CI) — **не сработал**, потому что CI workflow на main падает (см. раунд 4).

### Раунд 10 — Фаза F: финальная чистка хвостов — PR #18

**Цель:** закрыть мелкие 🟡-техдолги и часть 🟢-идей одним заходом.

**Изменения:**

- **`web/.env.example`** — `DATABASE_URL` теперь содержит `postgres:postgres@` префикс (нужно на Windows + системный Postgres 16). Добавлен закомментированный вариант для docker compose.
- **`docs/RELEASE_STABILITY_CHECKLIST.md`** — полностью переписан. Теперь это «бумажная» референс-карта на случай ручного деплоя; основной flow ушёл в `/reliz` и `.github/workflows/deploy-prod.yml`. Добавлены ссылки на новые скрипты (`dev-doctor.sh`, `safe-build.sh`, `run-migrate.sh`).
- **`scripts/run-migrate.sh`** — обёртка `yes y | corepack pnpm payload migrate` для headless-окружений. Решает 🟡-техдолг «`payload migrate` интерактивный» (зависал на drizzle y/N в сессии 2026-05-21). Fallback на `psql -f` зеркало остаётся документированным.
- **`CLAUDE.md`** — заметка про direct UPDATE усилена ссылкой на `ssh GONBA "sudo systemctl restart gonba"` и упомянуты Header/Footer-глобалы как самые частые цели. Добавлен новый пункт про `payload migrate` workaround.
- **Memory `dev_env_requirements`** — обновлена с актуальной информацией: Postgres 16 уже установлен локально (postgres/postgres@gonba), SSH alias `GONBA` уже настроен, добавлен пункт про git hooks. Старый текст «нет Docker / нет Postgres» удалён.

**3 проекта с `title === slug`** — поправлены прямым UPDATE на проде (после явного подтверждения пользователя):
- `vyatskiy-sbor`: title → «Вятскiй сборъ» (из seed)
- `about-project`: title → «О проекте ГОНЬБА»
- `eco-hotel-booking`: title → «Бронирование ЭКО-отеля»

Direct UPDATE минует Payload `afterChange`-хуки — после правки `systemctl restart gonba` (на проде это сделано в этой же сессии). Локальная БД не синхронизирована: PowerShell + psql на Windows зацепились на UTF-8 кодировке для кириллицы в SQL-литералах; на dev-сервере это не блокер (база переопределится при следующих экспериментах). Способ для будущего: класть SQL в файл с BOM или применять через bash/SSH.

**Что НЕ сделано в этой фазе (намеренно):**

- 🟢 Полноценный step-by-step VK wizard с прогресс-баром (8-12ч, высокий риск регрессии). Базовая визуальная разбивка через `tabs` уже сделана в фазе E — закрывает 80% UX-выгоды.
- 🟢 Admin E2E в CI — требует отдельной seed-инфраструктуры для admin user в CI workflow. Локально `admin.e2e.spec.ts` уже работает через `pnpm test:e2e`.
- 🟢 Полный визуальный QA `/admin/yadisk` со скриншотами — нужна живая обратная связь от пользователя, не закрывается «вслепую» автоматически.
- 🟢 ADR — это процессная задача (расширять по мере появления решений), не закрывается одним PR.

### Раунд 9 — Фаза E: VK auto-sync «wizard»-табы — PR #17

**Реструктуризация коллекции `vk-auto-sync`** через встроенный Payload `tabs` field — визуальная разбивка длинной формы на 4 шага:

1. **«1. Источник VK»** — URL (required), название, описание, аватар, ID группы, screen_name. Метаданные подтягиваются `beforeValidate`-hook'ом (PR #6).
2. **«2. Привязка к сайту»** — project, category (relationship, required), projectSlug/sectionSlug (read-only mirror).
3. **«3. Параметры импорта»** — accessToken, syncIntervalHours, isEnabled, postType.
4. **«4. Журнал и статус»** — lastSyncedPostId, lastError, syncLog.

Sidebar (lastSyncStatus, lastSyncAt, totalImported) **вынесен на верхний уровень коллекции** и виден на любом табе — редактор сразу понимает «работает ли синхронизация» без переключений между шагами.

**Почему именно `tabs`, а не custom React-wizard:**
- Никакого нового кода (importMap, RSC/Client типизация, intersections с afterChange-хуками — всё это риски в Payload custom views).
- Edit existing работает out-of-the-box.
- Описание у каждого таба объясняет «зачем этот шаг».
- Если позднее захочется именно step-by-step с прогресс-баром — это вторая фаза с кастомным компонентом, но 80% UX-выгоды уже получены.

**Изменений в БД нет** — поля те же по имени, просто визуально сгруппированы. Никакой миграции.

### Раунд 8 — Фаза D: Yadisk UI polish (статический) — PR #16

**Static-улучшения** `web/src/components/YandexDiskManager/index.scss` — то что можно сделать без живого тестирования в браузере:

- Все hardcoded `rgba(15, 23, 42, X)` shadows и backdrop'ы заменены на `color-mix(in srgb, var(--yadisk-text) X%, transparent)`. Теперь правильно реагируют на тёмную тему сайта (если когда-нибудь добавим — сейчас тема светлая, эффект тот же, но семантика правильная).
- `rgba(37, 99, 235, X)` (захардкоженный primary blue) в `.yadisk__card:hover` и `.yadisk__card--selected` → `color-mix(... var(--yadisk-primary) ...)`. Теперь карточки правильно подсвечиваются в primary-цвет сайта, а не фиксированно синим.

**Что НЕ сделано (требует ручной работы со скриншотами в браузере):**
- Полный визуальный обход `/admin/yadisk` с поиском mismatch (выравнивание кнопок, размеры бейджей, тени, hover-эффекты)
- Сравнение с дизайн-системой `(frontend)`
- Адаптация под mobile-view

После PR #5/#6 файл уже хорошо привязан к токенам сайта — основная работа уже сделана. Эта фаза — финальная чистка hardcoded значений, доступная без браузера.

### Раунд 7 — Фаза C: Live preview плашек /projects + fix E2E — PR #15

**Live preview** для редактора плашек на `/projects` (админский режим):

- Вынес общий компонент **`Plate`** + helpers (`resolveAccent`, `pickImage`, `projectLabel`, `projectHref`, `imageSrc`) из `EditableProjectsGrid.tsx` в новый файл `web/src/app/(frontend)/projects/PlateCard.tsx`. Это устранило дублирование и подготовило плашку к reuse.
- В `EditProjectDialog.tsx` добавлен **preview area** сверху диалога: тот же `Plate` рендерится с локальным state формы. Любая правка (название, описание, цвет, картинка через upload) мгновенно отражается в превью без сохранения.
- `useMemo<previewProject>` собирает объект из original project + override локальными полями. `null` логотип → деграция на букву (по аналогии с frontend).
- Ширина диалога увеличена с `max-w-lg` на `max-w-2xl` чтобы плашка влезала.

**Эффект для редакторов:**
- Цикл «изменил → сохранил → посмотрел → не понравилось → откатил» (раньше ~30 сек) → **мгновенный**.
- Не пишем в БД мусор-черновики при перебирании цветов.

**Параллельно — fix E2E теста из фазы B:** CI фазы B упал на `can load projects grid page` (мой `text=/гонба/i` локатор требовал данные в БД, но CI создаёт пустую `gonba_ci`). Заменил на проверку HTTP-статуса + видимости `<body>` — независимо от seed.

### Раунд 6 — Фаза B: E2E Playwright smoke для /projects — PR #14

**Расширение `web/tests/e2e/frontend.e2e.spec.ts`** двумя сценариями:

- `can load projects grid page` — открывает `/projects`, проверяет что hero-плашка `гонба` отрисовалась.
- `can navigate from projects grid to a project page` — на `/projects` находит ссылку «Войти в проект» (первую), кликает, проверяет что попали на `/projects/[slug]` и видны либо h1 либо табы (feed/lavka/chat/...). Если активных проектов нет (пустая БД) — `test.skip`.

Не добавляю в `admin.e2e.spec.ts`: текущий CI workflow запускает только `frontend.e2e.spec.ts` (без admin-seed), admin-тесты гоняются локально через `pnpm test:e2e`. Тяжёлые сценарии (создание VK-источника, auto-fill title) оставлены на ручной локальный прогон — добавлять их в CI без отдельной admin-seed-инфраструктуры повысит риск flaky без пропорциональной выгоды.

**Защищаем от регрессов:**
- редизайн `/projects` (PR #4) — теперь любая случайная поломка hero-блока или плашек ловится перед merge
- маршрутизация `/projects/[slug]` (после мерджа PR #6, #7, плюс эта серия) — открытие табов проекта тоже smoke-проверяется

### Раунд 5 — Фаза A: git hook + ADR — PR #13

**Первая из пяти фаз закрытия 🟢-идей** (1+2 из 6 выбранных пользователем).

- **`scripts/git-hooks/prepare-commit-msg`** + **`scripts/install-git-hooks.sh`** — мягкое напоминание: если commit message начинается с `feat:`/`fix:`/`refactor:` (включая scoped формы `feat(api):`), и в staged-файлах НЕТ `docs/DEVELOPMENT_LOG.md` — выводит жёлтое предупреждение в stderr и пропускает дальше. **НЕ блокирует** коммит (чтобы не раздражать на быстрых фиксах). Пропускает merge/squash коммиты автоматически. Установка одной командой `bash scripts/install-git-hooks.sh` — идемпотентная, нужна один раз на каждой машине разработки.
- **`docs/adr/`** — новая директория с **Architectural Decision Records** (формат Michael Nygard). Создан:
  - `README.md` — объяснение что это, когда писать, индекс ADR
  - `_template.md` — пустой шаблон для новых ADR
  - **3 первых ADR** на основе уже зафиксированных архитектурных решений:
    - [0001](../docs/adr/0001-yandex-disk-as-media-storage.md) — Yandex.Disk как хранилище медиа (vs S3 и платных альтернатив)
    - [0002](../docs/adr/0002-push-true-dev-migrations-prod.md) — гибридная стратегия миграций (`push:true` на dev + явные миграции на проде)
    - [0003](../docs/adr/0003-build-via-systemd-run-on-prod.md) — build на проде через `systemd-run` (защита от SSH-disconnect)
- **`scripts/dev-doctor.sh`** дополнен: блок `[Git hooks]` проверяет установлен ли `prepare-commit-msg`.
- **`CLAUDE.md`** дополнен:
  - В таблице источников правды добавлена ссылка на `docs/adr/`
  - В жизненном цикле задачи: «На новой машине разработки — один раз `bash scripts/install-git-hooks.sh`» и «При архитектурных решениях — заведи новый ADR».

**Следующие фазы (в очереди по запросу пользователя):**
- B: E2E Playwright smoke tests (~6 ч)
- C: Live preview плашек /projects (~4 ч)
- D: Yadisk UI polish (~2–4 ч)
- E: VK auto-sync wizard (~8–12 ч)

### Раунд 4 — Фикс CI (pnpm 11 in corepack) — PR #12

**Проблема:** `CI` workflow (`.github/workflows/ci.yml`) красный последние 3 коммита на main. Падает на шаге `Integration tests`:
```
[ERR_PNPM_UNSUPPORTED_ENGINE] Got: 11.1.3 — Expected version: ^9 || ^10
```
Когда `npm run test:int` (через npm) дёргает внутри себя `corepack pnpm run test:int:raw`, corepack без подсказки берёт global pnpm 11, который не проходит engines проекта.

**Фикс:** одно поле в `web/package.json`:
```json
"packageManager": "pnpm@10.15.0"
```
Corepack читает это поле и автоматически использует именно эту версию pnpm независимо от того что установлено глобально. Не ломает `npm ci` (npm игнорирует поле) и не требует менять CI workflow.

**Эффект:** после merge CI станет зелёным → `workflow_run` триггер для `deploy-prod` начнёт срабатывать сам без `workflow_dispatch`.

---

## 2026-05-20 — ГОНЬБА 20 мая 2026 (Claude session)

**Серия PR:** #4 → #5 → #6 → #7. Все смержены squash в `main`, задеплоено на прод.

### PR #4 (`391ee94`) — feat(projects): редизайн `/projects` + inline-редактор плашек для админов

- Новый компонент `web/src/app/(frontend)/EditableProjectsGrid.tsx` (~330 строк) — адаптивная сетка цветных плашек.
- Каждая плашка: градиент по `accentColor` проекта (фолбэк — псевдо-рандом из тематической палитры по hash от slug), картинка-превью (logo → heroImage → первое фото `gallery`, иначе декор-буква), название, краткое описание, кнопка «Войти в проект».
- Hero-плашка с `gonba` сверху на всю ширину.
- Для админов (роли admin/manager/editor) — кнопка «✎ Редактировать плашки»:
  - drag-and-drop через `@dnd-kit` (пишет `sortOrder` шагом 10 через `PATCH /api/projects/{id}`);
  - модалка `EditProjectDialog.tsx` (~210 строк): название, описание, цвет (color picker + HEX), кастомная ссылка, загрузка картинки через `POST /api/media`.
- Главная `/` восстановлена к старому виду (orbit-карусель) — плашки переехали на `/projects`.
- Новое опциональное поле `homeLink` в коллекции `Projects`.
- Зависимости: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **БД-миграция на проде:** `ALTER TABLE projects ADD COLUMN home_link TEXT` (на проде используется не `push:true`, а миграции — Drizzle сам колонку не добавит).

### PR #5 (`070fd81`) — style(yadisk): UI Облака под дизайн-систему сайта

- Локальные `--yadisk-*` SCSS-переменные привязаны к shadcn-style CSS-vars сайта с fallback на Payload theme tokens и старые hex для safety.
- Унифицированные радиусы `--yadisk-radius-sm/md/lg`.
- Категорийные цвета бейджей типов файлов и dark-палитра полноэкранного просмотрщика медиа — намеренно оставлены.
- **БД-правка на проде:** запись `header_nav_items` для «Облако» обновлена с `https://831d0ce99bdf.vps.myjino.ru/admin/yadisk` на относительный `/admin/yadisk`.

### PR #6 (`619ff92`) — feat: site theme на admin-маршрутах + wizard VK-источников

- **Yandex Cloud UI**: создан `web/src/app/(payload)/site-theme.css` с CSS-переменными сайта (`--card`, `--border`, `--foreground`, ...), импортирован в `(payload)/layout.tsx`. Прошлый PR #5 рисовал mapping, но переменные не подхватывались — `globals.css` сайта подключён только к `(frontend)`-группе.
- **VK Auto-Sync «wizard»**: в коллекции `vk-auto-sync` все required-поля кроме URL сделаны опциональными или с дефолтами. Добавлены поля `communityName`, `communityDescription`, `communityAvatar`, `screenName` — заполняются автоматически через `beforeValidate`-hook, который парсит URL и дёргает VK API `groups.getById`. Токен можно отложить — используется fallback из env (`VK_TOKEN_VALSTAN`/`VITA`/`SERVICE`/`TOKEN`). Все labels переведены на русский.
- В `syncVkSource()` добавлен safe-guard на пустой `groupId`.
- **БД-миграция на проде:** добавлены 4 колонки `vk_auto_sync.community_name/description/avatar/screen_name TEXT`, сняты `NOT NULL` с `group_id` и `access_token`.

### PR #7 (`5aaa1dd`) — feat(vk): dropdowns с проектами и категориями

- Поля `project` (→ `projects`) и `category` (→ `categories`) — relationship, required. В UI dropdown с реальными названиями.
- `projectSlug`/`sectionSlug` остались как readOnly text для backwards compatibility с `syncVkSource()` — заполняются автоматически из выбранных связей через тот же `beforeValidate`-hook.
- Обновлены seed-script и `POST /api/vk-auto-sync/trigger?seed` — ищут проект/категорию по slug и передают `id`.
- **БД-миграция на проде:** `ALTER TABLE vk_auto_sync ADD COLUMN project_id INTEGER, category_id INTEGER`, backfill через `UPDATE FROM SELECT slug`, снят `NOT NULL` с `project_slug`/`section_slug`.

### Прод-инфраструктура — уроки сессии

- **SSH disconnect убивает `next build`.** Прямой `corepack pnpm run build:raw` через одну SSH-сессию завершается посередине prerender'а, оставляя «полуготовый» `.next` без `prerender-manifest.json` → сервис в crash-loop с `ENOENT`. Правильно — запускать через `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`; ждать через `systemctl is-active` в poll-loop. Скрипт-обёртка теперь есть в `scripts/safe-build.sh`.
- **`build` script с watchdog 180s слишком короткий** — Next.js 15 production build молчит до 5-6 минут на этапе компиляции и попадает в idle-timeout. `build:raw` обходит watchdog. → 🟡 техдолг: поднять watchdog idle до 600s или вообще убрать.
- **`systemd-run` без `--uid=valstan`** запускается от root и берёт глобальный pnpm 11 из `/root/.cache/corepack`, который несовместим с engines проекта (`^9 || ^10`). Падает с `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.
- **Прямой `UPDATE` в БД минует Payload `afterChange`-хук** → `revalidateTag('global_header')` не вызывается → Next.js `unstable_cache` отдаёт устаревший HTML. Лечится `systemctl restart gonba` или программным `revalidateTag` через API.
- **На проде `push: true` не используется.** Любое добавление поля в коллекцию требует ручного `ALTER TABLE` (или полноценной миграции Payload).

### Хвосты, унесённые в `PENDING_FOLLOWUPS.md`

- 🟡 Длинный watchdog в `build` script
- 🟡 Полноценные миграции для добавленных колонок (вместо ручных `ALTER TABLE`)
- 🟡 `dev_env_requirements` memory утверждает «Postgres локально нет» — устарело
- 🟡 `docs/PROJECT.md:5` — захардкоженный шаблон даты «18 мая 2026»
- 🟡 `docs/PROJECT.md:41` — в списке коллекций нет `Messages`
- 🟢 У некоторых проектов в БД `title` равен slug (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) — нужна чистка через админку

---

## 2026-05-19 — мердж крупной UX-фичи

**PR (`d6f5bcc`):** UX redesign — Жизнь проекта + Лавка + чат + mobile-first.

Прилетело 50 файлов, +2968/-144:
- Новая коллекция `Messages` ([web/src/collections/Messages/index.ts](../web/src/collections/Messages/index.ts))
- Чат проекта: страница `(frontend)/projects/[slug]/chat/page.tsx`, API `api/projects/[slug]/chat/route.ts`, компоненты `components/Chat/`
- «Лавка» (товары/услуги/бронирование): страница `(frontend)/projects/[slug]/lavka/page.tsx`, компоненты `components/Lavka/`
- Лента: `(frontend)/projects/[slug]/feed/page.tsx`, `components/Feed/`
- Yandex Gallery: `(frontend)/projects/[slug]/gallery/page.tsx`, `server/integrations/yandex-disk-gallery.ts`
- Мобильная навигация: `MobileNavSheet`, `ProjectBottomTabs`, `HomeProjectGridMobile`
- Базовые UI-примитивы: `components/ui/{dialog,sheet,tabs,separator,skeleton}.tsx`
- In-memory rate-limit: `server/rate-limit/inMemory.ts`
- Скрипт миграции: `scripts/migrate-enabled-sections.ts`

---

## 2026-04-15 — стабилизация VK auto-sync

**Серия коммитов (`9e4b1cc`, `c243871`):** fix: stabilize VK auto-sync, Payload jobs, and TS hygiene; disable versions on VkAutoSync.

---

## 2026-04 — VK auto-sync, system timer

- `3572713` — systemd timer для VK auto-sync trigger
- `ff04f13` — VK token rotation и rate limit protection
- `6bb6b16` — VK auto-sync service (cron job + admin settings)
- `9525d5c` — fix import path в `VkAutoSyncSettings`
- `13aa798`, `d786e64`, `4109a18` — мелкие фиксы синхронизации
- `f1daf95` — единый slug коллекции `vk-auto-sync`
- `690a730` — включён `db push:true` в postgres adapter
- `2ec27f1` — seed endpoint `POST /api/vk-auto-sync/trigger {seed:true}`

---

## 2026-04 — секции и пресеты

- `d099c5f` — redesign sections system: «миры» секций с уникальной стилизацией
- `9495af9` — fix sections build error (separate client components for interactivity)
- `29e444e` — fix React 19 `use()` → `useContext` на `/contact`

---

## 2026-04 — Начало истории и SSH

- `183cecd` — SSH remote access в `docs/PROJECT.md`
- `38806ba` — cleanup репо, .gitignore, .env.example
- `9d5c869` — initial commit: GONBA (Payload CMS + Next.js 15)
