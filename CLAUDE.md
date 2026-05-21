# CLAUDE.md — entry point для AI-сессий

Этот файл — первое что Claude должен прочитать в любой новой сессии разработки проекта GONBA. Он подсказывает, **где взять контекст** и **как правильно работать**, не повторяя ошибки прошлых сессий.

---

## Источники правды (читать в начале каждой сессии)

| Файл | Что в нём |
|---|---|
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Архитектурная картина: стек, структура репо, интеграции, прод-инфраструктура, кэш-инвалидация. Стабильное «как устроено сейчас». |
| [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md) | Хронология изменений (свежее сверху). Что было сделано в последних сессиях, какие PR смержены, какие уроки извлечены. |
| [`docs/PENDING_FOLLOWUPS.md`](docs/PENDING_FOLLOWUPS.md) | Открытые задачи и техдолги с приоритетами 🔴⏳🟡🟢. Хвосты из предыдущих сессий. |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Функциональная документация (env, скрипты, систем-операции). Менее «архитектурный», более «справочный». |
| [`docs/RELEASE_STABILITY_CHECKLIST.md`](docs/RELEASE_STABILITY_CHECKLIST.md) | Pre-release checklist. Морально устарел — см. `/reliz`. |
| [`docs/adr/`](docs/adr/) | Architectural Decision Records — **почему** мы выбрали тот или иной архитектурный подход. Читать когда возникает вопрос «а почему так?». |
| [`web/AGENTS.md`](web/AGENTS.md) | Правила Payload CMS разработки (типизация, безопасность Local API, hooks). |

Slash-команда `/start` всё это читает автоматически и выдаёт сводку.

---

## Жизненный цикл задачи

1. **Старт сессии** — `/start`. Получаешь сводку: что нового на main, какие хвосты, что в процессе.
2. **На новой машине разработки** — один раз `bash scripts/install-git-hooks.sh` (ставит `prepare-commit-msg`, который мягко напоминает обновлять `DEVELOPMENT_LOG.md` на `feat/fix/refactor`-коммитах).
3. **Работа над фичей** — обычные правки кода. После TS-check, локальной проверки и согласования с пользователем — `/reliz`.
4. **Релиз** — `/reliz` ведёт через commit → push → PR → merge → build:raw через systemd-run → restart gonba → проверки. Один шаг = один диалог. После merge в `main` автоматически запускается CI и `.github/workflows/deploy-prod.yml`.
5. **Закрытие сессии** — перед последним коммитом обнови `DEVELOPMENT_LOG.md` (новый блок сверху, в дату сессии) и закрой/перенеси задачи в `PENDING_FOLLOWUPS.md`.
6. **При архитектурных решениях** — заведи новый ADR в `docs/adr/` по шаблону `_template.md`, чтобы будущие сессии знали «почему».

---

## Правила, которые НЕ менять

### Безопасность (наследие из системного промпта)

- На прод (shared system) — только с явным подтверждением. `ALTER TABLE`, `systemctl restart`, `git push --force`, удаление файлов — всё требует `AskUserQuestion`-диалога. Auto-mode classifier и так это блокирует.
- Секреты (токены, пароли) — никогда не пишем в коммит, не пишем в чат, не отдаём наружу. Если случайно увидел чей-то токен в `.env` — игнорируй и не повторяй.

### Технические уроки сессии 2026-05-20

- **Прод-build только через `scripts/safe-build.sh`** (или ручная команда `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`). Прямой `ssh ... 'corepack pnpm run build:raw'` умирает посередине prerender'а при SSH-disconnect.
- **`pnpm run build` использует watchdog с idle 180s** — Next.js 15 молчит дольше. Использовать `build:raw`.
- **`systemd-run` без `--uid=valstan`** взлетает от root и берёт глобальный pnpm 11 (несовместимый с проектом). ALWAYS `--uid=valstan --gid=valstan`.
- **На проде нет `push:true`-миграции.** Новые поля в коллекциях нужно вручную `ALTER TABLE ADD COLUMN ...` ИЛИ создать proper Payload migration в `web/src/migrations/`.
- **Прямой UPDATE/INSERT в БД** минует Payload `afterChange`-хуки и не сбрасывает `unstable_cache`. После таких правок — `systemctl restart gonba`.
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
