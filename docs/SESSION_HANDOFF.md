# Session Handoff

**Status:** CLOSED
**Updated:** 2026-08-09
**Branch:** main
**Last released version:** PR #195 (`61eaace`); CI, E2E, deploy, exact-SHA gate and prod health are green.

---

## Текущая нитка

Срочная очередь brain закрыта по коду: принят vendor-neutral контракт агентов и выполнен квартальный аудит #036, deploy больше не маскирует неудачный `git pull`, добавлен KARMAN Vault bootstrap и удалены все raw VK-token fallback'и. Прод работает через SARAFAN; `VK_TOKEN_VALSTAN` и `VK_TOKEN_VITA` удалены из env и process environ после root-only backup.

Код VK multi-project routing, FTS Phase 3 и каталог/услуги применены. На проде включены 6 VK-источников, `vkSync.healthy=true`, 0 ошибок/просрочек; конный клуб скрыт, а его историческая запись и импортированные предложения сохранены опубликованными с правильными проектами. В этой сессии каталог объединён с главной: `/projects` редиректит на `/#projects`, главная показывает все 11 активных проектов, а единый `projectCoverImage` синхронизирует обложки главной, переключателя и тематических карточек. Финальный smoke проверяет 308 redirect и новый anti-stale marker. Остались внешние шаги владельца: bootstrap-токен Vault, ID Метрики/регистрация LiveInternet, SSH deploy-key rotation до 2026-08-20. Отдельно ждёт подтверждения оставшаяся контентная чистка постов и медиа.

## Следующий шаг

1. Получить bootstrap-токен KARMAN для GONBA, установить его в root-only `/etc/gonba/secrets-token.env` как `SECRETS_TOKEN=...`, затем перезапустить сервис только после явного подтверждения владельца и проверить загрузку секрета без вывода его значения.
2. Получить ID Яндекс.Метрики и регистрацию LiveInternet, выставить `YM_COUNTER_ID` / `LI_ENABLED=1` в `/etc/gonba/gonba.env` и проверить consent-flow.
3. До 2026-08-20 провести отдельную подтверждённую ротацию SSH deploy-key.
4. После отдельного подтверждения prod-data выполнить через Payload Local API оставшиеся привязки VK-постов и визуальную контентную чистку.

## Контекст

- **План:** —
- **Связанные коммиты сессии:** `61eaace` — unified project showcase, `/projects` redirect, shared cover mapping, updated E2E and deploy smoke.
- **Прод:** release `61eaace` активен; public/local health 200; `/projects` отвечает `308 Location: /#projects`; финальный deploy smoke зелёный; VK health healthy (6 источников, 0 errors, 0 stale). Raw VK-токены отсутствуют в env-файле и окружении процесса. Перед очисткой создан backup `/etc/gonba/gonba.env.bak-vk-token-cleanup-20260809-104634`.
- **Открытые вопросы для пользователя:** bootstrap-токен KARMAN; ID Метрики; регистрация LiveInternet; подтверждение оставшейся чистки постов/медиа; SSH deploy-key rotation.

## Failed approaches (этой нитки)

_Не было незакрытых failed approaches: ложный вывод о пропавшем SSH-ключе исправлен после проверки фактического alias, а маскировавший ошибку pull pipeline устранён в PR #182._

## Не забыть (low-priority)

- Внешний alert по повторному all-fail SARAFAN остаётся в `docs/PENDING_FOLLOWUPS.md`.
- Постепенно уменьшать knip over-export/type-export backlog без массового удаления API.

---

> Sticky note — сначала активировать Vault recovery и аналитику; любые живые Payload-данные менять только через Local API и с отдельным подтверждением.
