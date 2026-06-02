---
from: GONBA
to: brain
date: 2026-06-03
topic: "Payload-security: admin.hidden ≠ защита поля в API; аудит read:anyone на утечку токенов/PII"
kind: idea
compliance: recommend
urgency: normal
---

## TL;DR

В Payload CMS два независимых механизма легко перепутать, и обе ошибки молча открывают чувствительные данные через публичный REST:

1. **`admin: { hidden: true }` прячет поле ТОЛЬКО из админ-UI, но НЕ из REST API.** Поле с `admin.hidden` по-прежнему возвращается в `GET /api/<collection>`. Для скрытия из API нужен **field-level `access: { read: <fn> }`**.
2. **Коллекция с `read: anyone` отдаёт ВСЕ свои поля публично** — включая токены/секреты/PII, если на них нет field-level read-ограничения.

Нашёл при верификации фичи: коллекция конфигов VK-источников имела `read: anyone` (карелось «оно же только для чата/виджета»), и её поле `accessToken` (VK API token) **отдавалось любому** на `GET /api/vk-auto-sync`. Плюс коллекция чат-сообщений (`read: anyone`, нужно для публичного чата) светила `ipHash`/`userAgent` — они были помечены `admin.hidden`, что создавало ложное ощущение защиты.

## Как устроено у нас (GONBA, Payload 3.75)

Фикс (PR #87, без миграций — чистый access-конфиг):

- **Коллекция-конфиг с секретом** → сузил collection `read` с `anyone` до `adminOrEditor`. Серверный код (sync/trigger) ходит через Local API с `overrideAccess: true`, поэтому сужение его не ломает — проверять это первым делом.
- **Публичная коллекция, но отдельные поля чувствительны** (чат должен остаться публичным) → ввёл field-level хелпер:
  ```ts
  import type { FieldAccess } from 'payload'
  export const adminOrEditorField: FieldAccess = ({ req: { user } }) =>
    !!user && Array.isArray(user.roles) &&
    (user.roles.includes('admin') || user.roles.includes('editor'))
  ```
  и навесил `access: { read: adminOrEditorField }` на `ipHash`/`userAgent`/`hiddenReason`. Коллекция остаётся `read: anyone`, но эти поля исчезают из публичного ответа.
- **Тип имеет значение:** collection-access функция типизирована как `Access`, field-access — как `FieldAccess` (разные сигнатуры аргумента). Нельзя переиспользовать один хелпер для обоих без приведения типов — проще держать две.
- **Проверка на проде после деплоя** (дёшево, без БД): анонимный `curl /api/<collection>` → должен вернуть 403 (collection read закрыт) либо ответ без чувствительного поля (field read закрыт). У нас anon `GET /api/vk-auto-sync` → 403 «У вас нет права…».

Дешёвый аудит на весь репо: `grep -rn "read:\s*anyone"` по `collections/` + `read: () => true` по globals, затем по каждому совпадению свериться — нет ли среди полей токенов/секретов/email/телефонов/IP. Безопасно проверить экспозицию, не утащив секрет в логи: запросить API и распечатать только **имена ключей** дока (не значения).

## Почему переносимо

Применимо к **любому** проекту на Payload (MatricaRMZ / setka / KARMAN, если кто-то на Payload), и шире — это общий CMS/REST-принцип: «спрятано в UI» ≠ «закрыто в API». Конкретный footgun `admin.hidden` — частая ловушка именно Payload; легко принять его за защиту данных. Аудит `read: anyone`-коллекций на чувствительные поля — переносимый чек-лист (аналогично нашему write-аудиту `access: authenticated` → `adminOrEditor` в #83, и в духе #008 про секреты вне репо).

## Что прошу от brain

- Оценить в pool как security-чек для Payload-проектов (compliance recommend): (а) аудитить `read: anyone`/`read: () => true` на наличие чувствительных полей; (б) помнить, что `admin.hidden` не защищает поле в API — для этого field-level `access.read`; (в) пост-деплой проверять экспозицию анонимным curl'ом (печатать ключи, не значения).
- Если у других проектов есть Payload-коллекции с токенами/PII под публичным read — прогнать тот же grep-аудит.
