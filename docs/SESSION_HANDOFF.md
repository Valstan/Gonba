# Session Handoff

**Status:** IDLE
**Updated:** 2026-05-25
**Branch:** main
**Last released version:** —

---

## Текущая нитка

Нет активной нитки. Сессия 2026-05-25 закрыла **3 пункта плана этно-модерн редизайна за один заход**:

1. **PR #43** — Header rhomb + drawer + Footer 3-колонник (PR1 §3+§4). Смержен, задеплоен. На проде уже видны новые шапка/подвал во всех маршрутах.
2. **PR #44** — schema Project под этно-модерн (PR2 §1+§2). 6 новых полей (`kind` / `homepageGroup` / `excerpt` / `chapterRoman` / `isHeroOfHomepage` / `isFeatured`) + миграция `20260525_080000`. Смержен, деплой в процессе (запустится после PR43-deploy ~7:59 UTC).
3. **SQL prod-redesign-config** — применён, 3 из 13 UPDATE'ов сработали (slug'и в БД отличаются от baseline'а). Backfill для остальных — в PENDING_FOLLOWUPS.

Нитка этно-модерн **переходит в IDLE** до следующей задачи. Следующая фаза — PR3 (новая главная: hero + group cards + featured + quote), требует визуальной приёмки и больше времени.

## Следующий шаг

Свободное состояние. Возможные стартовые точки:

1. **PR3** — переписать `/page.tsx` на этно-модерн hero + GroupCards + FeaturedChapter + QuoteSection. Перенести `HomeCarouselMenuClient` на `/orbit`. Большая визуальная задача (план `docs/plans/etno-modern-redesign.md` §3).
2. **Маппинг 10 проектов на этно-группы** — через админку или `/sql`. Заполнить `homepageGroup` / `isFeatured` / `isHeroOfHomepage` чтобы PR3 имел данные для рендера. Можно делать параллельно или внутри PR3.
3. **SQL backfill для 10 непокрытых проектов** — `gallery_yandex_folder` + `chat_enabled` (см. PENDING_FOLLOWUPS).
4. **VK auto-sync error** — Студия «Вятская Лепота» (community_id 3) в `last_sync_status = error` на 2026-05-25 03:01 UTC. Глянуть `journalctl -u gonba-vk-sync` и логи.
5. Любая новая задача от пользователя.

## Контекст

- **План:** [`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md). Готовы PR1 (§1-§4) + PR2 (§1+§2). Осталось PR2 §4-§5 (маппинг + /orbit), PR3, PR4.
- **ADR:** [`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md).
- **Связанные коммиты сессии 2026-05-25:**
  - PR #44 (5cda006) — schema Project под этно-модерн
  - PR #43 (653e214) — Header + drawer + Footer
- **Прод:** ✅ жив, `/api/health` 200 in 0.28s после deploy'я PR #43.
- **Открытые вопросы для пользователя:** 0.
- **dev-машина (2026-05-25):** на этой Windows-машине пароль Postgres из `pgpass.conf` (не `postgres:postgres` из шаблона). SSH к проду работает, deploy-ключ `id_ed25519_gonba_deploy` присутствует.

## Не забыть (low-priority)

- 🟢 **SQL prod-redesign-config частичный backfill** (10 непокрытых проектов) — см. `PENDING_FOLLOWUPS.md → Этно-модерн редизайн`.
- 🟢 **Маппинг 10 проектов на этно-группы** — после merge PR #44 деплоя.
- 🟢 **VK Студия Вятская Лепота error** — глянуть в следующей сессии.
- 🟢 3 mini-follow-up'а Media в `PENDING_FOLLOWUPS.md → Архитектура / Media`.
- 📊 Журнал `gonba-media-cache.timer` — глянуть когда будут силы.
- 🧹 Переименовать `docs/plans/media-to-yadisk.md` → `media-to-yadisk-DONE.md`.

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
