# 0005. Прод-секреты вне дерева репозитория (`/etc/gonba/gonba.env`)

- **Status:** Accepted
- **Date:** 2026-05-30
- **Deciders:** valstan + Claude (по директиве brain_matrica `from-brain/2026-05-28-secrets-outside-repo.md`, pool #008; pioneer — setka)

## Context

Прод-секреты GONBA (`DATABASE_URL`, `PAYLOAD_SECRET`, `CRON_SECRET`, `YANDEX_DISK_TOKEN`, `VK_TOKEN_*`) жили в `/home/valstan/GONBA/web/.env` — **внутри clone'а репозитория**. Три systemd-юнита (`gonba.service`, `gonba-vk-sync.service`, `gonba-media-cache.service`) читали их через `EnvironmentFile=-/home/valstan/GONBA/web/.env`, а build (`scripts/safe-build.sh` → `systemd-run`) полагался на автозагрузку `web/.env` средствами Next.js из cwd.

Единственная защита секретов — `.gitignore` (`.env`, `.env.*`, `!.env.example`). Любая ошибка (force-add, смена ignore-правил, копирование дерева) рисковала утечкой. brain-скан подтвердил, что GONBA — ровно тот кейс, для которого setka предложила cross-project паттерн #008: секреты вне дерева репо, под root-овладением и systemd `EnvironmentFile=`.

Параллельно встал вопрос: на проде GONBA крутится через **systemd** (`gonba.service` active), но в репо есть `web/docker-compose.yml` с `env_file: .env`. Нужно зафиксировать, какой из них «прод», чтобы не размазывать секреты по двум механизмам.

## Decision

1. **Прод-секреты переносятся в `/etc/gonba/gonba.env`** — root-owned, `0640`, группа `valstan` (под которой бегут юниты). Вне дерева репо.
2. **Три systemd-юнита** читают `EnvironmentFile=-/etc/gonba/gonba.env`.
3. **`scripts/safe-build.sh`** явно передаёт `-p EnvironmentFile=/etc/gonba/gonba.env` в `systemd-run` (build-time env, т.к. `web/.env` больше нет в дереве для автозагрузки Next.js).
4. **Прод = systemd.** `web/docker-compose.yml` — **только локальная разработка**; его `env_file: .env` ссылается на dev-`web/.env` (без прод-секретов). В прод-окружении docker-compose не используется.
5. В репо остаётся только **`web/.env.example`** как документация переменных.

## Alternatives considered

- **Оставить `.env` в дереве, полагаться на `.gitignore`** — статус-кво. Отброшено: одна защита, легко сломать; директива #008 SHOULD.
- **Symlink `web/.env → /etc/gonba/gonba.env`** — секрет-байты вне дерева, build не трогаем (Next.js автозагрузит по symlink'у). Отброшено: «магический» symlink в дереве менее прозрачен; явный `EnvironmentFile` в `systemd-run` — systemd-native и консистентен с runtime-юнитами (тот же парсер).
- **Прод через docker-compose + docker secrets** — отброшено: прод уже на systemd, переезд на docker — отдельная крупная нитка без выгоды здесь.
- **`source /etc/gonba/gonba.env` в обёртке build'а** — отброшено в пользу `-p EnvironmentFile`: bash-`source` и systemd-`EnvironmentFile` парсят кавычки/спецсимволы по-разному; повторное использование systemd-парсера гарантирует совпадение с runtime.

## Consequences

### Положительные

- Секреты под root-овладением (`0640`), вне дерева репо — `.gitignore` больше не единственная защита.
- `git pull --ff-only` на деплое не может затронуть секреты (их нет в дереве).
- Один источник правды для runtime и build — `/etc/gonba/gonba.env`.
- Зафиксирована граница prod(systemd)/dev(docker-compose) — секреты не размазаны.

### Отрицательные

- Появился прод-специфичный шаг настройки вне репо: новый сервер / переустановка требует создать `/etc/gonba/gonba.env` вручную (задокументировано в `docs/PROJECT.md`).
- Изменение секрета на проде — теперь правка `/etc/gonba/gonba.env` (нужен root), а не `web/.env` под valstan.

### Нейтральные

- Установленные на проде юниты (`/etc/systemd/system/gonba*.service`) — **копии**, не симлинки на репо; они правятся на проде отдельно от файлов `deploy/systemd/` в репо (репо = source of truth, прод-копии синхронизируются вручную). Уже было так до этого ADR.
- Бэкап старого `web/.env` лежит на проде как `/home/valstan/gonba.env.bak-20260530` (вне дерева) — удалить после периода уверенности.

## References

- Директива: `../../brain_matrica/mailboxes/GONBA/from-brain/2026-05-28-secrets-outside-repo.md`
- Pool [#008 secrets-outside-repo](../../../brain_matrica/cross-project-ideas/ideas/008-secrets-outside-repo.md) (pioneer — setka)
- Смежно: [ADR-0003](0003-build-via-systemd-run-on-prod.md) (build через systemd-run), pool #001 (изолированный SSH deploy-ключ)
- PR: chore/secrets-outside-repo (см. DEVELOPMENT_LOG 2026-05-30)
