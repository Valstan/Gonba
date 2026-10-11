# Session Handoff

**Status:** IDLE
**Updated:** 2026-10-11
**Branch:** main
**Прод:** на `origin/main` (деплой doc-PR будет добавлен); предыдущий релиз `f2e6327` (PR #276) — run `38126543283`, completed/success. Проверка деплоя: `gh run list --workflow=deploy-prod.yml --limit 1` (ждём `completed` — G24).

---

## Текущая нитка

Ниток нет — сессия 11.10 закрыла stale-триаж и дубль backlog'а: PR #276 (`shell: bash` во всех workflow + канон `NODE_ENV=production` для one-off tsx + три пункта backlog) и PR-закрытие дубля `jobs.access.run`. Всё замержено, прод зелёный, `pipefail` подтверждён в живом логе деплоя.

## Следующий шаг

Всё висит на шаге владельца: топ-ап DeepSeek (блокер вердиктов VK), слово на снос 16-кластера (`due: 2026-10-16`), план «Афиша из VK» (принять/отклонить), раннеры Ubuntu 26 (`due: 2026-10-19` — после 19.10 смотреть первый прогон), reboot для ядра 6.8.0-146, ротация SSH CI-ключа (до 2026-11-08), #057 security-аудит (30.11).

## Контекст

- **Сессия 11.10 (PR #276, `f2e6327`):** `defaults.run.shell: bash` в `ci.yml` + `deploy-prod.yml` (G322: конвейер теперь падает на РАННЕМ звене); три точки с осознанной деградацией получили `|| true` / `{ …; }` — KARMAN-ассертация, smoke `/projects`, контент-маркер; AGENTS.md: one-off tsx только с `NODE_ENV=production`; закрыты backlog-пункты «shell: bash», «tsx-конвенция», «сверка юнитов» (замер: 0 расхождений по 5 юнитам).
- **Приёмка PR #276 деплоем (не рассуждением):** run `38126543283` — все 16 run-шагов в логе `shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}`, маркер 1 вхождение, local/CDN health 200, `/projects` 308 → `/#projects`. Живой прод после: health 200, маркер на главной найден.
- **Дубль backlog снят:** `jobs.access.run` (пункт от 18.09) — уже починен в PR #252 (`4b216b4`, аудит write-authz #015); закрыт как дубль F-строки.
- **`gh` на этой машине:** `C:\Program Files\GitHub CLI\gh.exe` (путь из AppData в прошлых хендофтах устарел — `Get-Command gh` находит только Program Files). PowerShell-замечание: выражения `--jq "…+…"` рвутся — без строковых склеек.

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

> Sticky note — сессия 11.10: stale-триаж закрыт (PR #276 + зелёный деплой с подтверждённым pipefail в логе), дубль `jobs.access.run` снят. Status IDLE. Следующий содержательный шаг — за владельцем (DeepSeek/снос 16/афиша/reboot/SSH).
