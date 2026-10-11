# Session Handoff

**Status:** IDLE
**Updated:** 2026-10-11 (дополнено после красного прогона 38127781755)
**Branch:** main
**Прод:** на `origin/main` (`63eacdb`, PR #278) — run `38128728711`, completed/success, ШАГ «Generate Payload import map — гейт на артефакт ДО сборки» в логе: `importMap.js до сборки: 8099 байт`; local/CDN health 200, маркер 1 вхождение. Проверка деплоя: `gh run list --workflow=deploy-prod.yml --limit 1` (ждём `completed` — G24).

---

## Текущая нитка

Ниток нет — сессия 11.10 закрыта полностью: stale-триаж + инцидент молчащего importmap (второе повторение) + гейт-лечение. Три PR (#276, #277, #278), все смержены и выкачены.

## Следующий шаг

Всё висит на шаге владельца: топ-ап DeepSeek (блокер вердиктов VK), план «Афиша из VK» (принять/отклонить), раннеры Ubuntu 26 (`due: 2026-10-19` — после 19.10 смотреть первый прогон), reboot для ядра 6.8.0-146, ротация SSH CI-ключа (до 2026-11-08), #057 security-аудит (30.11). ✅ Снос 16-кластера закрыт 11.10 по слову владельца.

## Контекст

- **PG16 снесён (11.10, слово владельца):** откат-кластер D-118 удалён после проверки 17.11 (все базы, таймеры, мета-юнит enabled); дамп `pg16-pre17-20261008-1112.sql.gz` остался в `/home/valstan/backups/`. Подробности — в пункте backlog `in-progress.md`.
- **Грабля окна на боксе (11.10):** `systemd-run` из неинтерактивной ssh-сессии падает на «Interactive authentication required» (polkit для transient units); один запуск формально стартовал («Running as unit…»), но ExecStart не исполнил ничего (17ms CPU, пустой журнал). Секундные операции — напрямую скриптом с живым выводом; долгие окна — как раньше, но проверять `journalctl -u` + эффект, а не только статус юнита.
- **PR #276 (`f2e6327`):** `defaults.run.shell: bash` в `ci.yml` + `deploy-prod.yml` (G322); три точки деградации получили `|| true`/`{ …; }` (KARMAN-ассертация, smoke `/projects`, контент-маркер); AGENTS.md: one-off tsx только с `NODE_ENV=production`; закрыты «shell: bash», «tsx-конвенция», «сверка юнитов» (0 расхождений по 5 юнитам на боксе). Приёмка деплоем: run `38126543283`, в логе все 16 run-шагов под `bash -e -o pipefail {0}`.
- **PR #277 (`6772ccd`, docs):** handoff + дубль `jobs.access.run` закрыт (починен ещё в #252). **Его деплой упал** — run `38127781755`: молчащий `generate:importmap` внутри `build:raw` (ноль строк, exit 0) → `next build` упал на `../importMap`. Прод не тронут (падение до Ship; на боксе остался `f2e6327`, `is-active`). Побочно подтверждено: docs-only PR тоже гоняет сборку — «безопасных» PR нет.
- **PR #278 (`63eacdb`):** лечение — `generate:importmap` отдельным шагом ПЕРЕД Build + гейт на артефакт (в обоих workflow). Приёмка деплоем: `38128728711` success, `importMap.js до сборки: 8099 байт`. Урок: гейт результата ПОСЛЕ шага-потребителя декоративен (тот же экземпляр класса #228). Письмо brain — `mailbox/to-brain/2026-10-11-result-gate-after-consumer-is-decorative.md` (idea, suggest).
- **`gh` на этой машине:** `C:\Program Files\GitHub CLI\gh.exe` (путь из старых хендофтов — AppData — устарел). `--jq "…+…"` в PowerShell рвётся. Логи с кириллицей из `gh run view --log`: `| Out-File -Encoding utf8`, читать UTF8 (прямой grep в PowerShell ловит мохибейк — совпадения по кириллице не находятся).
- **Локальные гейты на Windows:** `npm run typecheck/lint` падают в PowerShell (POSIX-префикс `NODE_OPTIONS=`) — `npx tsc --noEmit` + `npx eslint .` из bash.

## Не забыть (low-priority)

- **Машина COMPUTER-20261008 (эта):** локального Postgres **нет вовсе** — DB-suite'ы падают локально на `ECONNREFUSED:5432`, в CI зелёные. Гейт по чистым функциям гонять локально; полный прогон — другая машина.
- **PowerServer-грабли сессии:** `git`/`npm` пишут в stderr → красный `NativeCommandError` при exit 0 — код выхода проверять `$LASTEXITCODE`. Консоль врёт про UTF-8 (кириллица в curl-выводе — мохибейком; проверять байты через `read`).
- **Ротация SSH наполовину (с 09.10):** новый ключ `gonba-deploy@COMPUTER-20261008` пускает только с этой машины; CI ходит старым `...@PC40-20260810` из GH secret `SSH_PRIVATE_KEY` — до зелёного штатного деплоя старую строку из `authorized_keys` НЕ снимать.
- **Проверка пуша:** «push timed out» ≠ успех — всегда `git ls-remote <ref>` + сверка SHA.
- **Снос 16-кластера** — пункт с `due: 2026-10-16` в `docs/followups/in-progress.md`, только со словом (деструктив #025).
- **`web/next-env.d.ts`** переписывается при локальном `lint`/`build` — после гейтов `git status` и откат.
- **Авто-мерж в репозитории выключен** — merge только руками; с 02.10 protection требует `--admin` (осознанно).
- **Stale-триаж не закрыт:** литерал SARAFAN-шлюза ждёт шага владельца; root cause молчащего importmap — не доведён (пункт в tech-debt проснулся: теперь «watch»). Watch-уровень: `sharp`/`postcss` high (оба — мажоры), security-аудит #057 (30.11).
- **fwupd failed** — решение владельца оставить; **trener-sandbox-probe2/3 failed** — чужие юниты, только доложить.
- **На боксе лежит чужой `/tmp/prod-cleanup.sh`** — общий бокс, не трогать.
- **Окна на боксе — скриптом-файлом через `systemd-run --remain-after-exit` с логом**; fail-ветка обязана поднимать сервис (AGENTS.md).

---

> Sticky note — сессия 11.10: stale-триаж закрыт (#276), дубль снят (#277, его деплой красный из-за флейка importmap — прод не тронут), лечение гейтом #278 + зелёный деплой. Status IDLE. Следующий содержательный шаг — за владельцем (DeepSeek/снос 16/афиша/reboot/SSH).

## Не забыть (low-priority)

- **Машина COMPUTER-20261008 (эта):** локального Postgres **нет вовсе** — DB-suite'ы падают локально на `ECONNREFUSED:5432`, в CI зелёные. Гейт по чистым функциям гонять локально; полный прогон — другая машина.
- **Локальные гейты на Windows:** `npm run typecheck/lint` падают в PowerShell (POSIX-префикс `NODE_OPTIONS=`) — гонять `npx tsc --noEmit` и `npx eslint .` из bash, либо настроить `git config --global core.scriptShell`.
- **PowerServer-грабли сессии:** `git`/`npm` пишут в stderr → красный `NativeCommandError` при exit 0 — код выхода проверять `$LASTEXITCODE`. Консоль врёт про UTF-8 (кириллица в выводе — мохибейком; проверять байты через `read`).
- **Ротация SSH наполовину (с 09.10):** новый ключ `gonba-deploy@COMPUTER-20261008` пускает только с этой машины; CI ходит старым `...@PC40-20260810` из GH secret `SSH_PRIVATE_KEY` — до зелёного штатного деплоя старую строку из `authorized_keys` НЕ снимать.
- **Проверка пуша:** «push timed out» ≠ успех — всегда `git ls-remote <ref>` + сверка SHA.
- **Снос 16-кластера** — пункт с `due: 2026-10-16` в `docs/followups/in-progress.md`, только со словом (деструктив #025).
- **`web/next-env.d.ts`** переписывается при локальном `lint`/`build` — после гейтов `git status` и откат.
- **Авто-мерж в репозитории выключен** — merge только руками; с 02.10 protection требует `--admin` (осознанно).
- **Stale-триаж не закрыт:** литерал SARAFAN-шлюза ждёт шага владельца. Watch-уровень: `sharp`/`postcss` high (оба — мажоры), `generate:importmap` root-cause не доведён, security-аудит #057 (30.11).
- **fwupd failed** — решение владельца оставить; **trener-sandbox-probe2/3 failed** — чужие юниты, только доложить.
- **На боксе лежит чужой `/tmp/prod-cleanup.sh`** — общий бокс, не трогать.
- **Окна на боксе — скриптом-файлом через `systemd-run --remain-after-exit` с логом**; fail-ветка обязана поднимать сервис (AGENTS.md).

---

> Sticky note — сессия 11.10: stale-триаж (#276), дубль `jobs.access.run` (#277), гейт importMap до сборки (#278), письмо brain (#279). Слово владельца исполнено: 16-кластер снесён после полной проверки 17.11, дамп до-апгрейда остался. Status IDLE. Следующий содержательный шаг — за владельцем (DeepSeek/афиша/reboot/SSH; снос 16 закрыт).
