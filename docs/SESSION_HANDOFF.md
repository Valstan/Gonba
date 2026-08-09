# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-08-09
**Branch:** main
**Last released version:** PR #183 (`eaef7a5`); CI, deploy, exact-SHA gate and prod health are green.

---

## Текущая нитка

Срочная очередь brain закрыта по коду: принят vendor-neutral контракт агентов и выполнен квартальный аудит #036, deploy больше не маскирует неудачный `git pull`, добавлен KARMAN Vault bootstrap и удалены все raw VK-token fallback'и. Прод работает через SARAFAN; `VK_TOKEN_VALSTAN` и `VK_TOKEN_VITA` удалены из env и process environ после root-only backup.

Остались внешние шаги владельца: выдать bootstrap-токен для реального Vault recovery и зарегистрировать счётчики аналитики. После них можно вернуться к отдельно подтверждаемым изменениям живых данных Payload из `docs/PENDING_FOLLOWUPS.md`.

## Следующий шаг

1. Получить bootstrap-токен KARMAN для GONBA, установить его в root-only `/etc/gonba/secrets-token.env` как `SECRETS_TOKEN=...`, затем перезапустить сервис только после явного подтверждения владельца и проверить загрузку секрета без вывода его значения.
2. Получить ID Яндекс.Метрики и регистрацию LiveInternet, выставить `YM_COUNTER_ID` / `LI_ENABLED=1` в `/etc/gonba/gonba.env` и проверить consent-flow.
3. После отдельного подтверждения prod-data выполнить через Payload Local API задачи раздела `VK auto-sync`: два источника, две ошибочные привязки и контентную чистку.

## Контекст

- **План:** —
- **Связанные коммиты сессии:** `1b21276` — vendor-neutral contract и аудит #036; `a4e236e` — fail-fast deploy pull + exact SHA; `eaef7a5` — Vault bootstrap, VK gateway-only и G211 audit.
- **Прод:** release `eaef7a5` активен; public/local health 200; VK health healthy (4 источника, 0 errors, 0 stale). Raw VK-токены отсутствуют в env-файле и окружении процесса. Перед очисткой создан backup `/etc/gonba/gonba.env.bak-vk-token-cleanup-20260809-104634`.
- **Открытые вопросы для пользователя:** bootstrap-токен KARMAN; ID Метрики; регистрация LiveInternet; отдельное подтверждение операций над живыми Payload-данными.

## Failed approaches (этой нитки)

_Не было незакрытых failed approaches: ложный вывод о пропавшем SSH-ключе исправлен после проверки фактического alias, а маскировавший ошибку pull pipeline устранён в PR #182._

## Не забыть (low-priority)

- Внешний alert по повторному all-fail SARAFAN остаётся в `docs/PENDING_FOLLOWUPS.md`.
- Постепенно уменьшать knip over-export/type-export backlog без массового удаления API.

---

> Sticky note — сначала активировать Vault recovery и аналитику; любые живые Payload-данные менять только через Local API и с отдельным подтверждением.
