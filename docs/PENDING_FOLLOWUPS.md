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

- **`payload migrate` интерактивный (drizzle `push:true` y/N prompt).** В сессии 2026-05-21 `pnpm payload migrate` без TTY завис на 40+ минут (молча) — судя по всему попал на drizzle push-prompt для расхождения схема ↔ коллекции. Workaround сейчас — применять миграции через прямой `psql -f web/src/migrations/<name>.sql` (зеркало) и руками `INSERT INTO payload_migrations`. Постоянное решение: либо `push: false` на dev (но тогда сломается текущий «свободный» dev-flow), либо `yes y | corepack pnpm payload migrate` обёртка-скрипт.
- **Direct UPDATE/INSERT в БД минует Payload `afterChange`-хуки.** В частности `revalidateTag('global_header')` не вызывается. Лечится `systemctl restart gonba`, но «знание» нигде не задокументировано в коде. Стоит добавить wrapper-скрипт или хотя бы заметку в `CLAUDE.md`.

### Конфиг / окружение

- **`web/.env` шаблон в `web/.env.example`** содержит `DATABASE_URL=postgresql://127.0.0.1:5432/gonba` без user/password. На локальной Windows-машине это не работает без `postgres:postgres@` префикса. → Обновить пример.

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
