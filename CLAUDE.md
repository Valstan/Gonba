# CLAUDE.md — entry point для AI-сессий

Этот файл — первое что Claude должен прочитать в любой новой сессии разработки проекта GONBA. Он подсказывает, **где взять контекст** и **как правильно работать**, не повторяя ошибки прошлых сессий.

---

## 📬 Mailbox check — ДО любой другой работы (asymmetric scheme, ADR-0001 v3)

GONBA — под управлением meta-репо `brain_matrica` (`../brain_matrica/`). Идеи / директивы / вопросы brain ↔ GONBA ходят через **асимметричные mailbox'ы**: каждая сторона пишет **только в свой репо**. См. [ADR-0001 v3](../brain_matrica/adr/0001-brain-projects-mailboxes.md).

| Направление | Кто пишет | Где |
|---|---|---|
| `brain → GONBA` | brain | `brain_matrica/mailboxes/GONBA/from-brain/*.md` (мы только **читаем** через `git pull --ff-only`) |
| `GONBA → brain` | GONBA | **`mailbox/to-brain/*.md`** в этом репо (коммитим в свой через PR) |

### Шаги в начале каждой сессии

1. **Sync brain (read-only):**
   ```bash
   cd ../brain_matrica && git pull --ff-only && cd -
   ```
2. **Сканить** `../brain_matrica/mailboxes/GONBA/from-brain/*.md` (только корень — **не** `DRAFTS/`, **не** `ARCHIVE/`).
3. **Доложить** пользователю **до** чтения `SESSION_HANDOFF.md` в формате:
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
4. **Retroactive правило** для писем без поля `compliance` (отправленных до ADR-0001 v2):
   - `kind: directive` без compliance → читать как **MUST**
   - `kind: idea` без compliance → читать как **SHOULD**

### Реакция по compliance

| compliance | RFC 2119 | Действие |
|---|---|---|
| `mandate` | MUST | Применить безусловно. Если технически невозможно — `mailbox/to-brain/` с `kind=feedback`, `urgency=high`, конкретный блокер. |
| `recommend` | SHOULD | Применить (можно с адаптацией). Если совсем не подходит — `mailbox/to-brain/` с обоснованием отказа. Молчать нельзя. |
| `suggest` | MAY | По усмотрению. Применил — приветствуется feedback. Отложил — молча. |

### Чтобы написать brain (исходящие — в свой репо)

Создать файл `mailbox/to-brain/YYYY-MM-DD-slug.md` **в этом репо** (НЕ в `brain_matrica/`):

```yaml
---
from: GONBA
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | directive | question | feedback | report
compliance: suggest | recommend | mandate   # required для kind=idea и kind=directive
urgency: low | normal | high
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/<filename>.md   # если отвечаешь
---
```

Закоммитить **в свой репо через PR** (отдельным PR или вместе с тематическим). Brain прочитает через `git pull --ff-only` со своей стороны.

### Проактивный шеринг находок (pool #009)

Значимые **переносимые** находки (новый скилл / паттерн / обход бага фреймворка/инструмента / security-приём) отправляю в `mailbox/to-brain/` с `kind=idea` **сам** — не дожидаясь явного запроса brain. `/close_session` шаг 4.5 напоминает прогнать находку через 3-фильтр (значимость / переносимость / неочевидность). **Тишина = норма:** рутинный фикс / бамп / доменно-специфичная правка → молчим. См. [pool #009](../brain_matrica/cross-project-ideas/ideas/009-share-findings-reflex.md).

### Consult-library reflex — заглянуть в библиотеку Мозга (pool #014)

Read-сторона того же шкафа, что и #009 (#009 — «нашёл полезное → поделись»; #014 — «собрался копать → сперва спроси Мозг»). **Условный рефлекс, не шаг `/start`** — на каждом старте библиотеку НЕ читаем (token economy, [ADR-0003](../brain_matrica/adr/0003-token-economy-principles.md)). Заглядываю ровно в два момента:

1. **Перед вводом нового/нетривиального** (новый паттерн / инструмент / инфра-подход / миграция данных / кросс-cutting рефактор) — *до* проектирования бегло просмотреть [`../brain_matrica/cross-project-ideas/INDEX.md`](../brain_matrica/cross-project-ideas/INDEX.md) + [`../brain_matrica/tech-radar/INDEX.md`](../brain_matrica/tech-radar/INDEX.md) — нет ли готового опыта.
2. **При незнакомой грабле инструмента/инфры/деплоя** (не доменный баг, а «почему CI / Payload / drizzle / git так себя ведёт») — *до* долгого дебага грепнуть [`../brain_matrica/cross-project-ideas/GOTCHAS.md`](../brain_matrica/cross-project-ideas/GOTCHAS.md) по симптому (там уже лежат наши же G2/G6/G7).

Нашёл релевантное — переиспользую опыт (и при желании отпишусь в `mailbox/to-brain/`, что применил). Не нашёл — продолжаю как обычно. **Тишина = норма:** триггер не сработал за сессию → ноль лишних чтений. `git pull --ff-only` brain'а уже делается на `/start` для mailbox-скана — повторно не платим. См. [pool #014](../brain_matrica/cross-project-ideas/ideas/014-consult-library-reflex.md).

### Архивация — НЕ наша забота (MVP)

- Архивирование `from-brain/*.md` в `ARCHIVE/` — это **brain в своём репо**. Я не двигаю ничего на стороне brain'а.
- `mailbox/to-brain/` здесь не чистится (MVP). Если папка замусорится — добавим механизм отдельно. См. [ADR-0001 §Архивация](../brain_matrica/adr/0001-brain-projects-mailboxes.md).

### Что НЕЛЬЗЯ

- ❌ Писать или коммитить в `../brain_matrica/mailboxes/GONBA/to-brain/` (устаревшая папка, brain больше не принимает там)
- ❌ Архивировать `from-brain/*` на стороне brain'а — забота brain'а
- ❌ Редактировать **любые** файлы `../brain_matrica/` из этой сессии (brain — **read-only**)
- ❌ Клонировать brain_matrica для записи — только `git pull --ff-only`
- ❌ Писать письма другим проектам напрямую (`brain_matrica/mailboxes/MatricaRMZ/` и пр.) — peer-to-peer запрещён, идея в pool — письмо в свой `mailbox/to-brain/` с `kind=idea`
- ❌ Пропускать mailbox-check в начале сессии

---

## Источники правды (читать в начале каждой сессии)

| Файл | Что в нём |
|---|---|
| [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md) | **Sticky note из прошлой сессии:** статус (ACTIVE/IDLE), текущая нитка, следующий шаг. **Читать первым** (шаг 0 в `/start`). Обновляется через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`. |
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Архитектурная картина: стек, структура репо, интеграции, прод-инфраструктура, кэш-инвалидация. Стабильное «как устроено сейчас». |
| [`docs/PENDING_FOLLOWUPS.md`](docs/PENDING_FOLLOWUPS.md) | Открытые задачи и техдолги с приоритетами 🔴⏳🟡🟢. Хвосты из предыдущих сессий. |
| [`docs/plans/`](docs/plans/) | Многоэтапные планы (plan mode → файл сюда, не в `~/.claude/plans/`). См. `docs/plans/README.md`. |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Функциональная документация (env, скрипты, систем-операции). Менее «архитектурный», более «справочный». |
| [`docs/RELEASE_STABILITY_CHECKLIST.md`](docs/RELEASE_STABILITY_CHECKLIST.md) | Pre-release checklist. Морально устарел — см. `/reliz`. |
| [`docs/adr/`](docs/adr/) | Architectural Decision Records — **почему** мы выбрали тот или иной архитектурный подход. Читать когда возникает вопрос «а почему так?». |
| [`web/AGENTS.md`](web/AGENTS.md) | Правила Payload CMS разработки (типизация, безопасность Local API, hooks). |
| [`../brain_matrica/`](../brain_matrica/) | **Meta-репо стратегического управления** GONBA / MatricaRMZ / setka / KARMAN: cross-project ADRs, pool идей, tech-radar, реестр проектов, mailboxes. Repo: [`brain_matrica`](https://github.com/Valstan/brain_matrica). **Read-only** для GONBA-сессии (asymmetric mailbox scheme, ADR-0001 v3). Идеи в pool — письмо в **свой** `mailbox/to-brain/` с `kind=idea`, не прямое редактирование brain. Cross-project ADRs: [ADR-0001](../brain_matrica/adr/0001-brain-projects-mailboxes.md) (mailbox), [ADR-0002](../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md) (PR-only flow). Fallback `~/.claude/cross-project-ideas/` — legacy, не использовать. |
| [`mailbox/`](mailbox/) | **Исходящая почта в brain** (asymmetric scheme). Письма пишем в `mailbox/to-brain/YYYY-MM-DD-slug.md`, коммитим через PR в свой репо. См. [`mailbox/README.md`](mailbox/README.md) и §📬 Mailbox check выше. |

Slash-команда `/start` всё это читает автоматически и выдаёт сводку.

---

## Жизненный цикл задачи

1. **Старт сессии** — `/start`. Получаешь сводку: что нового на main, какие хвосты, что в процессе. **Шаг 0** подсветит нитку из `docs/SESSION_HANDOFF.md` если она активна.
2. **Работа над фичей** — обычные правки кода. После TS-check, локальной проверки и согласования с пользователем — `/reliz`.
3. **Релиз** — `/reliz` ведёт через commit → push → PR → merge → build:raw через systemd-run → restart gonba → проверки. Один шаг = один диалог. После merge в `main` автоматически запускается CI и `.github/workflows/deploy-prod.yml`. **Тело PR = changelog** (хронология живёт в `git log` + PR, не в отдельном журнале — [ADR-0007](docs/adr/0007-archive-development-log.md)).
4. **Закрытие сессии** — перед последним коммитом закрой/перенеси задачи в `PENDING_FOLLOWUPS.md`. Затем запусти `/close_session` (или скажи «закрой сессию» / «заверши сессию» — NL-триггеры ведут туда же): он обновит `docs/SESSION_HANDOFF.md`, закоммитит+запушит ВСЁ через PR и **не закроет сессию, пока вся работа не на GitHub** (sync-гейт `scripts/git_sync_check.sh --gate`, pool #010). GitHub — источник истины между машинами.
5. **При архитектурных решениях** — заведи новый ADR в `docs/adr/` по шаблону `_template.md`, чтобы будущие сессии знали «почему».
6. **Многоэтапные планы (plan mode)** — пиши файл плана в `docs/plans/<slug>.md`, **не** в `~/.claude/plans/`. Файлы в `docs/plans/` идут в git и видны с любого компа; outside-repo плановые папки между компами не синхронизируются.

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

### Session sync safeguard — GitHub источник истины между машинами (cross-project, pool #010, 2026-05-30)

**GitHub — источник истины при работе на нескольких машинах** (днём один комп, вечером другой). **Никогда не оставляй сессию с несинхронизированной работой.** Сессии иногда уходят в архив автоматически (тумблер Cowork «Classify session states»); если работа не запушена — версии между компами разъезжаются.

- **`/close_session` — единственная команда закрытия.** Коммитит+пушит ВСЁ (код+доки) через PR-flow и не считает сессию закрытой, пока `bash scripts/git_sync_check.sh --gate` не вернёт `exit 0`.
- **NL-триггеры** «закрой сессию» / «заверши сессию» / «закрываемся» → запускают `/close_session`.
- **SessionStart-хук** (`.claude/settings.json` → `scripts/git_sync_check.sh --warn`) при входе в каждую сессию подсвечивает несинхронизированную работу. Хук только предупреждает (`exit 0`), не блокирует вход — гейт живёт в `/close_session`.
- **Ручной шаг владельца:** отключить тумблер Cowork «Classify session states», чтобы сессии не уходили в архив без ведома. Защита работает и без этого, но вместе надёжнее.

См. [pool #010](../brain_matrica/cross-project-ideas/ideas/010-session-sync-safeguard.md), [ADR-0002](../brain_matrica/adr/0002-pr-only-flow-no-direct-push.md). Pioneer — setka.

### Безопасность (наследие из системного промпта)

- На прод (shared system) — только с явным подтверждением. `ALTER TABLE`, `systemctl restart`, `git push --force`, удаление файлов — всё требует `AskUserQuestion`-диалога. Auto-mode classifier и так это блокирует.
- Секреты (токены, пароли) — никогда не пишем в коммит, не пишем в чат, не отдаём наружу. Если случайно увидел чей-то токен в `.env` — игнорируй и не повторяй.

### Технические уроки сессии 2026-05-20

- **Прод-build только через `scripts/safe-build.sh`** (или ручная команда `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`). Прямой `ssh ... 'corepack pnpm run build:raw'` умирает посередине prerender'а при SSH-disconnect.
- **`pnpm run build` использует watchdog с idle 180s** — Next.js 15 молчит дольше. Использовать `build:raw`.
- **`systemd-run` без `--uid=valstan`** взлетает от root и берёт глобальный pnpm 11 (несовместимый с проектом). ALWAYS `--uid=valstan --gid=valstan`.
- **На проде нет `push:true`-миграции.** Новые поля в коллекциях нужно вручную `ALTER TABLE ADD COLUMN ...` ИЛИ создать proper Payload migration в `web/src/migrations/`.
- **Прямой UPDATE/INSERT в БД** минует Payload `afterChange`-хуки и не сбрасывает `unstable_cache`. Особенно касается глобалов `header_nav_items`, `footer_*` (Header/Footer кэшируются через `getCachedGlobal` → `unstable_cache` с тегом `global_<slug>`).
  - **⚠️ `restart gonba` НЕДОСТАТОЧЕН для `unstable_cache`** (урок 2026-06-06, правка пункта меню «Облако» сырым SQL). `unstable_cache` персистится на **диске** (`.next/cache`) и переживает `systemctl restart` — после рестарта глобал всё равно отдаётся старый. Сырой SQL к тому же не триггерит `revalidateHeader`/`safeRevalidateTag`. Правильные варианты: **(а)** править глобал через Payload Local API (`payload.updateGlobal`/admin UI) — afterChange-хук вызовет `safeRevalidateTag('global_header')` в контексте Next-сервера; либо **(б)** после сырого SQL: `rm -rf /home/valstan/GONBA/web/.next/cache && sudo systemctl restart gonba` (чистит только data/ISR-кэш, не трогает чанки `.next/server`/`.next/static` → ChunkLoadError-риска нет). Standalone-tsx с `payload.updateGlobal` revalidate НЕ выполнит (`revalidateTag` вне request-scope глушится `safeRevalidateTag`).
- **НЕ править versioned-документы (drafts-enabled коллекции) сырым SQL** (Posts/Pages/Projects — у всех `versions.drafts`). Payload и `@payloadcms/plugin-search` читают published-состояние из таблицы версий (`_<coll>_v.version__status`/`latest`), а не из главной таблицы. `UPDATE projects SET _status='published'` меняет только главную таблицу → плагин поиска НЕ синкает (latest-версия осталась `draft`), а следующая публикация через API **затирает** твою SQL-правку, промотав старую draft-версию поверх (так в сессии 2026-06-04 вернулся уже удалённый из галереи тестовый мусор). **Правильно:** публикация/правка versioned-доков — только через Payload Local API (`payload.update({ collection, id, data: { _status: 'published', … }, overrideAccess: true })`): создаёт published-версию + триггерит хуки и синк поиска. Для one-off массовых правок — временный tsx-скрипт на проде (`getPayload({ config })`, env из `/etc/gonba/gonba.env` через `set -a && . … && set +a`), удалить после прогона.
- **`payload migrate` в headless** (CI / SSH без TTY) подвисает на drizzle y/N. Использовать обёртку `bash scripts/run-migrate.sh` (внутри `yes y | ...`). Fallback при подвисе — `psql -f web/src/migrations/<file>.sql` + ручной `INSERT INTO payload_migrations`.
- **На Windows** `corepack pnpm` нужен с `script-shell = C:\Program Files\Git\bin\bash.exe` (см. memory `windows_pnpm_setup`). `pnpm 11` несовместим — используй pnpm 10 через corepack.
- **Локальный Postgres** для GONBA: установлен, `postgres:postgres@127.0.0.1:5432/gonba`. БД уже есть.
- **Деплой — строго ПО ОДНОМУ (не параллелить).** `deploy-prod.yml` триггерится и от merge (авто, `workflow_run` на CI), и от ручного `gh workflow run`. Если запустить оба разом — `.next` пересобирается во время отдачи, манифест чанков рассинхронится → клиент ловит **ChunkLoadError** («Application error» на всех страницах), даже если код корректен (так был прод-outage 2026-06-05 при деплое site-decor). **Правило:** после merge ждать ЕДИНСТВЕННЫЙ авто-деплой; ручной dispatch — только когда авто-деплоя не будет (напр. повторный прогон). nginx тут чист (`proxy_pass` на Next, parens-чанки `app/(frontend)/…` отдаются 200) — дело не в скобках.
- **Smoke-check деплоя НЕ ловит client-side ChunkLoadError** (проверяет HTTP 200 + контент-маркер в SSR-HTML). После деплоя фронт-изменений — **визуально проверить гидратацию в браузере** (Claude-in-Chrome: `getComputedStyle`/`document.title`/screenshot), не доверять только зелёному деплою. Класс «зелёный пайплайн ≠ корректный результат» (pool #011).

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
