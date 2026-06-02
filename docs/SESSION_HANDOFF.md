# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-06-01
**Branch:** main
**Last released version:** PR #77 (commit `f6d0780`) на проде — inline-правка страниц. Прод verified: health 200 на каждом деплое сессии.

---

## Текущая нитка

**On-site редактирование контента/интерфейса прямо на сайте** (план [`docs/plans/inline-onsite-editing.md`](plans/inline-onsite-editing.md)). Этап 1 **полностью на проде**: вход через модалку в шапке → у редактора появляются элементы управления → правка постов, страниц, плашек проектов и пунктов меню на месте + выбор существующей картинки + дедуп при загрузке. Остался футер (нужна миграция БД) и картинки в блоках/hero.

## Следующий шаг

**Футер (PR4b) — на домашней машине с рабочей локальной БД.** Код-паттерн готов (как у меню: глобал + расхардкодить `web/src/Footer/Component.tsx` + inline-редактор), но нужен **новый глобал `footer` + миграция** (вложенные массивы) — её безопаснее сгенерировать через Payload-тулинг на машине, где локальный Postgres жив (на текущей Windows-машине Payload падает с `spawn UNKNOWN`). Шаги: `web/src/Footer/config.ts` + hook `revalidateFooter` + регистрация в `payload.config.ts` → `payload migrate:create` → расхардкодить Footer (читать глобал, fallback на текущие значения) → `FooterEditor.client.tsx` → применить миграцию на проде вручную (как `_projects_v` fix) + `/reliz`.

Параллельно (без миграции, можно и тут): **картинки на страницах** (MediaBlock `items[].media` + hero) inline в `PageEditor` (брать layout через `?depth=0`, менять media id, PATCH); **медиа Phase C/D** — связи (usage) + безопасное удаление с заменой + слияние старых дублей (план `docs/plans/media-library-integrity.md`).

## Контекст

- **Планы:** [`inline-onsite-editing.md`](plans/inline-onsite-editing.md) (4 PR), [`media-library-integrity.md`](plans/media-library-integrity.md) (Phase A/B done, C/D — todo).
- **Связанные коммиты сессии:**
  - `f6d0780` (#77) — inline-правка страниц: заголовок + текст Content-блоков, depth=0 round-trip
  - `8bf0bfc` (#76) — дедуп при загрузке по sha256 (Phase B)
  - `c01817a` (#75) — редактируемое меню шапки (рендер из глобала + NavEditor)
  - `0098a6a` (#74) — inline-редактор поста виден сразу при логине (без режима «Управление»)
  - `b31b0da` (#73) — deploy-guard миграций: bypass при workflow_dispatch
  - `8e37308` (#72) — fix схемы `_projects_v` (500 при сохранении проекта) + MediaPicker + посты без редиректа в /admin
  - `80778cb` (#71) — этап 1: вход в шапке + inline-правка постов
  - (ранее: #68 orbit reduced-motion, #69 systemd sync, #70 VK_SYNC_ALERT)
- **Прод:** ✅ health 200, на `f6d0780`. Миграция `20260601_120000` (`_projects_v`) применена вручную + записана в `payload_migrations` (batch 5).
- **Ключевые файлы:** `web/src/components/InlineEdit/` (PostEditor, PageEditor, InlineImage, MediaPicker, LiteRichTextEditor, lexical-lite), `web/src/components/Auth/LoginControl.client.tsx`, `web/src/utilities/me.ts` + `mediaUpload.ts`, `web/src/Header/NavEditor.client.tsx`.
- **Открытые вопросы для пользователя:** опц. прод-cleanup inline домен-vars в `gonba.service` (см. PENDING / `docs/PROJECT.md`).

## Failed approaches (этой нитки)

- **Гейтить inline-редакторы за режимом «Управление» (manage mode)** — пробовали в PostEditor (#71), плохо: по умолчанию режим «Просмотр», при логине через `/admin` кнопки правки не появлялись. Исправлено в #74 — показываем при `isAdmin`. **Не возвращать mode-гейт** для inline-правки.
- **Полный Lexical на публичных страницах** — отклонён на планировании (тяжёлый бандл). Выбран лёгкий contentEditable→Lexical (`lexical-lite.ts`) + fallback «сложное — в админке». Round-trip держать на наборе: абзацы/H2-H3/жирный/курсив/списки/ссылки.

## Не забыть (low-priority)

- 🔸 Опц. прод-cleanup: убрать дублирующие inline `Environment=` домен-vars из `/etc/systemd/system/gonba.service` (команда в `docs/PROJECT.md → Systemd`).
- 🔸 Сузить `Posts/Pages.access.update` до `adminOrEditor` (сейчас `authenticated`) — для согласованности; не блокер.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`.
