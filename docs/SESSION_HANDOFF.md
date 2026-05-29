# Session Handoff

**Status:** IDLE
**Updated:** 2026-05-29
**Branch:** main
**Last released version:** PR #50 (commit `874e257`) на проде; VK auto-sync восстановлен 2026-05-29 (прод-ops: токен + dedup, без релиза кода)

---

## Состояние

**Свободно — активной нитки нет.** Handoff-нитка «verify VK source #3» **закрыта** 2026-05-29:

- ✅ Slug-фикс PR [#50](https://github.com/Valstan/Gonba/pull/50) DB-подтверждён рабочим (источник #3 импортирует, `success`).
- ✅ Попутно устранён токен-блокер (VK-токены сдохли с 27 мая) — свежий `VK_TOKEN_VALSTAN` в prod `.env`, все 3 источника `success`.
- ✅ Дубль поста 414 (id 154) удалён.
- ✅ SSH-доступ к проду с Windows-машины настроен (выделенный `id_ed25519_gonba_deploy`).

Подробности — `docs/DEVELOPMENT_LOG.md` блок 2026-05-29.

## Кандидаты на следующую нитку (из PENDING_FOLLOWUPS)

- ⚠️ **Директива brain #008** — секреты из `web/.env` в `/etc/gonba/gonba.env` (`compliance=recommend`, SHOULD; нужно применить или обосновать). Хорошее «окно между нитками».
- 🟡 **Мониторинг протухания VK-токенов** (молча не работало 2.5 дня).
- 🟡 **VK source #5 (Гульфия)** — поддержка user-page (отдельный PR).
- 🟢 **PR4 этно-модерн** — финал главной (PeopleSection + CraftsSection + ShopBanner + EventsList, `docs/plans/etno-modern-redesign.md` §3 PR4).
- 🟢 Дедуп VK по `(ownerId, postId)`; очистка `last_error` при success.

## Контекст

- **Прод:** ✅ `/api/health` 200. VK auto-sync работает (timer каждые 3ч).
- **Открытые вопросы для пользователя:** 0.
- **Открытые PR:** docs-PR этой сессии (обновление DEV_LOG/PENDING/PROJECT/handoff).

---

> Sticky note — что было следующим шагом. Перезаписывается через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.
