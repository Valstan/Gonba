# Session Handoff

**Status:** IDLE
**Updated:** 2026-05-25
**Branch:** main
**Last released version:** —

---

## Текущая нитка

Нет активной нитки. Сессия 2026-05-25 закрыла **3 фазы этно-модерн редизайна (PR1+PR2+PR3) + 2 SQL заливки + миграцию БД** за один день — 6 PR'ов, прод обновлён, главная теперь полностью на этно-модерн (Hero / 4 GroupCards / Featured Chapter I / Quote Радищева).

## Следующий шаг

Свободное состояние. Возможные стартовые точки (по приоритетам):

1. **PR4 — добить главную: PeopleSection + CraftsSection + ShopBanner + EventsList** (план `docs/plans/etno-modern-redesign.md` §3, PR4). Это финальные секции главной (главы II/III/IV/V после Featured). После PR4 главная будет 100% соответствовать handoff-bundle'у.
2. **VK source #3 (Студия Вятская Лепота) error fix** — `last_error: "Следующее поле недействительно: slug"` блокирует все импорты. Нужен fallback `vk-<source>-<post>` в `web/src/server/integrations/vk-auto-sync.ts`. Быстрая задача, разблокирует 0→N импортов.
3. **VK source #5 (Гульфия) — group_id NULL** — добавить токен через админку, либо вручную проставить group_id.
4. **Восстановить локальную БД** — PG16→PG17 миграция на dev-машине (`web/.env` шаблон не работает). Опции в `PENDING_FOLLOWUPS.md → Windows dev-setup`.
5. **Удалить дубль проекта `vyatskaya-lepota-malmyzh`** — раскопать в админке какой из (`vyatskaya-lepota`, `vyatskaya-lepota-malmyzh`) актуальный. Аналогично `eco-hotel-booking` vs `eco-hotel-vyatka`.

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md). PR1+PR2+PR3 закрыты. Открыт PR4.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md) — `Implemented` (частично — после PR4 будет finalized).
- **Связанные коммиты сессии 2026-05-25:**
  - `19c5a78` (#48) — SQL backfill 10 непокрытых проектов + VK errors в PENDING_FOLLOWUPS
  - `149c163` (#47) — PR3: Hero + GroupCards + FeaturedChapter + QuoteSection (новая главная)
  - `b41cf9b` (#46) — SQL маппинг 10 проектов на этно-группы (PR2 §4)
  - `a1d54e1` (#45) — handoff (ранний close в этой сессии, потом продолжили)
  - `5cda006` (#44) — PR2 schema Project (6 полей + миграция 20260525_080000)
  - `653e214` (#43) — PR1 §3+§4 Header rhomb + drawer + Footer 3-колонник
- **Прод:** ✅ жив, `/api/health` 200 in 0.26s, `/` показывает этно-главную (`ethno-hero`, `ethno-groups`, `ethno-featured`, `ethno-quote`), `/orbit` — старая orbit-карусель как альтернативный вид.
- **Открытые вопросы для пользователя:** 0.

## Не забыть (low-priority)

- 🟡 **VK error #3** — в `PENDING_FOLLOWUPS.md → VK auto-sync`. Block'ает импорты, но не блокер для редизайна.
- 🟡 **VK #5 без group_id** — там же.
- 🟡 **PG16→17 миграция dev-окружения** — в `PENDING_FOLLOWUPS.md → Windows dev-setup`. На этой машине локальный preview не работает с реальными данными, но прод и CI работают.
- 🟢 **Drawer-подменю Header → в Payload** (после PR4 опционально).
- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media`.
- 🟢 `vyatskaya-lepota` vs `vyatskaya-lepota-malmyzh` + `eco-hotel-booking` vs `eco-hotel-vyatka` — разобраться какой дубль удалить.
- 🧹 Переименовать `docs/plans/media-to-yadisk.md` → `media-to-yadisk-DONE.md`.
- 📊 Журнал `gonba-media-cache.timer` — глянуть когда будут силы.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
