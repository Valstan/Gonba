# План: inline-редактирование контента и интерфейса прямо на сайте

> Статус: в работе с 2026-06-01. Этап 1 = PR1 (вход) + PR2 (правка постов), деплоятся батчем.
> Источник правды по прогрессу — `docs/PENDING_FOLLOWUPS.md` + git log + тела PR (ADR-0007).

## Context

Владелец хочет править сайт «на ходу», не заходя в `/admin`: постоянная кнопка входа вверху → авторизовался → на публичных страницах появляются элементы управления → можно поправить текст поста, заменить/добавить/удалить картинки, отредактировать пункты меню и футер, и сразу сохранить.

**Вывод разведки 2026-06-01: ~70% инфраструктуры уже есть** — обобщаем, а не пишем заново:
- `AdminModeProvider` (`web/src/providers/AdminMode/index.tsx`) — контекст `isAdmin` + режим `view`/`manage` (localStorage). Смонтирован в `(frontend)/layout.tsx` через `Providers`.
- `AdminBar` (`web/src/components/AdminBar/index.tsx`) — верхняя панель; показывается когда уже залогинен; переключатель Просмотр/Управление, logout, quick-actions.
- `AdminOverlay`/`AdminManageActions` (`web/src/components/AdminOverlay/index.tsx`) — в режиме `manage` рисует на наведении кнопку «Редактировать», сейчас ведёт в `/admin`.
- `EditableProjectsGrid` + `EditProjectDialog` (`web/src/app/(frontend)/`) — **эталон inline-редактирования**: детект админа `GET /api/users/me`, загрузка `POST /api/media`, сохранение `PATCH /api/projects/{id}` (`credentials:'include'`), live-preview, ошибки.
- `richTextFromText` в `web/src/server/integrations/vk-auto-sync.ts` — референс shape Lexical.

**Решения владельца:** (1) вход — inline-модалка (`POST /api/users/login`); (2) тело текста — **лёгкий** редактор (абзацы/жирный/курсив/списки/ссылки) → Lexical; (3) объём — посты + страницы + интерфейс.

**Узкие места:** меню в `Header/Component.client.tsx` захардкожено (игнорит глобал `header`); футер (`Footer/Component.tsx`) захардкожен, глобала нет. Интерфейс — самый тяжёлый кусок, идёт последним.

## PR1 — Фундамент: постоянный вход + manage-режим
- `web/src/utilities/me.ts` — shared `fetchMe`/`isAdminUser`/`loginUser`/`logoutUser` (убрали дубль из EditableProjectsGrid).
- `web/src/components/Auth/LoginControl.client.tsx` — кнопка в шапке (Войти/Выйти) + модалка email+пароль; на успехе `setIsAdmin(true)` + `setMode('manage')`.
- Интеграция в `Header/Component.client.tsx` (кластер `.ethno-header__actions`), стиль `.ethno-auth-btn` в globals.css.

## PR2 — Inline-правка постов
- `web/src/components/InlineEdit/`: `InlineImage` (replace/remove → POST /api/media), `LiteRichTextEditor` (contentEditable + тулбар → Lexical), `SaveBar`.
- Обернуть зоны на странице поста; `PATCH /api/posts/{id}` c `_status:'published'` (drafts!).
- Риск №1 — round-trip Lexical↔editable; MVP-набор узлов, неизвестное рендерим как есть.

## PR3 — Inline-правка страниц (Pages)
- Тот же паттерн; простые блоки (Content/MediaBlock) inline, сложные — в админку. `PATCH /api/pages/{id}`.

## PR4 — Inline-правка интерфейса (меню + футер)
- Расширить `header` global + расхардкодить `Header/Component.client.tsx` + seed.
- Создать `footer` global + hook + расхардкодить `Footer/Component.tsx` + seed.
- Правка через `POST /api/globals/*` → `revalidateTag`.

## Сквозное
- Доступ: `Posts/Pages.access.update = authenticated`; рассмотреть сужение до `adminOrEditor`.
- Переиспользуем: AdminMode, AdminBar, AdminOverlay, EditProjectDialog, POST /api/media + /api/media/file/[id] (Я.Диск), revalidateHeader, richTextFromText, shadcn Dialog.
- Деплой — через `/reliz`; verify на проде (локальная dev-БД на этой машине нестабильна).
