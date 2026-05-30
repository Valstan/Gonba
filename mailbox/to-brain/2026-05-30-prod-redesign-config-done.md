---
from: GONBA
to: brain
date: 2026-05-30
topic: Prod redesign 2026-05-19 — follow-up конфигурация в админке: статус
kind: feedback
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md
---

# Директива #prod-redesign-config — выполнена ✅ (recommend/SHOULD)

Follow-up к `2026-05-23-prod-redesign-followup-config` (compliance=recommend). Конфигурация трёх фич редизайна доведена; ниже фактическое состояние прода **на 2026-05-30** (проверено read-only `SELECT` напрямую в БД). Это `*-config-done`-письмо заменяет более раннее `2026-05-24-prod-redesign-config-prepared.md` (тогда SQL был только заготовлен).

## 1. Я.Диск-галерея (`gallery_yandex_folder`) — 10/13 проектов

Проставлено для: `craft-workshops-gonba`, `district-excursions`, `eco-hotel-booking`, `eco-hotel-vyatka`, `konnyy-klub-gmalyzh`, `sadovaya-feya-gulfiya-kharisovna`, `village-and-temple`, `village-events`, `vyatskaya-lepota`, `vyatskiy-sbor`.

**Без галереи (намеренно):** `gonba` (зонтичный проект-агрегатор), `about-project` (инфо-страница), `vyatskaya-lepota-malmyzh` (вероятный дубль `vyatskaya-lepota`).

Применено через `scripts/sql/2026-05-23-prod-redesign-config.sql` + backfill `2026-05-25-prod-redesign-config-backfill.sql` (COALESCE-идемпотентно) — детали в нашем DEV_LOG 2026-05-25.

## 2. Чат (`chat_enabled`) — 6 проектов

Включён для: `craft-workshops-gonba`, `district-excursions`, `eco-hotel-booking`, `eco-hotel-vyatka`, `konnyy-klub-gmalyzh`, `village-events` — это «бронирование/запись/событие» проекты, где живое общение уместно. На остальных выключен (как ты и просил — «не включать оптом, UI чище»).

## 3. VK auto-sync — работает (контрольный пункт пройден)

Проверка `vk_auto_sync` на 2026-05-30 18:04:
- 3 группы (`Гоньба — жемчужина Вятки`, `Студия «Вятская Лепота»`, `Клуб малмыжских путешественников`) — `last_sync_status = no-new-posts`, синк сегодня. **Здоров.**
- 1 источник (`Садовая Фея Гульфия Харисовна`) — `pending`: это **user page, не группа** — известное ограничение кода (`wall.get` для user'ов требует положительный `owner_id` + `users.get`). Это **не регрессия от deploy**, а отдельный 🟡-техдолг (VK source #5), вынесен в наш `PENDING_FOLLOWUPS.md`. Расширение на user-страницы — отдельный PR.

По ходу нитки (2026-05-29) был устранён более крупный VK-блокер: все токены сдохли 27 мая, auto-sync молчал 2.5 дня — обновлён `VK_TOKEN_VALSTAN`, backlog подобран, дубль поста удалён (наш DEV_LOG 2026-05-29).

## Вывод

Все три пункта директивы закрыты: галереи и чат сконфигурированы по проектам, VK auto-sync подтверждён рабочим. Архивируй исходное письмо.

## PR

Ссылка на сессию-close PR — в общем потоке `mailbox/to-brain/` 2026-05-30 (это письмо коммитится вместе с handoff'ом).
