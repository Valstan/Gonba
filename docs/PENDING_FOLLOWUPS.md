# Pending follow-ups

Открытые задачи, техдолги и идеи. Свежие сверху.

**Приоритеты:**
- 🔴 **блокер** — прод сломан / нельзя двигаться дальше / безопасность
- ⏳ **в процессе** — начато, не дозавершено
- 🟡 **техдолг** — работает, но «костыль» / непрозрачно / повторение боли
- 🟢 **идея** — улучшение качества жизни, не критично

При закрытии — переноси запись в `DEVELOPMENT_LOG.md` (в текущий день).

---

## 🔴 Блокеры

_Сейчас нет._

---

## ⏳ В процессе

_Сейчас нет — все начатые задачи в текущей сессии задеплоены и подтверждены._

---

## 🟡 Техдолги

### Build / Deploy

- **`web/package.json` script `build` использует `run-with-watchdog --idle-ms=180000`** — это слишком короткий timeout для Next.js 15 production build (он молчит до 5-6 минут на этапе компиляции и попадает в idle-kill). Workaround: использовать `build:raw` напрямую через `scripts/safe-build.sh`. Постоянное решение — поднять `idle-ms` до 600000 или вообще убрать watchdog.
- **Прямой `ALTER TABLE` на проде вместо миграций.** Сегодня вручную добавлены 7 колонок: `projects.home_link`, `vk_auto_sync.community_name/description/avatar/screen_name`, `vk_auto_sync.project_id`, `vk_auto_sync.category_id`. Эти изменения не закоммичены как Payload migrations — при поднятии нового окружения с нуля схема НЕ применится. Нужно сгенерить proper миграции через `pnpm payload migrate:create` и закоммитить в `web/src/migrations/`. (На текущем единственном проде проблема не видна, но для будущих окружений критично.)
- **Direct UPDATE/INSERT в БД минует Payload `afterChange`-хуки.** В частности `revalidateTag('global_header')` не вызывается. Лечится `systemctl restart gonba`, но «знание» нигде не задокументировано в коде. Стоит добавить wrapper-скрипт или хотя бы заметку в `CLAUDE.md`.

### Конфиг / окружение

- **`web/.env` шаблон в `web/.env.example`** содержит `DATABASE_URL=postgresql://127.0.0.1:5432/gonba` без user/password. На локальной Windows-машине это не работает без `postgres:postgres@` префикса. → Обновить пример.
- **`docs/PROJECT.md:5`** содержит захардкоженный шаблон даты сессии `«ГОНЬБА 18 мая 2026»`. Это явно устарело и не самообновляется. → Либо убрать конкретную дату, либо превратить в инструкцию «подставьте сегодняшнюю».
- **`docs/PROJECT.md:41`** в списке коллекций нет `Messages` (добавлена в мердже от 2026-05-19).
- **`docs/PROJECT.md:176`** — память [[prod_server_access]] упоминала `~/.ssh/id_rsa`, теперь актуальный ключ `id_ed25519`. Memory обновлять или не использовать вовсе.

### Documentation drift

- **Memory `dev_env_requirements`** утверждает «на локалке нет Postgres» — устарело: на машине Valstan установлен PostgreSQL 16 (`postgresql-x64-16`, port 5432, user `postgres`/`postgres`, БД `gonba`). Обновить memory.
- **`docs/RELEASE_STABILITY_CHECKLIST.md`** упоминает `npm install && npm run build`. После уроков сегодняшней сессии deploy-flow стал сложнее (`systemd-run --uid=valstan`, нельзя через прямой SSH). Стоит обновить или сослаться на `/reliz` команду.

### Данные в БД

- У некоторых проектов поле `title` равно slug: `eco-hotel-booking`, `about-project`, `vyatskiy-sbor`. Должно быть человеческое название. → Чистка через админку `/admin/collections/projects`.

---

## 🟢 Идеи

### Удобство разработки

- **Hook на `git commit`**, который автоматически напоминает обновить `DEVELOPMENT_LOG.md` если коммит — `feat`/`fix`/`refactor`. Реализуется через `.husky/` или `.git/hooks/prepare-commit-msg`.
- **Команда `/check`** — одной кнопкой `health-check`: dev local up? Prod /api/health? Git состояние? TypeScript? Lint? (Сделано — см. `.claude/commands/check.md`.)
- **Команда `/sql`** для безопасного выполнения SQL на проде через SSH с диалогом-подтверждением (учитывая что Auto-mode classifier режет direct ALTER без warning). (Сделано — см. `.claude/commands/sql.md`.)
- **Скрипт `scripts/dev-doctor.sh`** проверяет:
  - Postgres up + БД `gonba` существует
  - `web/.env` существует
  - `web/node_modules` существует
  - `payload-types.ts` свежее изменений в коллекциях
  - `importMap.js` свежее изменений в admin-компонентах
  - SSH key existence + ssh-config alias `GONBA`
- **ADR (Architectural Decision Records)** в `docs/adr/` для важных решений (почему orbit + grid; почему push:true в dev и migrations на проде; почему prefer relationship + slug-mirror vs pure relationship; почему Yandex.Disk вместо S3).
- **Smoke tests E2E через Playwright** для критичных user flow:
  - Открытие главной → видна orbit-карусель
  - Открытие /projects → видна сетка плашек
  - Логин в /admin → доступ к /admin/yadisk
  - Создание VK-источника только по URL → подтянулись метаданные
- **CI deploy step**: автоматический deploy на прод после merge в `main` через GitHub Action, который SSH'ит на сервер и запускает `scripts/safe-deploy.sh`. Сейчас deploy ручной — каждый раз я повторяю одну и ту же последовательность.

### Продукт

- **Auto-fill `title` из `shortLabel`** в `Projects` коллекции, чтобы не получалось `title === slug` для новых проектов.
- **На `/projects` админский режим показывать предпросмотр изменений** перед сохранением (live preview).
- **Yandex Disk UI**: после миграции на site-vars (PR #6) может остаться визуальный mismatch. Стоит пройтись по `index.scss` второй раз с реальными скриншотами после Ctrl+F5.
- **VK auto-sync «как опрос»**: после первого сохранения с URL — открыть пошаговую модалку «Выбери проект → Категорию → Токен (можно позже)». Сейчас это просто форма с подсказками — функционально, но не «опрос».

---

## История пересечений

Если задача висела долго и пересекалась с несколькими сессиями — пиши тут историю переноса дат, чтобы было видно, что она «застряла».

_Сейчас пусто._
