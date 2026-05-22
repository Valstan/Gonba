# CLAUDE.md — entry point для AI-сессий

Этот файл — первое что Claude должен прочитать в любой новой сессии разработки проекта GONBA. Он подсказывает, **где взять контекст** и **как правильно работать**, не повторяя ошибки прошлых сессий.

---

## 📬 Mailbox check — ДО любой другой работы (новое с 2026-05-22)

GONBA — под управлением meta-репо `brain_matrica` (`../brain_matrica/`). Все идеи / директивы / вопросы brain ↔ GONBA ходят через `mailboxes/`. См. [ADR-0001 в brain](../brain_matrica/adr/0001-brain-projects-mailboxes.md).

### Шаги в начале каждой сессии

1. **Сканить** `../brain_matrica/mailboxes/GONBA/from-brain/*.md` (только корень — **не** `DRAFTS/`, **не** `ARCHIVE/`).
2. **Доложить** пользователю **до** чтения `SESSION_HANDOFF.md` в формате:
   ```
   📬 N писем от brain_matrica:
   - [high MUST]    2026-MM-DD-slug — short topic
   - [normal SHOULD] 2026-MM-DD-slug — short topic
   - [low MAY]      2026-MM-DD-slug — short topic
   ```
   Метка `[urgency COMPLIANCE]`:
   - **urgency** (`high` / `normal` / `low`) — когда читать
   - **COMPLIANCE** (`MUST` / `SHOULD` / `MAY`) — насколько обязательно
   `urgency: high` упоминать отдельно даже если письмо одно.
3. **Retroactive правило** для писем без поля `compliance` (до ADR-0001 v2):
   - `kind: directive` без compliance → читать как **MUST**
   - `kind: idea` без compliance → читать как **SHOULD**
4. **Обновить `.last-seen`** — записать текущий ISO timestamp в `../brain_matrica/mailboxes/GONBA/.last-seen`.

### Реакция по compliance

| compliance | RFC 2119 | Действие |
|---|---|---|
| `mandate` | MUST | Применить безусловно. Если технически невозможно — `to-brain/` с `kind=feedback`, `urgency=high`, конкретный блокер. |
| `recommend` | SHOULD | Применить (можно с адаптацией). Если совсем не подходит — `to-brain/` с обоснованием отказа. Молчать нельзя. |
| `suggest` | MAY | По усмотрению. Применил — приветствуется feedback. Отложил — молча. |

### Архивирование письма

После обработки:
1. `mv ../brain_matrica/mailboxes/GONBA/from-brain/<file>.md ../brain_matrica/mailboxes/GONBA/from-brain/ARCHIVE/`
2. Дописать в конец:
   ```markdown
   ---
   ## Result
   **Date:** YYYY-MM-DD
   **Status:** done | rejected | superseded | partial
   **Notes:** что сделали + ссылка на коммит/PR.
   ```
3. Коммит в `brain_matrica` через PR (см. PR-only flow): `chore(mailbox): GONBA archived <slug>`.

### Чтобы написать brain

`../brain_matrica/mailboxes/GONBA/to-brain/YYYY-MM-DD-slug.md`:
```yaml
---
from: GONBA
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | directive | question | feedback | report
compliance: suggest | recommend | mandate   # required для kind=idea и kind=directive
urgency: low | normal | high
ref: [<filename>]   # опционально
---
```
Коммит в `brain_matrica` через PR: `chore(mailbox): GONBA → brain <slug>`.

### Что НЕЛЬЗЯ в `brain_matrica/`

- ❌ Редактировать что-либо **кроме** `mailboxes/GONBA/{to-brain/, from-brain/ARCHIVE/, .last-seen}`
- ❌ Писать письма другим проектам напрямую (`mailboxes/MatricaRMZ/` и пр.) — только через brain (peer-to-peer запрещён)
- ❌ Удалять архивные письма
- ❌ Пропускать mailbox-check в начале сессии

---

## Источники правды (читать в начале каждой сессии)

| Файл | Что в нём |
|---|---|
| [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md) | **Sticky note из прошлой сессии:** статус (ACTIVE/IDLE), текущая нитка, следующий шаг. **Читать первым** (шаг 0 в `/start`). Обновляется через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`. |
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Архитектурная картина: стек, структура репо, интеграции, прод-инфраструктура, кэш-инвалидация. Стабильное «как устроено сейчас». |
| [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md) | Хронология изменений (свежее сверху). Что было сделано в последних сессиях, какие PR смержены, какие уроки извлечены. |
| [`docs/PENDING_FOLLOWUPS.md`](docs/PENDING_FOLLOWUPS.md) | Открытые задачи и техдолги с приоритетами 🔴⏳🟡🟢. Хвосты из предыдущих сессий. |
| [`docs/plans/`](docs/plans/) | Многоэтапные планы (plan mode → файл сюда, не в `~/.claude/plans/`). См. `docs/plans/README.md`. |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Функциональная документация (env, скрипты, систем-операции). Менее «архитектурный», более «справочный». |
| [`docs/RELEASE_STABILITY_CHECKLIST.md`](docs/RELEASE_STABILITY_CHECKLIST.md) | Pre-release checklist. Морально устарел — см. `/reliz`. |
| [`docs/adr/`](docs/adr/) | Architectural Decision Records — **почему** мы выбрали тот или иной архитектурный подход. Читать когда возникает вопрос «а почему так?». |
| [`web/AGENTS.md`](web/AGENTS.md) | Правила Payload CMS разработки (типизация, безопасность Local API, hooks). |
| [`../brain_matrica/`](../brain_matrica/) | **Meta-репо стратегического управления** GONBA / MatricaRMZ / setka / KARMAN: cross-project ADRs, pool идей, tech-radar, реестр проектов, mailboxes. Repo: [`brain_matrica`](https://github.com/Valstan/brain_matrica). **Read-only** для GONBA-сессии (исключение — свой mailbox, см. §📬 выше). Для предложения переносимого паттерна — письмо в `mailboxes/GONBA/to-brain/` с `kind=idea`. Cross-project ADRs обязательны: [ADR-0001](../brain_matrica/adr/0001-brain-projects-mailboxes.md) (mailbox), [ADR-0002](../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md) (PR-only flow). Fallback `~/.claude/cross-project-ideas/` — legacy, не использовать. |

Slash-команда `/start` всё это читает автоматически и выдаёт сводку.

---

## Жизненный цикл задачи

1. **Старт сессии** — `/start`. Получаешь сводку: что нового на main, какие хвосты, что в процессе. **Шаг 0** подсветит нитку из `docs/SESSION_HANDOFF.md` если она активна.
2. **На новой машине разработки** — один раз `bash scripts/install-git-hooks.sh` (ставит `prepare-commit-msg`, который мягко напоминает обновлять `DEVELOPMENT_LOG.md` на `feat/fix/refactor`-коммитах).
3. **Работа над фичей** — обычные правки кода. После TS-check, локальной проверки и согласования с пользователем — `/reliz`.
4. **Релиз** — `/reliz` ведёт через commit → push → PR → merge → build:raw через systemd-run → restart gonba → проверки. Один шаг = один диалог. После merge в `main` автоматически запускается CI и `.github/workflows/deploy-prod.yml`.
5. **Закрытие сессии** — перед последним коммитом обнови `DEVELOPMENT_LOG.md` (новый блок сверху, в дату сессии) и закрой/перенеси задачи в `PENDING_FOLLOWUPS.md`. **Если нитка не закрыта** (продолжать в следующей сессии) — запусти `/close_session`: он обновит `docs/SESSION_HANDOFF.md` и сделает отдельный коммит про handoff.
6. **При архитектурных решениях** — заведи новый ADR в `docs/adr/` по шаблону `_template.md`, чтобы будущие сессии знали «почему».
7. **Многоэтапные планы (plan mode)** — пиши файл плана в `docs/plans/<slug>.md`, **не** в `~/.claude/plans/`. Файлы в `docs/plans/` идут в git и видны с любого компа; outside-repo плановые папки между компами не синхронизируются.

---

## Правила, которые НЕ менять

### PR-only flow (cross-project, ADR-0002, 2026-05-22)

**Никакого `git push origin main`.** Любое изменение — через ветку → PR → merge. Branch protection включена на `Valstan/Gonba` `main` (2026-05-22).

```bash
git checkout -b <prefix>/<slug>       # feat/ | fix/ | chore/ | docs/ | refactor/
# работа, коммиты
git push -u origin <prefix>/<slug>
gh pr create --title "..." --body "$(cat <<'EOF'
## Summary
- bullet 1
- bullet 2

## Test plan
- [ ] что проверили
EOF
)"
# показать diff пользователю → дождаться явного OK
gh pr merge --squash --delete-branch
git checkout main && git pull --ff-only
```

- **Slug** — kebab-case, описательный. Префиксы по [ADR-0002](../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md).
- **Merge стратегия:** `--squash` по умолчанию (1-3 коммита). `merge commit` — когда линейка коммитов ценна.
- **Force-push** в feature-ветку — разрешён. В `main` — **запрещён**.
- **`gh pr merge` только после явного OK пользователя** на diff (CI должен быть зелёным — `web-quality` required check).
- **GONBA-специфика:** merge в `main` сразу триггерит `.github/workflows/deploy-prod.yml` → прод. Каждый PR description — фактический changelog для прода.
- **Hot-fix исключение** (ADR-0002 §8): прод упал, нужно в течение часа — owner может direct push в `main` (`enforce_admins=false`), но обязательный follow-up PR постфактум с описанием инцидента.

### Безопасность (наследие из системного промпта)

- На прод (shared system) — только с явным подтверждением. `ALTER TABLE`, `systemctl restart`, `git push --force`, удаление файлов — всё требует `AskUserQuestion`-диалога. Auto-mode classifier и так это блокирует.
- Секреты (токены, пароли) — никогда не пишем в коммит, не пишем в чат, не отдаём наружу. Если случайно увидел чей-то токен в `.env` — игнорируй и не повторяй.

### Технические уроки сессии 2026-05-20

- **Прод-build только через `scripts/safe-build.sh`** (или ручная команда `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`). Прямой `ssh ... 'corepack pnpm run build:raw'` умирает посередине prerender'а при SSH-disconnect.
- **`pnpm run build` использует watchdog с idle 180s** — Next.js 15 молчит дольше. Использовать `build:raw`.
- **`systemd-run` без `--uid=valstan`** взлетает от root и берёт глобальный pnpm 11 (несовместимый с проектом). ALWAYS `--uid=valstan --gid=valstan`.
- **На проде нет `push:true`-миграции.** Новые поля в коллекциях нужно вручную `ALTER TABLE ADD COLUMN ...` ИЛИ создать proper Payload migration в `web/src/migrations/`.
- **Прямой UPDATE/INSERT в БД** минует Payload `afterChange`-хуки и не сбрасывает `unstable_cache`. После таких правок — `ssh GONBA "sudo systemctl restart gonba"`. Особенно касается записей `header_nav_items`, `footer_*` (глобалы в Header/Footer).
- **`payload migrate` в headless** (CI / SSH без TTY) подвисает на drizzle y/N. Использовать обёртку `bash scripts/run-migrate.sh` (внутри `yes y | ...`). Fallback при подвисе — `psql -f web/src/migrations/<file>.sql` + ручной `INSERT INTO payload_migrations`.
- **На Windows** `corepack pnpm` нужен с `script-shell = C:\Program Files\Git\bin\bash.exe` (см. memory `windows_pnpm_setup`). `pnpm 11` несовместим — используй pnpm 10 через corepack.
- **Локальный Postgres** для GONBA: установлен, `postgres:postgres@127.0.0.1:5432/gonba`. БД уже есть.

---

## Полезные команды (ad-hoc, не slash)

```bash
# проверить прод-health
curl -s -o /dev/null -w '%{http_code}\n' https://гоньба.рф/api/health

# свежий лог сервиса
ssh GONBA "journalctl -u gonba -n 50 --no-pager"

# pg_dump прод-БД в локальный файл (через ssh)
ssh GONBA "sudo -u postgres pg_dump -Fc gonba" > prod-gonba-$(date +%Y%m%d).dump

# safe-build на проде
ssh GONBA "/home/valstan/GONBA/scripts/safe-build.sh"   # после первого деплоя скрипта

# проверить какие PR висят
gh pr list --state open --author @me
```

---

## Когда что-то идёт не так

- **Прод вернул 502** → `ssh GONBA "sudo systemctl status gonba --no-pager"`. Если crash-loop с ENOENT на `.next/...json` — значит `next build` не доехал. Удалить `.next/`, прогнать `scripts/safe-build.sh`, restart.
- **dev сервер локально показывает старые данные** → возможно `.next/cache/fetch-cache` или `unstable_cache`. Пересоберись с `rm -rf .next` или `restart`.
- **Payload падает с `column ... does not exist`** → схема в БД отстала от коллекций. Добавить колонку через `ALTER TABLE` или Payload migrate.
- **Drizzle висит на `Pulling schema from database` без y/N** → в headless-окружении применить `yes y | corepack pnpm dev` (memory `dev_schema_push_prompt`).
- **`gh pr create` не работает** → `gh auth status` показывает, нужна ли авторизация.

---

## Контакты по UI/UX

- Брендовые цвета: лесной зелёный (`--brand-forest`), янтарь (`--brand-amber`), глина (`--brand-clay`), песок (`--brand-sand`), олива (`--brand-olive`). Все определены в `web/src/app/(frontend)/globals.css` и (для admin) в `web/src/app/(payload)/site-theme.css`.
- Дизайн-система — shadcn-style токены (`--card`, `--border`, `--foreground`, `--primary`, ...). Использовать через Tailwind utilities (`bg-card`, `border-border`, `text-muted-foreground`) или через `var(--card)` в SCSS.

---

**В сомнениях — спроси пользователя через `AskUserQuestion`, не делай предположений на проде.**
