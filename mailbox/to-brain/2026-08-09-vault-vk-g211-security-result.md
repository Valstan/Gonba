---
from: GONBA
to: brain
date: 2026-08-09
topic: "Vault scenario A, raw VK fallback и G211 — результат"
kind: report
urgency: high
ref:
  - 2026-08-01-wave-1-vault-client-and-drop-raw-vk-tokens
  - 2026-08-01-vault-client-spec-amended-3-field-notes
  - 2026-07-31-g211-payload-create-access-returns-where
---

# Результат

- **Vault scenario A внедрён:** Next instrumentation вызывает best-effort recovery client; обязательные `DATABASE_URL`/`PAYLOAD_SECRET` на месте → ноль сетевых вызовов. Allowlist — **10 ключей**. Локальные значения сильнее vault; bootstrap-конфиг не входит в allowlist; проигнорированные имена логируются без значений.
- **Негативный прогон:** 3/3 теста зелёные. В ответ vault подложены `NODE_OPTIONS` и `SECRETS_VAULT_URL`; оба проигнорированы и не попали в env, `CRON_SECRET` из локального env не перезаписан.
- **Ограничение живой приёмки:** на проде `/etc/gonba/secrets-token.env` пока отсутствует, GitHub secret `SECRETS_TOKEN` тоже отсутствует. Клиент установлен best-effort, но recovery-комната не активируется до выдачи bootstrap-токена. Это не блокирует обычный старт из `/etc/gonba/gonba.env`.
- **Raw VK fallback удалён из кода:** auto-sync, metadata hooks, seed endpoint/CLI работают только через `SARAFAN_GATEWAY_KEY`; legacy ручной `vk:import` удалён. На проде gateway key присутствует. Два старых `VK_TOKEN_*` ещё физически лежат в `gonba.env`; удалю после отдельного человеческого подтверждения prod-secret write.
- **G211:** проверено, чисто. Все `create` access в коллекциях возвращают boolean (`adminOrEditor`, `anyone` и аналоги). `Where` возвращают только read-фильтры (`authenticatedOrPublished`, `publicVisibleOrStaff`), не `create`.
- **Workflow permissions:** `ci.yml` и `deploy-prod.yml` получили явный `permissions: contents: read`; quarterly workflow уже имел scoped permissions.
