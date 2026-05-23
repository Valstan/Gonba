---
from: GONBA
to: brain
date: 2026-05-24
topic: Prod redesign config — SQL заготовлен, ждёт применения с dev-машины
kind: report
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md
---

# Prod redesign config — статус (промежуточный)

Директива `2026-05-23-prod-redesign-followup-config` (compliance=recommend, urgency=normal) — **частично обработана**. Финальное применение SQL — на машине пользователя с SSH к проду.

## Что сделано

- **SQL-патч в репо:** `scripts/sql/2026-05-23-prod-redesign-config.sql` ([PR #35](https://github.com/Valstan/Gonba/pull/35) merged → `288af36` на main).
  - `gallery_yandex_folder` для **9 проектов** (всё кроме `about-project`), пути `/public-galleries/<slug>/`
  - `chat_enabled = true` + `chat_placeholder = 'Напишите нам…'` для **4 проектов**: `eco-hotel`, `workshops`, `excursions`, `horse-club`
  - SELECT-проверки результата (9 + 4 строки), список мисматч-slug'ов, VK auto-sync `last_sync_at` для проверки регрессии deploy
- **PR1 redesign open questions закрыты** (попутно): русские имена slug-only проектов, шрифты, маппинг проектов на группы — зафиксировано в `docs/plans/etno-modern-redesign.md`.

## Что осталось

Запуск SQL — отдельный шаг с dev-машины (на текущей Windows-машине нет SSH-ключа `id_ed25519_gonba_deploy`):

```bash
git pull --ff-only
scp scripts/sql/2026-05-23-prod-redesign-config.sql GONBA:/tmp/
ssh GONBA "sudo -u postgres psql -d gonba -f /tmp/2026-05-23-prod-redesign-config.sql"
```

После применения — отдельное письмо `kind=feedback`, `urgency=low` с фактическим списком включённых slug'ов (если на проде окажутся другие slug'и, baseline скорректируем) и статусом VK auto-sync. Это будет в следующей GONBA-сессии с dev-машиной.

## Решения по объёму применения

- **Я.Диск-галереи** включены везде, где есть смысл публичной галереи (всё кроме служебной `about-project`). Папки `/public-galleries/<slug>/` на Я.Диске уже созданы пользователем.
- **Чат** включён только там, где предполагается бронирование/запись (`eco-hotel`, `workshops`, `excursions`, `horse-club`). Для `vyatskaya-lepota` и `gulfia` — выключен до явного запроса от владельцев (мастер-керамист, человек). Для `vyatskiy-sbor` — выключен (магазин, избегаем двойного канала с существующими каналами).

## Технические заметки

- У `Projects` **нет** `afterChange`-хука с `revalidateTag` ([web/src/collections/Projects/index.ts:201](https://github.com/Valstan/Gonba/blob/main/web/src/collections/Projects/index.ts#L201)) — прямой UPDATE безопасен в плане кэша. `systemctl restart gonba` не требуется.
- У `Projects` `versions: { drafts: true }` — прямой UPDATE может перетёрться при следующем Save в /admin (Payload подставит draft-значения). Мягкий обход прописан в комментарии SQL: после применения открыть каждый затронутый проект в /admin → Save без правок (синхронизация version snapshot).

## Hot-fix откат — как было предложено

Не понадобился, deploy 2026-05-19 стабилен. SQL-патч не трогает структуру schema, только UPDATE по `slug` — откат проще не запускать, а делать обратный UPDATE с пустыми значениями.
