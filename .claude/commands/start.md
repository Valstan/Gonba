---
description: Открыть новую сессию разработки GONBA — git pull, прочитать source-of-truth доки, отчёт о состоянии.
argument-hint: (без аргументов)
allowed-tools: Read, Bash, Glob, Grep, AskUserQuestion, mcp__ccd_session__mark_chapter
---

# /start — открыть новую сессию разработки GONBA

Задача: за один заход войти в полный контекст проекта и доложить пользователю что нового, какие хвосты и чем заняться.

**Никаких изменений** — только чтение и git-fetch.

## Шаг 0. Активная нитка из прошлой сессии

Прочитай `docs/SESSION_HANDOFF.md` **первым делом** (до глобального read-блока). Парси YAML-like заголовок:

- `Status:` — `ACTIVE` или `IDLE`
- `Updated:` — дата `YYYY-MM-DD`

Логика:

- **`Status: ACTIVE` + `Updated` ≤ 7 дней назад от сегодняшнего** → в самом начале отчёта пользователю **🧵 Прошлая сессия оставила нитку:** выделить блоком: краткое описание текущей нитки + следующий шаг + дата handoff'а. Завершить блок вопросом «продолжаем?».
- **`Status: ACTIVE` + `Updated` > 7 дней назад** → пометить **🧵 (устаревший handoff)** — нитка может быть не актуальна, спросить пользователя перед действиями.
- **`Status: IDLE`** → handoff не выделяется, идём по обычному отчёту (свободное состояние, ждём задачу).
- **Файл отсутствует** → пропустить шаг 0, идти дальше.

Этот шаг даёт **непрерывность многоэтапных задач** между сессиями (особенно с двух компов). Подробнее — [`../brain_matrica/cross-project-ideas/ideas/003-session-handoff.md`](../../../brain_matrica/cross-project-ideas/ideas/003-session-handoff.md) (fallback при отсутствии brain_matrica: `~/.claude/cross-project-ideas/ideas/003-session-handoff.md`).

## Шаг 1. Глава сессии

Вызови `mcp__ccd_session__mark_chapter` с заголовком `ГОНЬБА <дата>` (используй сегодняшнюю дату из `# currentDate` системного контекста; формат: `ГОНЬБА 20 мая 2026`). В `summary` — кратко: «Открытие сессии разработки.»

## Шаг 2. Source of truth (читать параллельно)

Прочитай **полностью** в одном параллельном блоке:

1. [`CLAUDE.md`](../../CLAUDE.md) — entry point, правила работы и уроки прошлых сессий
2. [`docs/PROJECT_STATE.md`](../../docs/PROJECT_STATE.md) — архитектурная картина
3. [`docs/DEVELOPMENT_LOG.md`](../../docs/DEVELOPMENT_LOG.md) — что сделано в последних сессиях
4. [`docs/PENDING_FOLLOWUPS.md`](../../docs/PENDING_FOLLOWUPS.md) — открытые задачи и техдолги

Memory-файлы автоматически подгружены через `MEMORY.md` — учитывай их в рекомендациях (особенно `windows_pnpm_setup`, `dev_schema_push_prompt`, `prod_server_access`, `feedback_cross_project_ideas`).

**Глобальный pool идей** — [`../brain_matrica/cross-project-ideas/INDEX.md`](../../../brain_matrica/cross-project-ideas/INDEX.md) (meta-репо [`brain_matrica`](https://github.com/Valstan/brain_matrica), путь относительный от Gonba/repo-root; см. `brain_matrica/README.md → Локальный путь`). Прочитай **только** строку про GONBA — ищи статусы `⚠️` (применимо, не применено) или `❓` (не оценено). Для каждой такой идеи открой `ideas/NNN-*.md` в `brain_matrica/cross-project-ideas/` и сверь `applicable_when` против текущего состояния GONBA. Если идея подходит — включи **одной строкой** в отчёт «Кстати: из pool'а — `<идея>` подходит, потому что `<причина>`. Применить?». Не настаивай. **Новые идеи добавляй в `brain_matrica` отдельной сессией** (`cd ../brain_matrica && claude`), не из этого репо. Fallback при отсутствии brain_matrica локально — `~/.claude/cross-project-ideas/` (legacy путь). См. инструкцию в `feedback_cross_project_ideas` memory.

## Шаг 3. Git sync (параллельно)

В одном блоке Bash:

- `git status --short --branch`
- `git fetch --all --tags --prune`
- `git log --oneline -10`

Затем последовательно (зависит от fetch):

- `git status --short --branch` ещё раз — оценить ahead/behind
- `gh pr list --state open --limit 20` — открытые PR
- `gh pr list --author @me --state open --limit 20` — мои

**`git pull` без подтверждения** только если: мы на `main`, есть `behind` без `ahead`, рабочее дерево чистое. Иначе — отчитаться и подождать решения.

## Шаг 4. Sanity-check окружения (параллельно)

Только чтения:

- `web/.env` существует? (`Glob` или `Read` краткий)
- `web/node_modules/.modules.yaml` существует? (если нет — `pnpm install` нужен)
- `web/src/payload-types.ts` свежее чем последний коммит в `web/src/collections/` или `web/src/globals/`? (через `git log -1 --format='%ct' -- <path>`)
- На Windows: `corepack pnpm config get script-shell` показывает git-bash?

## Шаг 5. Прод (опционально — если SSH доступен)

Параллельный безопасный probe:

```bash
curl -s -o /dev/null -w 'prod: %{http_code} in %{time_total}s\n' --max-time 10 https://гоньба.рф/api/health
```

Если 200 — продакшен жив. Если что-то другое — отметить в отчёте, **но не диагностировать без запроса пользователя**.

## Шаг 5.1. Возраст SSH deploy-ключа

В `docs/PROJECT.md → SSH deploy-key — ротация` есть строки **Создан** и **Следующая ротация не позднее**. Посчитай дельту от сегодняшней даты до «Следующая ротация»:

- Если осталось > 10 дней — ничего не делать.
- Если осталось ≤ 10 дней или дата уже прошла — добавь в отчёт **🟡 Напоминание о ротации SSH-ключа** с конкретными датами и предложи запустить процедуру (она в той же секции PROJECT.md).

Не делай ротацию автоматически — это destructive шаг, всегда с подтверждения пользователя.

## Шаг 5.2. SSH opt-in для сессии (pool-идея #006)

После probe прода (шаг 5) и проверки ротации (шаг 5.1) — спроси пользователя через `AskUserQuestion`, как обрабатывать SSH-вызовы к проду в текущей сессии. Это снимает фрикцию «нажать Allow 20 раз за сессию» при прод-диагностике, миграциях, чтении логов.

**Перед `AskUserQuestion`** проверь окружение (Bash / PowerShell):
- Существует ли `~/.ssh/id_ed25519_gonba_deploy`.
- Есть ли алиас `GONBA` в `~/.ssh/config` (`grep -i "Host GONBA" ~/.ssh/config`).

Если ключа или алиаса нет — в варианте опции #3 ниже допиши «(на этой машине ключ не найден — вариант не сработает)» и считай вариант #1 (пропустить) разумным по умолчанию.

**Сам `AskUserQuestion`:**

```yaml
question: «Нужен ли SSH-доступ к проду в этой сессии?»
header: «SSH-доступ»
multiSelect: false
options:
  - label: «Нет, пропустить»
    description: «SSH не использую. Если возникнет нужда — переспрошу конкретно.»
  - label: «Переспрашивать на каждый»
    description: «Auto-mode classifier работает как раньше: каждый ssh GONBA — отдельное подтверждение.»
  - label: «Полный доступ на сессию (Рекомендуется)»
    description: «Read-only команды (journalctl, systemctl is-active, psql -c 'SELECT', cat, ls) — без переспрашивания. Destructive (ALTER, UPDATE/INSERT/DELETE, restart/stop, rm, sudo-write, scp в системные директории) — всё равно AskUserQuestion.»
```

**Что Claude делает при выборе #3 «Полный доступ»:**

- В этой сессии запоминает соглашение: read-only SSH-команды (включая `scp` из `/tmp` на локалку) выполняет напрямую через `Bash` без `AskUserQuestion`.
- При первом SSH-вызове кратко сообщает в чате: «(SSH opt-in активен — выполняю без переспрашивания)» — пользователь видит что соглашение помнится.
- Перед **любой destructive** командой (ALTER, UPDATE, DELETE, restart, stop, rm, truncate, force-push, sudo write) — всё равно делает паузу и спрашивает через `AskUserQuestion`. Это вопрос здравого смысла, не permissions. Третий вариант **не отменяет** осторожность.
- Скоуп — только текущая сессия. Следующая `/start` снова задаёт этот вопрос с чистого листа.

**Что Claude делает при выборе #1 «Пропустить» или #2 «Переспрашивать»:**

- Сохраняет дефолтное поведение Auto-mode classifier'а: каждый `ssh GONBA`-вызов проходит через подтверждение.
- При #1 — дополнительно избегает SSH без явного запроса пользователя.

См. cross-project pool: [`../brain_matrica/cross-project-ideas/ideas/006-full-session-ssh-optin.md`](../../../brain_matrica/cross-project-ideas/ideas/006-full-session-ssh-optin.md). Pioneer — setka.

## Шаг 6. Отчёт пользователю

Структура:

1. **Сессия:** `ГОНЬБА <дата>` — отмечена.
2. **Что нового** (из `DEVELOPMENT_LOG.md`, последний блок): 1-2 строки о последней сессии.
3. **Git:** ветка, ahead/behind, результат pull (если был), uncommitted-файлы (если есть).
4. **Открытые PR:** мои и всего.
5. **Окружение:** `.env` / `node_modules` / `payload-types.ts` / прод-health.
6. **🔴 Блокеры и ⏳ в процессе** из `PENDING_FOLLOWUPS.md` (если есть).
7. **Самые свежие 🟡 техдолги** (топ-3) и 🟢 идеи (топ-3) — кратко, для контекста.
8. **Чем займёмся?** — открытый вопрос пользователю.

Если есть блокеры — подсветить отдельно. Если на проде уже всё хорошо и хвостов нет — так и сказать.

## Шаг 7. Напоминание для закрытия сессии

В конце ответа добавь сноску:

> Когда сделаешь значимые правки — перед последним коммитом обнови `docs/DEVELOPMENT_LOG.md` (новый блок сверху, в дату сегодняшней сессии) и закрой/перенеси задачи в `docs/PENDING_FOLLOWUPS.md`. Команда `/reliz` сделает релиз правильно (через `safe-build.sh`).
