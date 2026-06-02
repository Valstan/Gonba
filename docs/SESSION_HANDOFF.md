# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-06-02
**Branch:** main
**Last released version:** PR #83 (commit `21b8044`) — security-hardening write-доступа к контенту. Прод: health 200 после деплоя.

---

## Текущая нитка

**On-site редактирование контента/интерфейса прямо на сайте** (план [`docs/plans/inline-onsite-editing.md`](plans/inline-onsite-editing.md)). **Основные части закрыты и на проде:** вход в шапке, правка постов, плашек проектов, текст+картинки страниц, меню шапки, футер (глобал + inline), страницы проектов (заголовок/описание/обложка/текст). Остались мелкие follow-up'ы.

В этой сессии (2026-06-02) — **отдельный security-проход** (#83, вне inline-нитки): сузил over-permissive `access: authenticated` на write-операциях `Posts`/`Pages`/`Media`/`Categories` до `adminOrEditor` + убрал `manager` из клиентского `EDITOR_ROLES`. Подробности — `PENDING_FOLLOWUPS.md` (✅-запись сверху техдолгов).

## Следующий шаг

Выбрать один из мелких follow-up'ов inline-нитки (все без блокеров):

1. **Картинки страниц — caption + добавление/удаление** элементов массивов в `PageEditor` (сейчас только замена media id; поля required). Без миграции. Файлы: `web/src/components/InlineEdit/PageEditor.client.tsx` + `InlineImage.client.tsx`.
2. **Inline-правка остальных блоков project-detail** — галерея/контакты/локация (`web/src/app/(frontend)/projects/[slug]/page.tsx`, пока правятся в админке).
3. **Чистка устаревшего `footer.navItems`** — отдельной аддитивной-down миграцией `DROP TABLE footer_nav_items/footer_rels` + убрать скрытое поле из `web/src/Footer/config.ts`. Только когда понадобится; сейчас скрыто (`admin.hidden`) и безвредно.

Прочие открытые направления (не inline) — VK source #5 (личная страница, нужен `users.get`), Media-library Phase C/D. См. `PENDING_FOLLOWUPS.md`.

## Контекст

- **Планы:** [`inline-onsite-editing.md`](plans/inline-onsite-editing.md), [`media-library-integrity.md`](plans/media-library-integrity.md) (Phase A/B done, C/D — todo).
- **Связанные коммиты сессии (2026-06-02):**
  - `21b8044` (#83) — security: `Posts`/`Pages`/`Media`/`Categories` write-доступ `authenticated` → `adminOrEditor`; `manager` убран из клиентского `EDITOR_ROLES` (`web/src/utilities/me.ts`). Без миграций (только логика access). typecheck+lint чистые.
- **Ролевая модель (зафиксирована с владельцем 2026-06-02):** контент-редакторы = `admin`/`editor` (весь write на сайте). `manager` = инфра-роль (Я.Диск `/admin/yadisk`, VK-импорт-очередь через `requireAdmin` = admin‖manager), **не** контент-редактор — на публичном сайте inline-инструменты ему не показываются. Серверные `payload.create` (VK-sync, yadisk, home-carousel) идут через Local API `overrideAccess:true` — access-функции на них не действуют.
- **Прод:** ✅ на `21b8044`, деплой через `deploy-prod.yml` (workflow_run на CI). Миграций #83 не требовал.
- **Локальный dev на этой машине:** PostgreSQL 17 на **:5433** (не 5432), БД `gonba` есть; `web/.env` → `DATABASE_URL=...@127.0.0.1:5433/gonba` (пароль из `%APPDATA%\postgresql\pgpass.conf`). Payload грузится нормально. См. memory `dev_env_requirements`.
- **Открытые вопросы для пользователя:** опц. прод-cleanup inline домен-vars в `gonba.service` (см. PENDING).

## Failed approaches (этой нитки)

_Не было — security-проход #83 сработал с первого захода (ролевая модель уточнена через вопрос владельцу, typecheck/lint зелёные, merge чистый)._ Прошлые failed approaches inline-нитки (mode-гейт inline-редакторов; полный Lexical на публичных страницах) остаются актуальны — **не повторять**, см. `git log -- docs/SESSION_HANDOFF.md` (#78).

## Не забыть (low-priority)

- 🔸 Опц. прод-cleanup: убрать дублирующие inline `Environment=` домен-vars из `/etc/systemd/system/gonba.service` (команда в `docs/PROJECT.md → Systemd`).
- 🔸 Локальная БД (:5433) отстаёт от прода на миграцию `20260601_120000` (`_projects_v` data-fix) — push:true покрывает колонки, для smoke не критично.
- 🔸 `authenticated`-хелпер (`web/src/access/authenticated.ts`) теперь нигде не импортируется (после #83) — оставлен как идиоматичный Payload-хелпер; удалить, если решим чистить мёртвый код.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
