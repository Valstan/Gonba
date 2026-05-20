---
description: Безопасное выполнение SQL на прод-БД с обязательным подтверждением.
argument-hint: <SQL запрос или describe>
allowed-tools: Bash, AskUserQuestion
---

# /sql — выполнить SQL на прод-БД

**ВСЕГДА** показывает пользователю что собирается сделать, и спрашивает подтверждение через `AskUserQuestion` перед любым `INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE`.

SELECT-запросы (read-only) можно выполнять без подтверждения.

## Логика

1. Распознай тип запроса из `$ARGUMENTS`:
   - Только `SELECT`, `EXPLAIN`, `\d`, `\dt`, `SHOW` → **read-only**, выполни сразу.
   - Содержит `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE` → **mutating**, обязательно подтверждение.

2. Перед mutating-запросом:
   - Покажи **точный SQL** в блоке кода.
   - Если это `UPDATE` или `DELETE` без `WHERE` — отказ с предупреждением.
   - Если `DROP TABLE` / `TRUNCATE` — двойное подтверждение.
   - Используй `AskUserQuestion`: «Применить этот SQL на прод-БД?» с опциями:
     - «Да, применяй» — выполнить
     - «Сделай dry-run сначала» — оберни в транзакцию `BEGIN; ...; ROLLBACK;` и покажи план/счётчик изменений
     - «Отмена» — выйти

3. Выполнение:
   ```bash
   ssh -o ConnectTimeout=20 -i ~/.ssh/id_ed25519 valstan@831d0ce99bdf.vps.myjino.ru \
     'sudo -u postgres psql gonba -c "<SQL>"'
   ```
   Для многострочных — heredoc или `-f /tmp/script.sql` с предварительной заливкой через `scp`.

4. После выполнения:
   - Покажи вывод psql (`UPDATE N`, `ALTER TABLE`, и т.д.).
   - **Напомни пользователю:** если правка задевает Payload-globals (`header`, `footer`, `vkAutoSyncSettings`, `homeCarousel`) или часто-кэшируемые сущности — нужен `ssh GONBA "sudo systemctl restart gonba"`, иначе `unstable_cache` отдаст устаревший HTML.
   - Если это `ALTER TABLE ADD COLUMN` к коллекции — добавь техдолг в `docs/PENDING_FOLLOWUPS.md`: «оформить как Payload migration в `web/src/migrations/`».

## Особые случаи

- **Backfill после `ADD COLUMN`** (например `UPDATE x SET y = (SELECT ...)`) — это обычно безопасно, но всё равно показать SQL и спросить.
- **Snapshot перед изменениями** — если пользователь нервничает, предложи `pg_dump` сначала:
  ```bash
  ssh GONBA "sudo -u postgres pg_dump -Fc gonba" > prod-gonba-$(date +%Y%m%d-%H%M).dump
  ```
- **Локальная БД** — те же шаги, но через `PGPASSWORD='postgres' psql -U postgres -h 127.0.0.1 -d gonba`. Подтверждение для mutating — всё равно обязательно, чтобы вырабатывать правильную привычку.

## Шорткаты

- `/sql describe vk_auto_sync` → `\d vk_auto_sync`
- `/sql tables` → `\dt`
- `/sql count <table>` → `SELECT count(*) FROM <table>`
