# Session Handoff

**Status:** IDLE
**Updated:** 2026-10-11 (финал сессии)
**Branch:** main
**Прод:** на `origin/main` (`04279c1`) — последний деплой run `38159715619`, completed/success; health 200. Проверка деплоя: `gh run list --workflow=deploy-prod.yml --limit 1` (ждём `completed` — G24).

---

## Текущая нитка

Ниток нет — сессия 11.10 закрыта полностью: слово владельца исполнено (16-кластер снесён), три технических долга закрыты (shell:bash G322, гейт FK-мин G135, sharp/postcss high), осиротевший GH-секрет удалён. Восемь PR (#276–#285), все смержены и выкачены. Следующий содержательный шаг — за владельцем.

## Следующий шаг

Всё висит на шаге владельца: топ-ап DeepSeek (блокер вердиктов VK), план «Афиша из VK» (принять/отклонить), раннеры Ubuntu 26 (`due: 2026-10-19` — после 19.10 смотреть первый прогон), reboot для ядра 6.8.0-146, ротация SSH CI-ключа (до 2026-11-08), #057 security-аудит (30.11), литерал SARAFAN-шлюза (`SARAFAN_GATEWAY_URL`, #025), KARMAN recovery (bootstrap-токен).

## Контекст (сессия 11.10)

- **PR #276 (`f2e6327`):** `defaults.run.shell: bash` в `ci.yml` + `deploy-prod.yml` (G322 — конвейер падает на раннем звене); три точки деградации с `|| true`/`{ …; }`; канон `NODE_ENV=production` для one-off tsx; закрыты stale-пункты. Приёмка деплоем: 16 шагов под `bash -e -o pipefail {0}`.
- **PR #277 (`6772ccd`, docs):** дубль `jobs.access.run` закрыт (был починен в #252). **Его деплой упал** — `38127781755`: молчащий `generate:importmap` внутри `build:raw` → `next build` упал на `../importMap`. Прод не тронут (падение до Ship).
- **PR #278 (`63eacdb`):** лечение — `generate:importmap` отдельным шагом ПЕРЕД Build + гейт на артефакт. Приёмка: `38128728711` success, `importMap.js до сборки: 8099 байт`. Урок: гейт результата ПОСЛЕ шага-потребителя декоративен (#228). Письмо brain отправлено.
- **PR #281 (`2765602`):** гейт FK-мин G135 — `web/scripts/scan-fk-mines.ts` + allowlist (9 мин) + CI-шаг после Integration tests; классификация в `src/utilities/classifyFkMines.ts` (6 юнит-кейсов; отделена от скрипта, иначе `PAYLOAD_MIGRATING=true` травил бы env остальным int-тестам). Первый прогон: «в схеме: 9; в allowlist: 9 ✅». Факт: guard `IF NOT EXISTS` в миграции `20260710_120000` подменил CASCADE-лечение no-op'ом.
- **PR #283 (`548cd0b`):** deps — `sharp` 0.34.2→0.35.5 (адвизори дорос до librsvg; дерево было с двумя sharp'ами — стало одним), `postcss` через `overrides {"next":{"postcss":"8.5.28"}}` (глобальный override = EOVERRIDE; flat не парсится; nested ложится только при пересборке локе), `next` 15.5.27, `source-map-js` попутно. Audit `--omit=dev`: 19 (11 high) → 16 (9 high). Приёмка на проде: `/_next/image` байт-в-байт baseline, tailwind-чанк несёт `display:flex` + `--tw-*`.
- **PG16 снесён (слово владельца):** `pg_dropcluster 16 main --stop`, rc=0; проверка 17.11 исчерпывающая (все базы, таймеры, мета-юнит enabled); дамп `pg16-pre17-20261008-1112.sql.gz` сохранён. Лог окна — `/home/valstan/pg16-drop-20261011.log`.
- **SECRETS_TOKEN удалён из GH secrets:** осиротевший секрет неизвестного происхождения (с 10.08); доказано, что никто не читает; DELETE 204 → GET 404; следующий деплой прошёл (контур не пострадал).
- **braces high — сознанная приёмка:** последняя версия 3.0.3, фикса нет; `chokidar ~3.0.2` блокирует override; даунгрейд next-sitemap закрыл бы только одну из двух цепочек. Build-time-only, входы — наш же CSS.
- **Грабля окна на боксе:** `systemd-run` из неинтерактивной ssh-сессии падает на polkit; один юнит формально стартовал, но молчал (17ms CPU). Секундные операции — напрямую с живым выводом; долгие окна — с проверкой `journalctl -u` + эффекта.
- **Машинные заметки:** `gh` на этой машине — `C:\Program Files\GitHub CLI\gh.exe` (путь AppData в старых хендофтах устарел); `--jq "…+…"` и `2>/dev/null` в PowerShell рвутся; логи с кириллицей читать через UTF8; `npm run typecheck/lint` гонять через `npx tsc --noEmit` + `npx eslint .` из bash.

## Не забыть (low-priority)

- **Машина COMPUTER-20261008 (эта):** локального Postgres **нет вовсе** — DB-suite'ы падают локально на `ECONNREFUSED:5432`, в CI зелёные. Полный прогон — другая машина.
- **Ротация SSH наполовину (с 09.10):** новый ключ пускает только с этой машины; CI ходит старым — до зелёного штатного деплоя старую строку из `authorized_keys` НЕ снимать.
- **Проверка пуша:** «push timed out» ≠ успех — всегда `git ls-remote <ref>` + сверка SHA.
- **`web/next-env.d.ts`** переписывается при локальном `lint`/`build` — после гейтов `git status` и откат.
- **Авто-мерж выключен** — merge только руками; с 02.10 protection требует `--admin` (осознанно).
- **Остались high:** `braces` (цепочки Payload/next-sitemap — без фикса в природе, принято) и `undici` ×9 (собственный dep Payload; «фикс» = даунгрейд — отвергнут). `esbuild` — dev-only, фикса нет. Watch: `generate:importmap` root-cause не доведён; security-аудит #057 (30.11).
- **fwupd failed** — решение владельца оставить; **trener-sandbox-probe2/3 failed** — чужие юниты, только доложить.
- **На боксе лежит чужой `/tmp/prod-cleanup.sh`** — общий бокс, не трогать.
- **Окна на боксе — скриптом-файлом через `systemd-run --remain-after-exit` с логом**; fail-ветка обязана поднимать сервис (AGENTS.md).

---

> Sticky note — сессия 11.10 закрыта: восемь PR (#276–#285), 16-кластер снесён, G135-гейт + sharp/postcss high закрыты, SECRETS_TOKEN удалён, braces high принят сознательно. Status IDLE. Следующий содержательный шаг — за владельцем (DeepSeek/афиша/reboot/SSH/Ubuntu-26/#057).
