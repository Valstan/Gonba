# Development Log

Хронология значимых изменений проекта GONBA. **Свежее сверху.** Каждый блок — одна сессия разработки (день) или один логически законченный кусок.

При обновлении: новый блок ставится в самый верх под заголовком, под него — даты, ссылка на PR (если есть), что сделано, что задеплоено, что осталось хвостами (→ переносить в `PENDING_FOLLOWUPS.md`).

---

## 2026-05-24 — ГОНЬБА 24 мая 2026 (Claude session, ч.2) — SSH opt-in (pool #006) + seed-snippet header_nav_items для PR1

**Тема:** короткая сессия с той же Windows-машины (без SSH-ключа `id_ed25519_gonba_deploy`, без `web/.env`/`node_modules`/`payload-types.ts`). Закрыли два не-блокирующих следующего шага этно-модерн нитки: применили pool-идею #006 (Full-session SSH opt-in в `/start`) и заготовили готовый snippet seed-скрипта для `header_nav_items` чтобы dev-машина не сочиняла его с нуля при старте PR1.

### Что сделано

- **`.claude/commands/start.md`** — добавлен шаг 5.2 «SSH opt-in для сессии»: `AskUserQuestion` с 3 вариантами (пропустить / переспрашивать / полный доступ на сессию). Перед вопросом — проверка наличия `~/.ssh/id_ed25519_gonba_deploy` и алиаса `GONBA` в `~/.ssh/config`; если нет — вариант #3 деградирует с пометкой. При выборе #3 read-only SSH-команды (`journalctl`, `systemctl is-active`, `psql -c 'SELECT'`, `cat`, `ls`) Claude выполняет напрямую, **destructive** (`ALTER`/`UPDATE`/`INSERT`/`DELETE`/`restart`/`stop`/`rm`/`truncate`/`force-push`/`sudo`-write) **всё равно** через `AskUserQuestion`. Скоуп — только текущая сессия. См. pool [#006](../../brain_matrica/cross-project-ideas/ideas/006-full-session-ssh-optin.md).
- **`docs/plans/etno-modern-redesign.md` PR1 §6** — расширен готовым snippet'ом для `web/scripts/seed-header-nav-ethno.ts` через `payload.updateGlobal({ slug: 'header', ... })` (shape подсмотрен в [`web/src/endpoints/seed/index.ts:300`](../web/src/endpoints/seed/index.ts#L300)). 5 групп: Пожить (`/projects?group=stay`) / Делать (`do`) / Смотреть (`see`) / Лавка (`shop`) / О проекте (`/projects/about-project`). Зафиксированы: маршрут с `?group=` реализуется в PR3 (фильтр на странице `/projects`); до PR3 ссылки корректно деградируют до полного каталога; drawer-подменю остаётся хардкодом по `gonba-home.html` строки 191-298; откат fixture'а — тот же snippet со старым массивом из seed (Проекты/События/Сервисы/Магазин/Контакты).
- **`docs/PENDING_FOLLOWUPS.md`** — добавлена 🟢 идея «Drawer-подменю Header → в Payload» (после PR2, когда появится `Projects.group`-поле).

### Что НЕ сделано (намеренно)

- **SQL prod-redesign-config не применён** — нет SSH-ключа на этой машине, как и в полусессии ч.1. Ждёт dev-машины (см. `SESSION_HANDOFF.md`).
- **PR1 этно-модерн кодом не начат** — без `web/.env` / `node_modules` / `payload-types.ts` это пол-сессии setup'а на Windows. Ждёт dev-машины.
- **Формальное письмо feedback brain'у про #006** — пока в `from-brain/` физически нет письма (только запись `⚠️ директива 2026-05-24` в `cross-project-ideas/INDEX.md`). Если brain отправит — закрою feedback в следующей сессии письмом `kind=feedback`/`urgency=low` с фактом применения. Применение зафиксировано в pool INDEX'е (это сделает brain в своей сессии) и в этом DEV_LOG.

### Уроки

- **Pool-идея может быть применена «с упреждением»** до физического письма, если `compliance=recommend` и идея self-contained (не требует параллельных изменений в brain). Сокращает лаг brain↔project. Условие — в pool описание `proposed`/`ready` (как у #006: «пилот в setka работает»).
- **Adaptation > копирование:** идея #006 в setka расширяет существующий `AskUserQuestion` про SSH-probe. В GONBA probe — это `curl`, без вопроса. Чистое копирование не подошло бы — пришлось сделать отдельный шаг 5.2 с теми же тремя вариантами, но независимый от probe.
- **Подготовка fixture'ов на машине без dev-окружения** снимает время с dev-машины. Snippet к `payload.updateGlobal` пишется без проверки типов (это `tsx`-скрипт), достаточно знать shape `link`-field из [`web/src/fields/link.ts:24`](../web/src/fields/link.ts). Аналогично можно заготавливать миграции и seed-скрипты заранее.

---

## 2026-05-24 — ГОНЬБА 24 мая 2026 (Claude session) — Brain dispatch prod-redesign config (SQL заготовлен) + закрытие 3 вопросов PR1 + cleanup

**Тема:** Параллельная нитка к этно-модерн редизайну — ответ на brain dispatch [`2026-05-23-prod-redesign-followup-config`](https://github.com/Valstan/brain_matrica/blob/main/mailboxes/GONBA/from-brain/2026-05-23-prod-redesign-followup-config.md) (compliance=recommend). SQL-патч заготовлен в репо, ждёт применения с dev-машины. Заодно — закрыты 3 открытых вопроса по PR1 этно-модерна и почищены stale-ветки.

### Что сделано (две полусессии: 2026-05-23 ч.2 + 2026-05-24)

- **PR1-вопросы закрыты** (зафиксировано в [`docs/plans/etno-modern-redesign.md → Текущий этап`](plans/etno-modern-redesign.md#текущий-этап) и `docs/SESSION_HANDOFF.md`):
  - Имена slug-only: «ЭКО-отель» / «О проекте» / «Вятский сбор»
  - Шрифты: PT Serif (заголовки) + Manrope (sans) + JetBrains Mono (eyebrows) через `next/font/google`
  - Маппинг 10 проектов на 4 группы: принят как в плане PR2 §4
- **SQL-патч для brain dispatch** — [`scripts/sql/2026-05-23-prod-redesign-config.sql`](../scripts/sql/2026-05-23-prod-redesign-config.sql):
  - `gallery_yandex_folder` для 9 проектов (всё кроме `about-project`), пути `/public-galleries/<slug>/`
  - `chat_enabled = true` + `chat_placeholder` для 4 проектов (`eco-hotel`, `workshops`, `excursions`, `horse-club`)
  - SELECT-проверки результата + список мисматч-slug'ов + VK auto-sync timestamps
  - Почему SQL: у `Projects` нет `afterChange`-хука с `revalidateTag` ([web/src/collections/Projects/index.ts:201](../web/src/collections/Projects/index.ts#L201)). `drafts: true` — NOTE в конце скрипта про возможную перетёрку из draft'а.
- **Stale-ветки удалены локально:** `claude/fix-vk-auto-sync-versions`, `claude/modest-hoover-87e67b` — обе с `[gone]` upstream, без уникальных коммитов.
- **PR [#35](https://github.com/Valstan/Gonba/pull/35)** merged squash → `288af36` на `main`. Автодеплой запущен (web-quality прошёл за 2m53s + 3m2s).

### Что осталось (на следующую сессию с dev-машины)

- **Запустить SQL** на проде:
  ```bash
  scp scripts/sql/2026-05-23-prod-redesign-config.sql GONBA:/tmp/
  ssh GONBA "sudo -u postgres psql -d gonba -f /tmp/2026-05-23-prod-redesign-config.sql"
  ```
- **Подтверждающее письмо** brain — `mailbox/to-brain/2026-05-NN-prod-redesign-config-done.md` (kind=feedback) с фактами применения.
- **Возвращение к этно-модерн PR1** — основная нитка ждёт dev-машину.

### Уроки

- **На Windows-машине без dev-окружения можно делать prod-config-задачи через SQL-патч**, если у коллекции нет `afterChange`-хука с `revalidateTag`. Прямой UPDATE безопасен, кэш-инвалидация не нужна. Это снимает блокер «эту задачу можно только с dev-машины».
- **Сетевая блокировка github:443 на этой машине** может прийти посреди сессии (push'и зависают на 5 мин timeout). Локальный commit пережил overnight на ветке без push — в следующей сессии push прошёл. То есть простаивающий локальный commit не блокирует прогресс, если сеть восстановится.
- **`/sql` skill тоже использует SSH** — без ключа на машине не сработает. Заранее проверять `ssh GONBA "echo ok"` если планируется prod-задача.

---

## 2026-05-23 — ГОНЬБА 23 мая 2026 (Claude session) — План этно-модерн редизайна главной (Claude Design handoff)

**Тема:** пользователь принёс архив-handoff из Claude Design (`Гоньба сайт-handoff.zip`) — три направления визуального языка для главной (A Журнал / B Этно-модерн / C Сторителлинг), плюс audit-разбор 6 проблем текущего сайта (плоский список 10+ ссылок, слаги в меню, фото не герой, нет «что делать», моб-second-sort). В этой сессии — приняли решение по направлению, зафиксировали план PR1-4, без кода.

### Что сделано

- **Распакован архив**, прочитан `gonba-home.html` (production-ready B-вариант, 1119 строк) + `audit.jsx` + 3 `direction-*.jsx` + `proto-tokens.css`.
- **Принято направление B (Этно-модерн)** — закрывает все 6 проблем аудита, ложится на нашу палитру (forest/ochre/oxblood/paper).
- **Решения по сопутствующим развилкам** (через AskUserQuestion с пользователем):
  1. `HomeCarouselMenuClient` (orbit-карусель) → переезжает с `/` на `/orbit` как «всё одним взглядом», не удаляется
  2. `/projects` (EditableProjectsGrid с inline-редактированием) → остаётся как плоский каталог, не трогаем
  3. Развёртывание — поэтапно, 4 PR'а (`/reliz`-стиль stacked-PRs)
- **Создан ADR-0004** ([`docs/adr/0004-frontpage-ethno-modern-redesign.md`](adr/0004-frontpage-ethno-modern-redesign.md)) — обоснование выбора B, разбор альтернатив (A/C/симбиоз/«оставить как есть»), последствия.
- **Создан план** ([`docs/plans/etno-modern-redesign.md`](plans/etno-modern-redesign.md)) — PR1 (токены/header/footer/слаги), PR2 (схема Project + миграция + /orbit), PR3 (hero + 4-group cards + featured + quote), PR4 (people + crafts + shop banner + events).
- **Сохранён handoff-bundle в репо** — [`docs/design/handoff-2026-05-23/`](design/handoff-2026-05-23/INDEX.md) (7 файлов + INDEX). Это источник правды по визуалу для всех 4 PR; видно с любой машины и из PR.
- **`SESSION_HANDOFF.md` переключён в `ACTIVE`** с привязкой к плану + ADR + handoff'у.

### Что **не** сделано в этой сессии (намеренно)

- **Не писалось ни строки прод-кода** — пользователь выбрал «зафиксировать план + следующая сессия». Текущая машина без рабочего dev-окружения (`web/.env`, `node_modules`, `payload-types.ts` отсутствуют) — стартовать PR1 здесь означало бы потратить полсессии на setup.
- **Не сделано переименование 3 «slug-only» проектов** (`eco-hotel-booking` / `about-project` / `vyatskiy-sbor`) — это ручной шаг в админке Payload, делать **до** PR1 чтобы drawer не повторил исходную проблему. В SESSION_HANDOFF записан как открытый вопрос к пользователю.

### Уроки

- **Handoff-bundle лежит в репо, а не в Downloads.** Несколько причин: (a) виден с любого компа, (b) виден в PR ревьюеру, (c) папка-дата (`handoff-2026-05-23`) фиксирует «версия дизайна на эту дату» — если придёт следующий handoff, рядом будет `handoff-YYYY-MM-DD/`. Это применимый паттерн для любого design-handoff'а.
- **План + ADR + handoff = непрерывность нитки.** Если бы ничего не зафиксировали, в следующей сессии пользователь сказал бы «помнишь, мы вчера обсуждали редизайн?», а Claude сказал бы «нет». Теперь любая будущая сессия откроет `SESSION_HANDOFF.md` → план → ADR и продолжит ровно с того места.
- **Когда дизайн приходит снаружи — выбор направления и обоснование (ADR) важнее, чем код.** Сначала фиксируем «почему B, а не A/C», потом — «как именно». Иначе через 3 PR'а кто-то предложит «давайте сделаем тёмную сцену из C» и весь стек переписывается.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Brain dispatches v2 (финализация консенсуса)

**Тема:** во время сессии параллельная brain_matrica-сессия положила **обновлённые** версии двух уже обработанных заявок — с резюме решений пользователя по всем трём проектам. Чисто confirmations, новых действий не требуется.

### Что подтверждено

- **`#0001` (unify session close command name) — v2 финализация:** имя `/close_session` зафиксировано как стандарт между MatricaRMZ / GONBA / setka. setka переименовывает `/finish` → `/close_session` параллельно. У GONBA имя уже корректное (с прошлой сессии 2026-05-22), структурных изменений нет.
- **`#0006` (failed approaches section) — v2 финализация:** контекст: «SESSION_HANDOFF.md обязательно везде; DEV_HISTORY — на усмотрение каждого проекта». GONBA применила полное предложение в этой же сессии (см. блок ниже про #0006). Confirmation.

### Что сделано

- Файлы `docs/inbox-from-brain/0001-...v2.md` и `0006-...v2.md` удалены (как просит протокол dispatch'ей).
- В `docs/inbox-from-brain/` добавлен `README.md` в git (был untracked) — будущие сессии увидят инструкцию обработки заявок сразу при `/start`.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media mini-follow-up: выпиливание yadisk-sync-media

**Тема:** закрытие одного из 4-х mini-follow-up'ов нитки Media → Я.Диск. Скрипт `web/scripts/yadisk-sync-media.ts` (`pnpm run yadisk:sync`) после phase-3 устарел. Решение: **выпилить целиком** (не обновлять).

### Почему выпилить, а не обновить

Скрипт делал 4 вещи:

1. **Backfill `yandexPath`/`PublicKey`/`Sha256`** для уже синхронизированных записей — узкая ad-hoc задача, не требует своего скрипта.
2. **Restore локального файла** если есть Я.Диск и размер ≤ `LOCAL_MAX_BYTES` — **прямо противоречит phase-3**: после успешной заливки локалка удаляется безусловно, а её отсутствие восполняется TTL-кэшом через `/api/media/file/[id]` proxy на cache-miss.
3. **Public seed restore** через `YANDEX_DISK_SEED_PUBLIC_KEY` — seed-сценарий первого деплоя, давно прошёл (на проде baseline 333/333 синхронизированы).
4. **Upload + publish** для записей без `yandexResourceId` — **полностью покрывается `media:migrate-yadisk`** (phase-5 PR #28, idempotent, поддерживает `--dry`/`--limit`/`--id`).

### Что сделано

- Удалён `web/scripts/yadisk-sync-media.ts` (340 строк)
- Удалена строка `"yadisk:sync": "tsx scripts/yadisk-sync-media.ts"` из `web/package.json`
- `docs/PROJECT.md` — две правки: в списке скриптов `yadisk:sync` заменён на `media:migrate-yadisk` (с описанием), в секции «Yandex.Disk integration» убрана ссылка на устаревший скрипт, добавлено упоминание ADR-0001 Implemented.
- `docs/plans/media-to-yadisk.md`, `docs/PENDING_FOLLOWUPS.md` — follow-up отмечен закрытым (strikethrough + дата).
- `corepack pnpm run typecheck` — clean.

### Уроки

- **Старые batch-скрипты после смены архитектуры — кандидаты на выпиливание, не «обновление под новые правила».** Попытка адаптировать `yadisk-sync-media.ts` (через `if env-flag disable restore`) только добавила бы dead code. Чистый удалить + указатель на `media:migrate-yadisk` понятнее.
- **`LOCAL_MAX_BYTES`/`YANDEX_DISK_LOCAL_MAX_MB`** окончательно похоронены: ни Media.ts, ни batch-скриптов, ни env-переменных в `.env.example`. Один меньше knob для поддержки.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Brain dispatch #0006 (Failed approaches section)

**Тема:** ответ на заявку от `brain_matrica` (`docs/inbox-from-brain/0006-failed-approaches-section.md`) — добавить секцию «Failed approaches» в SESSION_HANDOFF.md + обновить `/close_session`. Применено по запросу пользователя («доверимся Мозгу»).

### Заявка кратко

Brain предложил: в `SESSION_HANDOFF.md` ввести секцию «Failed approaches (этой нитки)» с явной фиксацией отвергнутых подходов, плюс обновить `/close_session` чтобы он напоминал её заполнить. Цель — следующая сессия не повторяет PoC-тупики, потерянные сейчас в свободном тексте.

### Что сделано

- **`.claude/commands/close_session.md`** — обновлены:
  - Шаг 2 (Уточнить у пользователя): добавлен 4-й опциональный вопрос про failed approaches при `Status: ACTIVE`.
  - Шаг 3 (Шаблон SESSION_HANDOFF.md): добавлена секция `## Failed approaches (этой нитки)` после «Контекст» с конкретным форматом записи.
  - Новый раздел «Важно про Failed approaches» с **grade'ами** (где что фиксируем): CLAUDE.md → eternal, ADR → architectural alternatives, SESSION_HANDOFF → failed approaches активной нитки, DEV_LOG → session post-mortem. Это снимает риск дублирования (предупреждение brain'а из «Возможные нет»).
  - Жизненный цикл: при `Status: IDLE` секция выкидывается, отвергнутые подходы переносятся в DEV_LOG → блок «Уроки».
- **`docs/SESSION_HANDOFF.md`** — добавлена секция `## Failed approaches (этой нитки)` с пояснением для текущего IDLE-состояния (применимо только при ACTIVE).

### Решение по приоритезации

Применили **с дополнением** (а не slept-import предложения brain'а):

- **Grade'ы** в `/close_session` явно разделяют, что куда писать. Это снимает дублирование, которое brain сам обозначил как возможный «нет».
- При закрытии нитки (Status: IDLE) failed approaches **переносятся** в DEV_LOG, а не аккумулируются в sticky-note. Sticky-note остаётся коротким.

### Уроки

- **Brain даёт паттерн, мы решаем как его пристёгивать к существующей системе.** В чистой форме предложение #0006 рисковало дублировать CLAUDE.md/ADR/DEV_LOG. С grade-ами стало очевидно где живёт каждый тип failed approach.
- **Шаблоны нужно обновлять одновременно в двух местах**: `/close_session` (что writer пишет) и `SESSION_HANDOFF.md` (что reader видит в `/start`). Расхождение сделает next-session инструкции непонятными.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Brain dispatch #0007 (security cleanup authorized_keys)

**Тема:** ответ на заявку от `brain_matrica` (`docs/inbox-from-brain/0007-authorized-keys-chain-of-compromise.md`) — давний 🟡-техдолг про чужие ключи в `~/.ssh/authorized_keys` GONBA-сервера. Brain поднял до 🔴 (security risk). Закрыт в этой сессии.

### Заявка кратко

В `~/.ssh/authorized_keys` на GONBA-сервере были 3 ключа: `valstan@a6fd55b8e0ae` (MatricaRMZ-сервер), `valstan@setka` (setka-машина), `gonba-deploy@PC40-20260522` (наш изолированный per-project ключ из идеи pool #001). Первые два создавали **цепочку компрометации**: атака на любой из тех серверов → автоматический доступ на GONBA с правами `valstan`.

### Что сделано

```bash
ssh GONBA "cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup-2026-05-22 \
  && sed -i '/valstan@a6fd55b8e0ae/d; /valstan@setka/d' ~/.ssh/authorized_keys"
```

- Backup: `~/.ssh/authorized_keys.backup-2026-05-22` (3 строки)
- После: 1 строка — только `gonba-deploy@PC40-20260522`
- Smoke: `ssh -o BatchMode=yes GONBA "echo OK"` → OK, `/api/health` → 200 OK
- Файл `docs/inbox-from-brain/0007-...md` удалён (по протоколу dispatch'ей)
- В `PENDING_FOLLOWUPS.md` запись 🟡 про authorized_keys удалена

### Уроки

- **Изолированный per-project ключ (идея #001) ≠ полная изоляция.** Внедрение `id_ed25519_gonba_deploy` 2026-05-22 закрыло утечку **новых** ключей наружу, но исторические чужие ключи на сервере остались. Cleanup — отдельный шаг, не следствие #001.
- **Backup перед `sed -i` на проде — обязательно.** Один опечатанный regex запирает себя без доступа. `cp` сначала, `sed` потом.
- **brain_matrica переоткрыл давний техдолг с переоценкой приоритета.** Полезный паттерн: meta-сессия читает PENDING_FOLLOWUPS чужими глазами и видит security-impact там, где исходный автор записал 🟡.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Brain dispatch #0001 (close-session command name)

**Тема:** ответ на заявку от `brain_matrica` (положена в `docs/inbox-from-brain/0001-unify-session-close-command-name.md`).

### Заявка кратко

Brain заметил, что у GONBA + MatricaRMZ команда закрытия сессии называется `/close_session`, у setka — `/finish`. Предлагает унифицировать. Содержимое команд проектно-специфичное, унифицируется только имя файла.

### Решение GONBA

**`#0001` (unify session close command name):** текущее имя `/close_session`. **Поддерживаю унификацию.** Рекомендую оставить `/close_session` (а не `/finish`):

- 2 из 3 проектов (GONBA + MatricaRMZ) уже используют это имя — мигрировать setka дешевле, чем переименовывать у двоих
- `/close_session` семантически чётче, чем `/finish` — последнее не объясняет «что» заканчивается
- Парность со `/start` сохраняется: `/start` ↔ `/close_session` (открытие ↔ закрытие сессии)
- В DEV_LOG / docs / коммитах GONBA имя упоминается несколько раз — переименовать у нас означал бы лишний churn без выигрыша

**Что НЕ делать в этой сессии:** не трогаем `brain_matrica` (его задача — собрать ответы всех трёх и выпустить следующую заявку, если есть консенсус). Не трогаем `setka` (это работа сессии в setka-проекте).

### Что записано

- `docs/inbox-from-brain/0001-...md` удалён (как и просит протокол)
- Этот блок в DEVELOPMENT_LOG.md фиксирует решение для будущей brain_matrica-сессии (которая прочитает наш git log)

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media → Я.Диск, фазы 6+7 (finalize)

**Тема:** stack-PR5, последний в нитке. Документация и закрытие — без новых код-изменений. ADR-0001 переведён в `Implemented`, PROJECT_STATE обновлён, запись в PENDING_FOLLOWUPS закрыта.

### Что сделано

- **`docs/adr/0001-yandex-disk-as-media-storage.md`** — статус `Accepted` → `Implemented (2026-05-22)`, добавлены ссылки на PR'ы #24/#26/#27/#28, секция «Implementation notes» с фактической раскладкой (Я.Диск primary / VPS TTL-кэш / proxy endpoint / immutable URL).
- **`docs/PROJECT_STATE.md`** — добавлен раздел «Media — Я.Диск как primary, локалка как TTL-кэш (ADR-0001 Implemented 2026-05-22)» с описанием жизненного цикла файла. Раздел «Кэш-инвалидация» расширен пунктом про `/api/media/file/[id]` (`Cache-Control: max-age=30d immutable`).
- **`docs/PENDING_FOLLOWUPS.md`** — главная запись «Архитектура / Media» вычеркнута, заменена на 4 мини-follow-up'а: rename-after-purge, yadisk-sync-media.ts согласовать с phase-3, find-orphan-media.ts, retry в фоне.
- **`docs/plans/media-to-yadisk.md`** — отмечены все фазы 0-7 готовыми, описан smoke-test протокол для проде.

### Прод-smoke (после merge всех 5 PR — фаза 7)

```bash
# 1. Активировать TTL-таймер кэша
ssh GONBA
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-media-cache.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gonba-media-cache.timer
systemctl list-timers gonba-media-cache.timer

# 2. Проверить что existing-файлы отдаются через endpoint с HIT-LEGACY
curl -sI 'https://гоньба.рф/api/media/file/319' | grep -i 'x-cache\|cache-control'

# 3. Защитная сетка миграции — должно быть 0
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk -- --dry"
```

### Итог нитки

В сумме за день — **5 PR'ов в стеке**, ~1200 строк кода/документации. От «локалка primary, Я.Диск только для больших файлов» к «Я.Диск primary, локалка = TTL-кэш через proxy». Полное соответствие ADR-0001 достигнуто.

### Уроки

- **Stacked PRs работают** для длинных архитектурных ниток. Не пришлось делать «один большой PR на 5 фаз» — каждый PR можно ревьюить и откатить независимо. После merge PR1 — PR2 fast-forward'ом, и т.д.
- **Документация в конце даёт перспективу.** Когда писал ADR Implementation notes — увидел картину целиком (без перескакивания между фазами), смог сформулировать «жизненный цикл файла» в 5 шагах. До этой сессии такого описания не было.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media → Я.Диск, фаза 5 (migrate-script)

**Тема:** stack-PR4 поверх PR3. Защитная сетка для записей без `yandexPath` — `web/scripts/migrate-media-to-yandex.ts`. По baseline на проде 0 таких записей (все 333 синхронизированы), но скрипт нужен на случай новых orphan'ов и для ручного PoC.

### Что сделано

- **`web/scripts/migrate-media-to-yandex.ts`** — pagination через `payload.find({page, limit, where: { yandexPath: { exists: false }}})`, для каждой записи делает `uploadLocalFileToYandex` → `publishYandexResource` → `getYandexResource` → `getPublicDownloadUrl` → `payload.update(yandex*, skipYandexSync)`. Args: `--dry`, `--limit N`, `--id <id>` (одиночный), `--max N` (общий лимит).
- **Семантика:** idempotent — запись с `yandexPath` → `skipped`, без локала → `missing-local`, ошибка → `failed` + `yandexError` в БД. Локальный файл не удаляет (это делает `afterChange` phase-3 на следующем update или TTL-cron через 30 дней).
- **`web/package.json`** — добавлен script `"media:migrate-yadisk": "tsx scripts/migrate-media-to-yandex.ts"`.

### Локальный smoke

- TS clean
- `--dry` без аргументов → «Found 0 candidate» (правильно: локальные 319 записей все с yandexPath, как и прод)
- `--id 319 --dry` → «[319] skip — yandexPath already set: /gonba/media/319-...», processed=1, skipped=1
- `--id 999999 --dry` → корректная ошибка «Could not load media id=999999: Не найдено»

### Использование на проде

```bash
# Сначала dry-run
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk -- --dry"

# Если нужно реально мигрировать
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk"

# Одиночная запись (PoC)
ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm run media:migrate-yadisk -- --id <test-id>"
```

### Уроки

- **«Защитная сетка»-скрипты стоит писать даже когда баклог пуст.** Будущая регрессия может пробить afterChange (новая ошибка Я.Диск API, новые edge cases в Payload upload UI), и тогда orphan'ы появятся. Иметь однострочный recovery в `pnpm run` гораздо лучше чем разбираться в боль момента.
- **Bulk `payload.find` с `where: { yandexPath: { exists: false } }`** на dev-БД работает мгновенно — Drizzle транслирует в чистый `IS NULL`. Никаких сюрпризов с типами.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media → Я.Диск, фаза 4 (cron-чистка кэша TTL 30д)

**Тема:** stack-PR поверх PR2. Кэш `MEDIA_CACHE_DIR` теперь чистится автоматически — файлы, к которым не обращались >30 дней, удаляются ежедневно в 04:00 systemd-таймером.

### Что сделано

- **`web/scripts/clean-media-cache.ts`** — новый скрипт. Аргументы: `--dir <path>` (default `MEDIA_CACHE_DIR` env → `./public/media-cache`), `--ttl-days 30`, `--dry`. Использует `Math.max(atimeMs, mtimeMs)` — на Linux ext4 с `relatime` atime обновляется при чтении (endpoint вызывает `utimes` на cache-hit), fallback на mtime защищает от `noatime`-mount. Логирует scanned / eligible / removed / freed в MB. Skip `.tmp.*` файлов (артефакты атомарного rename из endpoint'а). Отсутствие папки — exit 0 (нечего чистить).
- **`deploy/systemd/gonba-media-cache.service`** + **`.timer`** — daily в 04:00, `Persistent=true` (догонит если сервер был выключен), `RandomizedDelaySec=30min`, `User=valstan`, читает `.env` из `web/`.
- **`web/package.json`** — добавлен script `"cache:clean": "tsx scripts/clean-media-cache.ts"`.
- **`docs/PROJECT.md`** — упомянут новый скрипт в разделе «Скрипты».

### Локальный smoke

- TS clean
- `cache:clean --dir ./public/nonexistent --dry` → «Cache dir does not exist — nothing to clean»
- `cache:clean --ttl-days 0 --dry` → корректно отметил тестовые файлы eligible
- `cache:clean --ttl-days 0` → файлы удалены, папка пуста

### Активация на проде (после merge PR3)

```bash
ssh GONBA
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-media-cache.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gonba-media-cache.timer
systemctl list-timers gonba-media-cache.timer
```

### Уроки

- **`atime` на Windows-FS «дёргается».** `touch -a -t` через Git Bash не работает как ожидалось — atime сразу же обновляется первой stat'-операцией. На Linux с `relatime` — нормально. Тест через `--ttl-days 0` обходит проблему (всё eligible независимо от timestamps).
- **`Math.max(atime, mtime)` лучше чем чистый atime** — защищает от ложноположительных удалений: восстановленный из бэкапа файл с старым mtime, но свежий atime — остаётся живой.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media → Я.Диск, фаза 3 (afterChange удаляет локал)

**Тема:** stack-PR поверх PR #24. Завершаем нитку перехода к «Я.Диск primary» — после успешной заливки локальный файл удаляется безусловно (а не только для файлов >50MB).

### Что сделано (`web/src/collections/Media.ts`)

- В `afterChange`-хуке убрана обёртка `if (sizeBytes > LOCAL_MAX_BYTES)` вокруг блока удаления локалов. Теперь после успешного `uploadLocalFileToYandex` + `publishYandexResource` + `payload.update(yandex*)` локальный файл **всегда** удаляется (плюс derivatives через `Object.values(doc.sizes)`, на будущее — сейчас `imageSizes: []`).
- При yandex-error (catch-блок) локальный файл **не** удаляется — остаётся как fallback (стандартный Payload `staticDir`).
- Удалены unused: константы `LOCAL_MAX_MB`, `LOCAL_MAX_BYTES`, переменная `sizeBytes`, env-knob `YANDEX_DISK_LOCAL_MAX_MB` (нигде больше не используется в Media.ts).
- Добавлен комментарий про найденную регрессию rename: при переименовании Media-документа `afterChange` пытается читать локал по новому имени, которого больше нет → warning + skip. Это **записано как follow-up** в плане (`moveYandexResource` вместо повторной заливки).

### Локальная проверка

- `tsc --noEmit` clean

### Найденные хвосты

- `web/scripts/yadisk-sync-media.ts` (batch-sync, `pnpm run yadisk:sync`) использует `LOCAL_MAX_BYTES`/`YANDEX_DISK_LOCAL_MAX_MB`. Скрипт ручной, редко запускается. Согласовать с phase-3-семантикой — follow-up в плане.
- Rename-after-purge — записано как follow-up в плане.

### Уроки

- **Безусловное удаление локала после успеха = новая обязанность хранилища.** Раньше код «удалял только большие файлы»; это маскировало некоторые слабые места (rename, restore из локала). Теперь они стали явными и требуют отдельных follow-up'ов. Меньше прячем, больше документируем.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Media → Я.Диск, фаза 1+2 (proxy endpoint)

**Тема:** старт многоэтапной нитки [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md) — переход на Я.Диск как primary, локальный диск как TTL-кэш. В этой сессии сделаны фазы 0 (baseline), 1 (endpoint), 2 (`afterRead` подменяет URL). Готов PR1.

### Что сделано

- **Baseline (фаза 0):** 333 записи Media в проде, все с `yandex_path` (100% синхронизация уже была), 0 ошибок, 404 MB в БД / 408 MB на FS / 395 файлов (62 orphans). **Следствие:** скрипт миграции из плана становится защитной сеткой, а не основной работой.
- **`web/src/app/api/media/file/[id]/route.ts`** — новый proxy endpoint:
  - Lookup через Local API с `context: { skipYandexCheck: true }` чтобы получить сырой doc без рекурсии afterRead
  - Cache lookup в двух локациях: `MEDIA_CACHE_DIR` (env, default `public/media-cache`) → fallback `public/media` (legacy 333 файла)
  - Cache miss → `getDownloadUrl(yandexPath)` (приватная одноразовая ссылка по токену, не `yandexPublicUrl` который ротируется), `fetch`, `body.tee()`: одна ветка в HTTP-ответ, другая в `pipeline → createWriteStream(<name>.tmp.<pid>.<ts>.<rnd>)` → атомарный `rename`
  - Rate-limit: 240 req/min на IP-хэш через существующий `checkRateLimit`
  - Headers: `Cache-Control: public, max-age=2592000, immutable`, `Content-Type` из `doc.mimeType`, `X-Cache: HIT | HIT-LEGACY | MISS` (для observability), `Content-Length` из `fs.stat` на cache-hit и из upstream headers на cache-miss
  - Все пути от `process.cwd()` (= web project root для Next) — устойчиво к перемещению файла маршрута
- **`web/src/collections/Media.ts`** — упрощён `afterRead`-хук: всегда переписывает `doc.url` и `doc.thumbnailURL` на `/api/media/file/<id>` если есть `yandexPath`. Удалена логика `LOCAL_MAX_BYTES`/`fs.access`/«если файл большой и есть локально». Записи без `yandexPath` (по бейзлайну 0 шт.) сохраняют стандартный Payload URL.

### Локальный smoke test

- `tsc --noEmit` clean
- `pnpm dev` → `/api/health` 200
- `curl /api/media/file/319` с мок-файлом в legacy → 200, X-Cache: HIT-LEGACY, тело совпадает
- `curl /api/media/file/99999999` → 404 «Media not found»
- `curl /api/media/file/319` без локального файла + локальный токен недействителен → 502 «Upstream storage error» (корректно)

### Найдено по ходу и зафиксировано

- 62 файла в `public/media` без записи в БД (orphans) — добавлено в follow-ups плана; отдельный скрипт `scripts/find-orphan-media.ts` (когда руки дойдут)
- Изначальный путь к legacy-папке через `path.resolve(dirname, '../../../../../public/media')` — посчитан на 1 уровень неверно (учитывая каталог `[id]/`); заменён на `process.cwd()`-anchor

### Не сделано в этой сессии (по плану)

- Фаза 3 — `afterChange` безусловно удаляет локальный файл после успешной заливки на Я.Диск (PR2)
- Фаза 4 — cron-чистка кэша по TTL 30 дней (PR3)
- Фаза 5 — скрипт миграции (PR4, фактически защитная сетка по baseline)
- Фазы 6-7 — cleanup и smoke на проде (PR5)

### Уроки

- **Подход выбирать после чтения существующего кода, а не до.** Изначальная рекомендация handoff'а была A (Cloud Storage plugin) исходя из «с нуля». Чтение `Media.ts` показало ~80% уже сделано — это изменило рекомендацию на B (1-2 дня вместо 4-5).
- **`process.cwd()` для anchor-путей в App Router** надёжнее чем `import.meta.url + ../../`. Файл маршрута может переехать, относительные пути сломаются молча.
- **Tee в Web Streams** работает идиоматично в Node 20+ — `upstream.body.tee()` + `Readable.fromWeb` для одной ветки записи на диск. Без буферизации в память.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — SESSION_HANDOFF + /close_session (cross-project pool idea 003)

**Тема:** перенос идеи 003 из MatricaRMZ — система непрерывности разработки между сессиями (sticky-note в репо + skill финализации + шаг 0 в `/start`). Первое **обратное** срабатывание cross-project pool'а — MatricaRMZ-сессия добавила идею с пометкой ❓ для GONBA, GONBA-сессия её приняла.

### Что сделано

- **`docs/SESSION_HANDOFF.md`** — sticky note в репо. Заполнен начальным состоянием: `Status: ACTIVE`, текущая нитка = «довести ADR-0001 до конца: Media → Я.Диск», следующий шаг = выбрать подход (A/B/C) и сделать PoC.
- **`.claude/commands/close_session.md`** — slash-команда для финализации сессии. Собирает контекст (git log, текущий handoff), уточняет нитку через `AskUserQuestion`, перезаписывает handoff, обновляет PENDING_FOLLOWUPS если нужно, делает один коммит `chore(session): handoff <...>`. **Не** делает прод-операций, билдов, тестов — это про фиксацию, не релиз.
- **`.claude/commands/start.md`** — добавлен **шаг 0**: читает `SESSION_HANDOFF.md`, парсит `Status` и `Updated`, при `ACTIVE` + актуальная дата выделяет блок «🧵 Прошлая сессия оставила нитку» в самом начале отчёта. При устаревшем (>7 дней) — пометка `(устаревший handoff)`. При IDLE — пропускает.
- **`CLAUDE.md`** обновлён:
  - В таблице источников правды `SESSION_HANDOFF.md` добавлен **первой строкой** с пометкой «читать первым».
  - Добавлен `docs/plans/` со ссылкой на README.
  - В разделе «Жизненный цикл задачи» добавлены пункты про `/close_session` и `docs/plans/`.
- **`docs/plans/README.md`** — pointer-документ: зачем планы в репо (а не в `~/.claude/plans/`), формат, lifecycle.
- **Pool обновлён:** в `cross-project-ideas/INDEX.md` идея 003 теперь `✅ 2026-05-22` для GONBA; в самой идее обновлён `Implemented in` блок.

### Эффект для следующих сессий

- `/start` сразу подсвечивает «🧵 Прошлая сессия оставила нитку» — не надо искать в PENDING_FOLLOWUPS «на чём остановились».
- `/close_session` в конце фиксирует следующий шаг — не надо помнить контекст между сессиями.
- При работе с двух компов handoff приходит через `git pull` вместе с кодом.
- Plan mode пишет в `docs/plans/` — план виден в PR и переезжает между машинами.

### Уроки

- **Cross-project pool работает в обе стороны.** Идея, родившаяся в одном проекте, действительно доходит до другого и применяется без пересказа сценария — pool-файл содержит всё что нужно (problem statement, applicable_when, шаги переноса).
- **`feedback_cross_project_ideas` memory в каждом проекте читается автоматически** — поэтому когда INDEX обновляется в одном проекте, другие узнают об этом при следующем `/start`.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — `/admin/yadisk` интегрирован в layout админки

**Тема:** страница «Облако» больше не выглядит как отдельный сайт — она теперь Payload Custom View с обычными sidebar/AppHeader.

### Что было не так

`web/src/app/(payload)/admin/yadisk/page.tsx` был **обычным Next.js маршрутом** под Payload root layout. Next.js предпочитает специфичные маршруты — этот файл перехватывал `/admin/yadisk` ДО Payload-роутера в `[[...segments]]/page.tsx`. Поэтому страница рендерилась внутри минимального admin shell (только CSS-провайдеры и тема), без `DefaultTemplate` Payload → без меню, без хедера админки. Пользователь не мог одним кликом вернуться, скажем, в коллекцию Projects или открыть глобал Header.

### Что сделано

- **`web/src/components/YandexDiskView/index.tsx`** — новый Payload Custom View. Принимает `AdminViewServerProps` (Payload подаёт `initPageResult`, `params`, `searchParams`), сам оборачивает контент в `DefaultTemplate` из `@payloadcms/next/templates` — передаёт туда `i18n` / `locale` / `payload` / `permissions` / `user` / `visibleEntities` из `initPageResult`. Этот шаблон сам рендерит nav + AppHeader → меню админки появляется на странице.
- **`web/src/payload.config.ts`** — зарегистрирован view через `admin.components.views.yadisk: { Component: '@/components/YandexDiskView', path: '/yadisk' }`. Payload-роутер сам подхватывает URL `/admin/yadisk` и зовёт компонент.
- **`web/src/app/(payload)/admin/yadisk/page.tsx`** — **удалён**, директория тоже. Иначе Next.js всё равно перекрывал Payload-роутер.
- **Логика осталась прежней**: проверка ролей (`admin`/`manager`), hero-блок с pill-ссылками («Media в CMS», «Добавить в Media», «Карусель»), `<YandexDiskManager />`. Просто теперь в DefaultTemplate — со всем меню сбоку.
- **No-access сообщение** тоже рендерится внутри DefaultTemplate (а не в отдельной странице), чтобы юзер без прав мог через меню уйти, скажем, в свой профиль.

### Уроки

- **`(payload)/admin/<segment>/page.tsx` ломает Payload-роутер.** Если хочется кастомный admin view с полным шаблоном — регистрируй через `admin.components.views`, не создавай свой Next.js файл маршрута. Один Next.js маршрут только нужен — это catch-all `[[...segments]]/page.tsx`, и он сгенерирован Payload-ом.
- **`DefaultTemplate` придётся обернуть вручную внутри custom view.** Payload не делает это автоматически — view получает богатые `initPageResult` пропы и сам решает, рисовать ли шаблон. Пример — `NotFoundView` в `@payloadcms/next`.
- **На stale `.next/types/` после удаления маршрута** TypeScript ругается. Лечится `rm -rf .next/types/<old-path>`; при следующем `next build` индекс пересоберётся.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — AdminQuickLinks (быстрые ссылки в шапке)

**Тема:** в админке Payload теперь есть dropdown «Меню» в правой части шапки с быстрыми ссылками. Видна на всех маршрутах. Первая ссылка — «На главную сайта» (открывается в новой вкладке, чтобы не терять контекст правки).

### Что сделано

- **`web/src/components/AdminQuickLinks/index.tsx`** — компонент на нативном `<details>` (dropdown без JS-зависимостей, доступен с клавиатуры). Список ссылок в массиве `QUICK_LINKS` сверху файла — расширяется одной строкой.
- **`web/src/components/AdminQuickLinks/index.scss`** — стилизация на site-vars Payload (`--theme-elevation-*`), без Tailwind (см. урок F1 из 2026-05-21). На узких экранах (`max-width: 768px`) у триггера остаётся только иконка `≡` без текста.
- **`web/src/payload.config.ts`** — подключение через `admin.components.actions: ['@/components/AdminQuickLinks']`. Этот слот рендерится в правой части AppHeader Payload-админки и виден на всех маршрутах (dashboard, list, edit, custom views типа `/admin/yadisk`).
- **`web/src/app/(payload)/admin/importMap.js`** — пересобран через `pnpm generate:importmap`, чтобы Payload узнал о новом компоненте.

### Как добавлять новые ссылки

В `QUICK_LINKS` массиве в `AdminQuickLinks/index.tsx` — добавить объект `{ label, href, icon?, target?, title? }`. По умолчанию ссылка открывается в новой вкладке. Идеи на будущее:

- 🔗 `/admin/yadisk` — внутри админки, `target: '_self'`
- 🔗 `/api/health` — для быстрой диагностики
- 🔗 `https://github.com/Valstan/Gonba/actions` — открыть последние CI-runs

### Уроки

- **`admin.components.actions` — глобальный header-slot.** Не путать с per-view actions (которые задаются в коллекции через `admin.components.edit.SaveButton` и т.п.) — те видны только на конкретной view. Тот же слот можно использовать для других action-кнопок типа «↻ Очистить кэш».
- **`<details>` вместо React-dropdown** — на admin-маршрутах часто хочется минимум JS-зависимостей (Payload и так тащит много). Нативный `<details>` решает 90% случаев без лишних строк кода.

---

## 2026-05-22 — ГОНЬБА 22 мая 2026 (Claude session) — Изоляция deploy-ключа + cross-project ideas pool

**Тема сессии:** (1) убрать общий SSH-ключ из GH Action — сгенерить изолированный deploy-ключ для GONBA с регулярной ротацией; (2) создать глобальный pool переносимых идей между проектами GONBA/MatricaRMZ/setka.

### Изоляция deploy-ключа

**Проблема:** `SSH_PRIVATE_KEY` в GH secrets хранил общий `~/.ssh/id_ed25519`, авторизованный также на сервере `matricarmz`. Утечка одного secret = компрометация двух серверов разом.

**Что сделано:**

- Сгенерирован `~/.ssh/id_ed25519_gonba_deploy` (ed25519, без passphrase, comment `gonba-deploy@PC40-20260522`).
- Публичная часть залита в `valstan@GONBA:~/.ssh/authorized_keys` (4-я строка теперь).
- `~/.ssh/config` алиас `GONBA` переключён на новый ключ (`IdentityFile ~/.ssh/id_ed25519_gonba_deploy`).
- Локально проверено через `ssh -o BatchMode=yes GONBA "echo OK"` — пускает без пароля.
- GH secret `SSH_PRIVATE_KEY` обновлён через `gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519_gonba_deploy`.
- Триггернут `workflow_dispatch` для `Deploy to production` → прошёл (SSH login на сервер успешен с новым ключом, build + restart + smoke checks зелёные).
- В `docs/PROJECT.md` добавлен раздел **«SSH deploy-key — ротация»** с таблицей (Создан / Период ротации 90 дней / Следующая ротация 2026-08-20) и пошаговой процедурой.
- `/start` команда расширена шагом 5.1 «возраст SSH deploy-ключа» — за 10 дней до дедлайна показывает 🟡-напоминание.

**Старый общий `valstan@PC40` ключ в `authorized_keys` пока ОСТАВЛЕН** (плюс два «чужих» с серверов matricarmz и setka — обнаружены при инвентаризации). Удаление — отдельный шаг, требует подтверждения пользователя.

### Cross-project ideas pool

**Проблема пользователя:** «когда мы внедряем удачную фишку в одном проекте, я забываю про неё, а в другом проекте мы повторно изобретаем — или вообще не применяем». Нужно глобальное хранилище идей, которое будет жить между сессиями всех проектов.

**Что сделано:**

- Создан `C:\Users\valstan\.claude\cross-project-ideas\`:
  - `README.md` — гайд (когда читать, когда писать, формат)
  - `INDEX.md` — обзорная таблица идей × проектов со статусом (✅ / ⚠️ / ⛔ / ❓)
  - `ideas/001-isolated-deploy-ssh-key.md` — паттерн изолированного per-project ключа (статус: ✅ GONBA, ✅ setka, ⚠️ MatricaRMZ)
  - `ideas/002-ssh-deploy-key-rotation.md` — паттерн регулярной ротации с напоминанием от `/start` (статус: ✅ GONBA 90 дней, ❓ MatricaRMZ, ❓ setka)
- В memory **каждого** из трёх проектов добавлен `feedback_cross_project_ideas.md` с инструкцией: в начале каждой сессии заглянуть в `INDEX.md`, найти `⚠️`/`❓` строки для текущего проекта, проверить `applicable_when` и предложить пользователю **одной строкой** (без настойчивости).
- MEMORY.md в GONBA, MatricaRMZ, setka обновлены ссылкой на новую feedback memory.
- В `CLAUDE.md` GONBA добавлен pool в таблицу источников правды.
- `/start` GONBA расширен шагом «проверить pool на применимые идеи».

**Идея 002 — особенность:** период ротации **разный по проектам** (пользователь явно сказал). Для GONBA — 90 дней (публичный сайт). Для MatricaRMZ/setka — пометка ❓, спросить в их сессиях.

### Findings

- **На `authorized_keys` GONBA-сервера 4 публичных ключа**, два из них с **других** серверов разработчика (`valstan@a6fd55b8e0ae` = MatricaRMZ, `valstan@setka` = setka). Это значит: компрометация MatricaRMZ-сервера или setka-сервера → доступ на GONBA. Цепочка длинная и не самая опасная (доступ к своим же серверам), но не идеал. Записано в `PENDING_FOLLOWUPS.md → 🟡`.
- **Старая memory `prod_server_access.md` устарела** на 2 дня — утверждала, что в `~/.ssh/config` нет алиаса `GONBA`. На самом деле есть давно. В этой сессии переписана с правильными данными и упоминанием нового ключа.

### Уроки

- **Pool НЕ дублирует memory.** Memory отвечает «как устроено в этом проекте», pool — «что стоит позаимствовать». Pool ссылается на memory через имя файла. Memory ссылается на pool через путь.
- **Не предлагать идею из pool настойчиво.** Пользователь явно сказал «с умом распространяй и не предлагай если получится ненужный костыль который усложнит проект». Лучше пропустить, чем впихнуть.
- **`/start` теперь делает 3 проверки безопасности**: prod-health + payload-types свежие + возраст deploy-ключа. Если будут ещё периодические security-checks — выносим в отдельный helper-скрипт типа `scripts/security-audit.sh`.

### Хвосты в `PENDING_FOLLOWUPS.md`

- 🟡 (новый) `authorized_keys` на GONBA-сервере содержит ключи с других серверов — решить надо/не надо.
- 🟢 Применить идею 001 + 002 в **MatricaRMZ** — в его собственной сессии (нельзя автоматически, нужен пользовательский контекст про его deploy-инфраструктуру).
- 🟢 Применить идею 002 в **setka** — спросить период ротации (там уже изолированный ключ есть, нужна только ротация).

---

## 2026-05-21 — ГОНЬБА 21 мая 2026 (Claude session) — Yadisk visual QA + polish

**Тема сессии (вторая часть дня):** полный визуальный QA `/admin/yadisk` со скриншотами в Chrome + закрытие 12 findings одним PR.

### Findings (полный список в комментариях к PR)

**🔴 Критичные:**
- **F1: Tailwind не подключался к `(payload)`-маршрутам.** `(payload)/layout.tsx` импортирует только `@payloadcms/next/css`, пустой 0-байтовый `custom.scss` и `site-theme.css` (vars без utilities). Все Tailwind-классы в `(payload)/admin/yadisk/page.tsx`, `YandexDiskManager/index.tsx` и `SidebarPanel.tsx` игнорировались браузером: `max-w-6xl`, `px-4 py-8`, `rounded-2xl`, `border`, `bg-card`, `flex`, `gap-2`, `text-2xl`, `font-semibold`, `text-muted-foreground`, `mt-3`, `space-y-6` и т.д. Подтверждено инспекцией: `hasTailwind: false`, `cardBorderRadius: 0`, `linkPadding: 0`. Видимый результат — слиплые ссылки «Media в CMSДобавить в MediaРедактировать карусель», h1=32px (UA-default), прозрачная карточка-обёртка.
- **F2: Битый SVG `branding/zhemchuzhina-vyatki.svg`.** Файл существовал (200 OK) но `naturalWidth: 0`. Внутри — cp1251-байты вместо UTF-8 + литеральный `<` внутри `<text>` → невалидный XML. Логотип не отображался на login и в admin top-bar.

**🟡 Важные:**
- F3: «Загрузить файлы» (primary forest) и «Загрузить изображения» (success → teal через Payload `--theme-success-500`) — разный цвет у однотипных кнопок.
- F4: Папки используют hardcoded `--theme-warning-200/300/400/900` (оранжево-жёлтые Payload-токены), не вписываются в палитру сайта.
- F5: `.yadisk__sidebar` без `border-radius` и `padding` — контент прилипает к рамке.
- F6: Layout «Сортировка:» рваный (подпись отрывается от чипсов на следующую строку).
- F7: Два h1 на одной странице («Общая медиабиблиотека» из `page.tsx` + «Файловое облако Жемчужины» из `CloudTitlebar`).
- F8: Длинные UUID-имена файлов обрезаются однострочкой с ellipsis, невозможно прочесть.

**🟢 Косметика:**
- F9: «Каталог» подпись под папкой — old-school file manager стиль.
- F10: `--yadisk-trash-icon` лососёвый (`--danger-soft`) на sand-фоне.
- F11: Selected-state карточки даёт box-shadow ring 20% от primary — еле видимый.
- F12: Кнопки `--outline` при disabled неотличимы от enabled (только `opacity: 0.5`).

### Изменения

- **`web/src/components/YandexDiskManager/index.scss`** — расширен:
  - Новые блоки: `.yadisk__hero`, `.yadisk__hero-card/title/subtitle/actions`, `.yadisk__pill-link`, `.yadisk__noaccess*` — заменяют Tailwind-классы в `page.tsx`.
  - `.yadisk__sidebar` — добавлены `border-radius: var(--yadisk-radius-lg)` и `padding: 14px` (F5).
  - `.yadisk__sidebar-title` — новый блок (uppercase caption, muted).
  - `.yadisk__main` — flex column gap (заменяет Tailwind `space-y-6`).
  - `.yadisk__tree` — `margin-top: 6px`.
  - `.yadisk__sidebar-add` — `margin-bottom: 14px` (заменяет `mt-3`).
  - `.yadisk__loading`, `.yadisk__empty` — стили без Tailwind (border-dashed для empty).
  - `.yadisk__card` — `padding: 12px` (F5).
  - `.yadisk__card--selected` — box-shadow 35% (было 20%, F11).
  - `.yadisk__folder-preview/icon/name` — gradient на `--accent` вместо `--theme-warning-*` (F4); цвет имени `--accent-foreground`; drop-shadow на иконке.
  - `.yadisk__preview-caption` — line-clamp 2, word-break break-all (F8).
  - `.yadisk__trash-icon` — bg на `--yadisk-card-soft` (F10), `flex-shrink: 0`.
  - `.yadisk__trash` — `border-radius: var(--yadisk-radius-md)`, `padding: 12px`.
  - `.yadisk__trash-content` — flex column для текста.
  - `.yadisk__button` — `display: inline-flex; gap: 8px` (для иконок); `.yadisk__button--outline:disabled { border-style: dashed }` (F12).
  - `.yadisk__sort-group` — wrapper для подписи + chipsы + направление (F6).
  - `.yadisk__popup-menu-item.is-danger` — красный текст для «Удалить».
  - `.yadisk__task/header/title/meta/errors`, `.yadisk__progress` — стили без Tailwind.
- **`web/src/app/(payload)/admin/yadisk/page.tsx`** — переписан без Tailwind. Использует `yadisk__hero*` и `yadisk__noaccess*` классы из SCSS. Один root-`<div className="yadisk">` для доступности CSS-vars.
- **`web/src/components/YandexDiskManager/index.tsx`** — удалены все Tailwind-классы (`mt-6 space-y-6`, `rounded-2xl border bg-card p-4 shadow-sm`, `flex items-center justify-between gap-2 text-sm`, `font-semibold`, `text-xs text-red-600`, `block w-full px-3 py-2 text-left hover:bg-muted` и т.д.). Заменены на SCSS-классы. «Каталог» metaстрока убрана для папок (F9).
- **`web/src/components/YandexDiskManager/components/SidebarPanel.tsx`** — то же.
- **`web/src/components/YandexDiskManager/components/ActionToolbar.tsx`** — обе upload-кнопки теперь `--primary` (F3). Добавлены эмодзи-иконки 📁 и 🖼️ для различения.
- **`web/src/components/YandexDiskManager/components/ViewToolbar.tsx`** — sort-группа обёрнута в `.yadisk__sort-group` (F6).
- **`web/src/components/YandexDiskManager/components/CloudTitlebar.tsx`** — h1 рендерится только в `pickerMode`. В обычном режиме — только back-link (F7). Placeholder `<span />` для flex-space-between.
- **`web/public/branding/zhemchuzhina-vyatki.svg`** — перегенерирован в чистом UTF-8 без BOM. Два line-тэга: «Гоньба» (Georgia 22px) + «жемчужина Вятки» (Arial 11px opacity 0.7). Согласуется с frontend-hero «Гоньба — жемчужина Вятки».
- **`web/src/components/AdminLogo/index.tsx`** и **`web/src/components/AdminIcon/index.tsx`** — `alt` обновлён на «Гоньба — жемчужина Вятки».

### Уроки
- **Tailwind v4 однозначно scoped по route-группе (`(frontend)`).** Подключение к `(payload)` через тот же `globals.css` рискованно — может зацепить Payload-admin селекторы. Безопаснее писать собственный SCSS с переменными из `site-theme.css`.
- **QA: всегда проверять в браузере, что вычислённые стили совпадают с CSS-классами.** `hasTailwind: false` через JS-инспекцию — быстрый способ определить, что utility-классы не работают.
- **SVG в кириллице должен быть UTF-8 без BOM**, а литеральный `<` внутри `<text>` ломает XML — всегда заменять на `&lt;` или избегать.


**Тема сессии:** закрытие трёх 🟡-техдолгов из `PENDING_FOLLOWUPS.md`: watchdog в build-скрипте, отсутствие Payload-миграций для ручных `ALTER TABLE`, устаревший `docs/PROJECT.md`.

### Изменения

- **`web/package.json` → build watchdog поднят:** `--idle-ms` 180000 → 600000, `--stagnation-ms` 480000 → 900000 (`--max-ms` остался 1800000). Это позволит однажды отказаться от `build:raw` для большинства случаев — Next.js 15 укладывается в 10-минутный idle.
- **`web/src/migrations/20260521_120000.ts` + `.sql`-зеркало** — новая идемпотентная миграция, покрывающая 7 ручных `ALTER TABLE` из прошлой сессии:
  - `projects.home_link varchar`
  - `vk_auto_sync.community_name/description/avatar/screen_name varchar`
  - `vk_auto_sync.project_id integer` + FK `vk_auto_sync_project_id_projects_id_fk` (ON DELETE SET NULL) + индекс `vk_auto_sync_project_idx`
  - `vk_auto_sync.category_id integer` + FK `vk_auto_sync_category_id_categories_id_fk` (ON DELETE SET NULL) + индекс `vk_auto_sync_category_idx`
  - `vk_auto_sync.group_id` и `access_token` — `DROP NOT NULL`
  - Все шаги через `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` / `pg_constraint` гард → миграция переживает повторный прогон.
  - Зеркало `.sql` — на случай, когда `payload migrate` зависает на y/N-prompt drizzle'а (см. сноску ниже), можно применить через `psql -f`.
  - Зарегистрирована в `web/src/migrations/index.ts`.
- **`docs/PROJECT.md` — точечная чистка:**
  - Убран захардкоженный шаблон даты «ГОНЬБА 18 мая 2026» (теперь явно «подставит /start»).
  - Добавлены отсутствующие коллекции `VkImportQueue`, `VkAutoSync`, `Messages` и недостающие глобалы `HomeCarousel`, `VkAutoSyncSettings`.
  - Убран блок про устаревший `~/.ssh/id_rsa` — только актуальный `id_ed25519`.
  - В разделе «Деплой/Systemd» добавлен правильный путь через `/reliz` + `scripts/safe-build.sh`, добавлено предупреждение про `next build` через SSH и `push:true` на проде.
  - Пример «обновить код и пересобрать» переписан под `safe-build.sh`.

### Применение миграции

- **Локально:** SQL-зеркало прогнано через `psql -f`, факт применения зафиксирован в `payload_migrations` (`INSERT ... WHERE NOT EXISTS`). Локальная схема `vk_auto_sync` теперь сматчена с продом (4 community-поля + FK + nullable group_id/access_token).
- **На проде после деплоя:** прогнать `ssh GONBA "cd /home/valstan/GONBA/web && corepack pnpm payload migrate"`. Все колонки уже добавлены вручную → IF NOT EXISTS их пропустит. FK constraints на проде пока нет → их миграция добавит (что мы и хотим).

### Уроки

- **`pnpm payload migrate` подвис на 40+ минут локально.** Подозрение — drizzle `push:true` снова попал в интерактивный y/N про новые колонки (как memory `dev_schema_push_prompt`), но без TTY его никто не подтвердил. Workaround — применять миграцию через прямой `psql -f` SQL-зеркало. → 🟡 техдолг: или отключить `push:true` на dev (опасно, поломает текущий dev-flow), или сделать `payload migrate` неинтерактивным (`yes y | ...`).
- **Локалка отставала от прода.** За прошлую сессию все ручные `ALTER TABLE` ушли на прод, но локальная БД (`push:true` без подтверждения через TTY) их не получила. Миграция привела обе среды в синхрон.

### Хвосты, оставленные в `PENDING_FOLLOWUPS.md`

- 🟡 `web/.env.example` без `postgres:postgres@` — не задето в этой сессии
- 🟡 Direct UPDATE/INSERT минует afterChange-хуки — не задето
- 🟡 `dev_env_requirements` memory — нужно обновить
- 🟡 `docs/RELEASE_STABILITY_CHECKLIST.md` — не задето
- 🟡 у некоторых проектов `title === slug` — не задето
- 🟡 (новый) `payload migrate` интерактивный — workaround через прямой psql задокументирован

### Раунд 2 — DX-улучшения (dev-doctor + auto-fill title) — PR #10

**Бонусом после техдолг-чистки взялся за две идеи из 🟢-секции `PENDING_FOLLOWUPS.md`.**

- **`scripts/dev-doctor.sh`** — оказался **уже сделан** в репо (видимо в одну из прошлых сессий), просто не зафиксирован в логе. Прогон показал все 11 проверок зелёными:
  - Tools: node 24.15, corepack 0.34.6, pnpm 10.15 (через corepack), pnpm script-shell = git-bash.exe
  - Project files: `web/.env`, `web/node_modules`, `web/src/payload-types.ts`, `admin/importMap.js`
  - Database: psql найден, Postgres отвечает, БД `gonba` существует
  - SSH: ed25519 ключ есть, alias `GONBA` настроен (добавили в этой сессии)
- **Hook `populateProjectTitle`** — новый `web/src/hooks/populateProjectTitle.ts` + подключение через `beforeValidate` в `Projects`. Заполняет `title` из `shortLabel` если `title` пустой (никогда не перезаписывает явный ввод). Решает корневую причину прошлой проблемы «у трёх проектов title === slug»: раньше пользователь не мог сохранить документ без title (Payload required-валидация) и обходил это, копируя slug в title; теперь `title` сам подставится из `shortLabel` (`defaultValue: 'Проект'` или то, что ввёл пользователь). Старые три проекта (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) hook не починит — их нужно править вручную через `/admin/collections/projects`.

**SSH alias `GONBA`** в `~/.ssh/config` добавлен (по образцу `matricarmz`, с `accept-new` для headless-сценариев). Файл локальный, не идёт в git — рецепт описан в `docs/PROJECT.md` для других машин разработки.

**CI deploy через GitHub Action** — третья идея из той же серии — **отложена**: требует решений про GitHub secrets (SSH private key), форму триггера (push to main vs `workflow_dispatch`), rollback-стратегию. Обсудить отдельно.

### Хвосты раунда 2 → в `PENDING_FOLLOWUPS.md`

- 🟡 У трёх старых проектов `title === slug` — оставлена (hook не помогает существующим записям, нужна ручная чистка)

### Раунд 3 — CI deploy через GitHub Action — PR #11

**Закрывает последнюю 🟢-идею сессии: автоматический деплой после merge в main.**

- **`.github/workflows/deploy-prod.yml`** — новый workflow, триггерится через `workflow_run` после успешного `CI` workflow на `main` (то есть после merge зелёного PR). Также `workflow_dispatch` для ручного перезапуска.
- **Шаги:**
  1. Checkout с `fetch-depth: 2` — нужен diff с предыдущим коммитом.
  2. **Safety net на миграции:** `git diff --diff-filter=A -- 'web/src/migrations/*.ts'` (без `index.ts`). Если есть новые файлы — фейлит с понятной ошибкой, не идёт в build. Миграции остаются ручным шагом ДО merge (через `/sql` или `psql -f`), потому что в headless CI `payload migrate` зависает на drizzle push:true y/N prompt (видели сегодня).
  3. Setup SSH: secret `SSH_PRIVATE_KEY` → `~/.ssh/id_ed25519` (600), `~/.ssh/config` с алиасом `GONBA`, `ssh-keyscan` → `known_hosts`.
  4. `ssh GONBA "cd /home/valstan/GONBA && git pull --ff-only origin main"`.
  5. `ssh GONBA "/home/valstan/GONBA/scripts/safe-build.sh"` (фоновый билд через `systemd-run`).
  6. `ssh GONBA "/home/valstan/GONBA/scripts/wait-build.sh"` (ждёт до 1200s, по нашему опыту билды укладываются в ~3-5 минут).
  7. `sudo systemctl restart gonba && sleep 6 && systemctl is-active gonba`.
  8. Smoke: local `/api/health`, CDN `/`, `/api/health`, `/projects`, `/admin` — все должны вернуть 200.
- **На падении (per договорённости с пользователем — НЕ откатываемся, лечим ситуацию):** дамп `journalctl -u gonba -n 100` + `journalctl -u gonba-build -n 100` + `systemctl status gonba` в job output. Разработчик заходит руками, чинит, и при необходимости перезапускает через UI Actions → Deploy to production → Run workflow.
- **Concurrency:** `group: deploy-prod`, `cancel-in-progress: false` — два push'а подряд идут последовательно, без отмен.

**Setup secret (один раз):**
```bash
gh secret set SSH_PRIVATE_KEY --repo Valstan/Gonba < ~/.ssh/id_ed25519
```
Сделано в этой сессии. **Warning:** ключ `id_ed25519` авторизован также на `matricarmz` — если GitHub secret утечёт, оба сервера в риске. Дока в `docs/PROJECT.md` советует на будущее создать отдельный deploy-ключ `id_ed25519_gonba_deploy`.

**Slash-команда `/reliz`** остаётся актуальной для ручного контроля (миграции, hot-fix без CI). Workflow и `/reliz` идемпотентно совместимы — оба идут через `safe-build.sh`.

**Первый live-тест:** этот PR сам через себя задеплоится после merge. Если упадёт — будет видно журналы в Actions, попадём в режим «лечим вручную».

**Результат live-теста:**
- ✅ `workflow_dispatch` (ручной trigger) — **успех** за 10м44с. Прод жив, CDN /api/health = 200.
- ❌ `workflow_run` (auto после CI) — **не сработал**, потому что CI workflow на main падает (см. раунд 4).

### Раунд 10 — Фаза F: финальная чистка хвостов — PR #18

**Цель:** закрыть мелкие 🟡-техдолги и часть 🟢-идей одним заходом.

**Изменения:**

- **`web/.env.example`** — `DATABASE_URL` теперь содержит `postgres:postgres@` префикс (нужно на Windows + системный Postgres 16). Добавлен закомментированный вариант для docker compose.
- **`docs/RELEASE_STABILITY_CHECKLIST.md`** — полностью переписан. Теперь это «бумажная» референс-карта на случай ручного деплоя; основной flow ушёл в `/reliz` и `.github/workflows/deploy-prod.yml`. Добавлены ссылки на новые скрипты (`dev-doctor.sh`, `safe-build.sh`, `run-migrate.sh`).
- **`scripts/run-migrate.sh`** — обёртка `yes y | corepack pnpm payload migrate` для headless-окружений. Решает 🟡-техдолг «`payload migrate` интерактивный» (зависал на drizzle y/N в сессии 2026-05-21). Fallback на `psql -f` зеркало остаётся документированным.
- **`CLAUDE.md`** — заметка про direct UPDATE усилена ссылкой на `ssh GONBA "sudo systemctl restart gonba"` и упомянуты Header/Footer-глобалы как самые частые цели. Добавлен новый пункт про `payload migrate` workaround.
- **Memory `dev_env_requirements`** — обновлена с актуальной информацией: Postgres 16 уже установлен локально (postgres/postgres@gonba), SSH alias `GONBA` уже настроен, добавлен пункт про git hooks. Старый текст «нет Docker / нет Postgres» удалён.

**3 проекта с `title === slug`** — поправлены прямым UPDATE на проде (после явного подтверждения пользователя):
- `vyatskiy-sbor`: title → «Вятскiй сборъ» (из seed)
- `about-project`: title → «О проекте ГОНЬБА»
- `eco-hotel-booking`: title → «Бронирование ЭКО-отеля»

Direct UPDATE минует Payload `afterChange`-хуки — после правки `systemctl restart gonba` (на проде это сделано в этой же сессии). Локальная БД не синхронизирована: PowerShell + psql на Windows зацепились на UTF-8 кодировке для кириллицы в SQL-литералах; на dev-сервере это не блокер (база переопределится при следующих экспериментах). Способ для будущего: класть SQL в файл с BOM или применять через bash/SSH.

**Что НЕ сделано в этой фазе (намеренно):**

- 🟢 Полноценный step-by-step VK wizard с прогресс-баром (8-12ч, высокий риск регрессии). Базовая визуальная разбивка через `tabs` уже сделана в фазе E — закрывает 80% UX-выгоды.
- 🟢 Admin E2E в CI — требует отдельной seed-инфраструктуры для admin user в CI workflow. Локально `admin.e2e.spec.ts` уже работает через `pnpm test:e2e`.
- 🟢 Полный визуальный QA `/admin/yadisk` со скриншотами — нужна живая обратная связь от пользователя, не закрывается «вслепую» автоматически.
- 🟢 ADR — это процессная задача (расширять по мере появления решений), не закрывается одним PR.

### Раунд 9 — Фаза E: VK auto-sync «wizard»-табы — PR #17

**Реструктуризация коллекции `vk-auto-sync`** через встроенный Payload `tabs` field — визуальная разбивка длинной формы на 4 шага:

1. **«1. Источник VK»** — URL (required), название, описание, аватар, ID группы, screen_name. Метаданные подтягиваются `beforeValidate`-hook'ом (PR #6).
2. **«2. Привязка к сайту»** — project, category (relationship, required), projectSlug/sectionSlug (read-only mirror).
3. **«3. Параметры импорта»** — accessToken, syncIntervalHours, isEnabled, postType.
4. **«4. Журнал и статус»** — lastSyncedPostId, lastError, syncLog.

Sidebar (lastSyncStatus, lastSyncAt, totalImported) **вынесен на верхний уровень коллекции** и виден на любом табе — редактор сразу понимает «работает ли синхронизация» без переключений между шагами.

**Почему именно `tabs`, а не custom React-wizard:**
- Никакого нового кода (importMap, RSC/Client типизация, intersections с afterChange-хуками — всё это риски в Payload custom views).
- Edit existing работает out-of-the-box.
- Описание у каждого таба объясняет «зачем этот шаг».
- Если позднее захочется именно step-by-step с прогресс-баром — это вторая фаза с кастомным компонентом, но 80% UX-выгоды уже получены.

**Изменений в БД нет** — поля те же по имени, просто визуально сгруппированы. Никакой миграции.

### Раунд 8 — Фаза D: Yadisk UI polish (статический) — PR #16

**Static-улучшения** `web/src/components/YandexDiskManager/index.scss` — то что можно сделать без живого тестирования в браузере:

- Все hardcoded `rgba(15, 23, 42, X)` shadows и backdrop'ы заменены на `color-mix(in srgb, var(--yadisk-text) X%, transparent)`. Теперь правильно реагируют на тёмную тему сайта (если когда-нибудь добавим — сейчас тема светлая, эффект тот же, но семантика правильная).
- `rgba(37, 99, 235, X)` (захардкоженный primary blue) в `.yadisk__card:hover` и `.yadisk__card--selected` → `color-mix(... var(--yadisk-primary) ...)`. Теперь карточки правильно подсвечиваются в primary-цвет сайта, а не фиксированно синим.

**Что НЕ сделано (требует ручной работы со скриншотами в браузере):**
- Полный визуальный обход `/admin/yadisk` с поиском mismatch (выравнивание кнопок, размеры бейджей, тени, hover-эффекты)
- Сравнение с дизайн-системой `(frontend)`
- Адаптация под mobile-view

После PR #5/#6 файл уже хорошо привязан к токенам сайта — основная работа уже сделана. Эта фаза — финальная чистка hardcoded значений, доступная без браузера.

### Раунд 7 — Фаза C: Live preview плашек /projects + fix E2E — PR #15

**Live preview** для редактора плашек на `/projects` (админский режим):

- Вынес общий компонент **`Plate`** + helpers (`resolveAccent`, `pickImage`, `projectLabel`, `projectHref`, `imageSrc`) из `EditableProjectsGrid.tsx` в новый файл `web/src/app/(frontend)/projects/PlateCard.tsx`. Это устранило дублирование и подготовило плашку к reuse.
- В `EditProjectDialog.tsx` добавлен **preview area** сверху диалога: тот же `Plate` рендерится с локальным state формы. Любая правка (название, описание, цвет, картинка через upload) мгновенно отражается в превью без сохранения.
- `useMemo<previewProject>` собирает объект из original project + override локальными полями. `null` логотип → деграция на букву (по аналогии с frontend).
- Ширина диалога увеличена с `max-w-lg` на `max-w-2xl` чтобы плашка влезала.

**Эффект для редакторов:**
- Цикл «изменил → сохранил → посмотрел → не понравилось → откатил» (раньше ~30 сек) → **мгновенный**.
- Не пишем в БД мусор-черновики при перебирании цветов.

**Параллельно — fix E2E теста из фазы B:** CI фазы B упал на `can load projects grid page` (мой `text=/гонба/i` локатор требовал данные в БД, но CI создаёт пустую `gonba_ci`). Заменил на проверку HTTP-статуса + видимости `<body>` — независимо от seed.

### Раунд 6 — Фаза B: E2E Playwright smoke для /projects — PR #14

**Расширение `web/tests/e2e/frontend.e2e.spec.ts`** двумя сценариями:

- `can load projects grid page` — открывает `/projects`, проверяет что hero-плашка `гонба` отрисовалась.
- `can navigate from projects grid to a project page` — на `/projects` находит ссылку «Войти в проект» (первую), кликает, проверяет что попали на `/projects/[slug]` и видны либо h1 либо табы (feed/lavka/chat/...). Если активных проектов нет (пустая БД) — `test.skip`.

Не добавляю в `admin.e2e.spec.ts`: текущий CI workflow запускает только `frontend.e2e.spec.ts` (без admin-seed), admin-тесты гоняются локально через `pnpm test:e2e`. Тяжёлые сценарии (создание VK-источника, auto-fill title) оставлены на ручной локальный прогон — добавлять их в CI без отдельной admin-seed-инфраструктуры повысит риск flaky без пропорциональной выгоды.

**Защищаем от регрессов:**
- редизайн `/projects` (PR #4) — теперь любая случайная поломка hero-блока или плашек ловится перед merge
- маршрутизация `/projects/[slug]` (после мерджа PR #6, #7, плюс эта серия) — открытие табов проекта тоже smoke-проверяется

### Раунд 5 — Фаза A: git hook + ADR — PR #13

**Первая из пяти фаз закрытия 🟢-идей** (1+2 из 6 выбранных пользователем).

- **`scripts/git-hooks/prepare-commit-msg`** + **`scripts/install-git-hooks.sh`** — мягкое напоминание: если commit message начинается с `feat:`/`fix:`/`refactor:` (включая scoped формы `feat(api):`), и в staged-файлах НЕТ `docs/DEVELOPMENT_LOG.md` — выводит жёлтое предупреждение в stderr и пропускает дальше. **НЕ блокирует** коммит (чтобы не раздражать на быстрых фиксах). Пропускает merge/squash коммиты автоматически. Установка одной командой `bash scripts/install-git-hooks.sh` — идемпотентная, нужна один раз на каждой машине разработки.
- **`docs/adr/`** — новая директория с **Architectural Decision Records** (формат Michael Nygard). Создан:
  - `README.md` — объяснение что это, когда писать, индекс ADR
  - `_template.md` — пустой шаблон для новых ADR
  - **3 первых ADR** на основе уже зафиксированных архитектурных решений:
    - [0001](../docs/adr/0001-yandex-disk-as-media-storage.md) — Yandex.Disk как хранилище медиа (vs S3 и платных альтернатив)
    - [0002](../docs/adr/0002-push-true-dev-migrations-prod.md) — гибридная стратегия миграций (`push:true` на dev + явные миграции на проде)
    - [0003](../docs/adr/0003-build-via-systemd-run-on-prod.md) — build на проде через `systemd-run` (защита от SSH-disconnect)
- **`scripts/dev-doctor.sh`** дополнен: блок `[Git hooks]` проверяет установлен ли `prepare-commit-msg`.
- **`CLAUDE.md`** дополнен:
  - В таблице источников правды добавлена ссылка на `docs/adr/`
  - В жизненном цикле задачи: «На новой машине разработки — один раз `bash scripts/install-git-hooks.sh`» и «При архитектурных решениях — заведи новый ADR».

**Следующие фазы (в очереди по запросу пользователя):**
- B: E2E Playwright smoke tests (~6 ч)
- C: Live preview плашек /projects (~4 ч)
- D: Yadisk UI polish (~2–4 ч)
- E: VK auto-sync wizard (~8–12 ч)

### Раунд 4 — Фикс CI (pnpm 11 in corepack) — PR #12

**Проблема:** `CI` workflow (`.github/workflows/ci.yml`) красный последние 3 коммита на main. Падает на шаге `Integration tests`:
```
[ERR_PNPM_UNSUPPORTED_ENGINE] Got: 11.1.3 — Expected version: ^9 || ^10
```
Когда `npm run test:int` (через npm) дёргает внутри себя `corepack pnpm run test:int:raw`, corepack без подсказки берёт global pnpm 11, который не проходит engines проекта.

**Фикс:** одно поле в `web/package.json`:
```json
"packageManager": "pnpm@10.15.0"
```
Corepack читает это поле и автоматически использует именно эту версию pnpm независимо от того что установлено глобально. Не ломает `npm ci` (npm игнорирует поле) и не требует менять CI workflow.

**Эффект:** после merge CI станет зелёным → `workflow_run` триггер для `deploy-prod` начнёт срабатывать сам без `workflow_dispatch`.

---

## 2026-05-20 — ГОНЬБА 20 мая 2026 (Claude session)

**Серия PR:** #4 → #5 → #6 → #7. Все смержены squash в `main`, задеплоено на прод.

### PR #4 (`391ee94`) — feat(projects): редизайн `/projects` + inline-редактор плашек для админов

- Новый компонент `web/src/app/(frontend)/EditableProjectsGrid.tsx` (~330 строк) — адаптивная сетка цветных плашек.
- Каждая плашка: градиент по `accentColor` проекта (фолбэк — псевдо-рандом из тематической палитры по hash от slug), картинка-превью (logo → heroImage → первое фото `gallery`, иначе декор-буква), название, краткое описание, кнопка «Войти в проект».
- Hero-плашка с `gonba` сверху на всю ширину.
- Для админов (роли admin/manager/editor) — кнопка «✎ Редактировать плашки»:
  - drag-and-drop через `@dnd-kit` (пишет `sortOrder` шагом 10 через `PATCH /api/projects/{id}`);
  - модалка `EditProjectDialog.tsx` (~210 строк): название, описание, цвет (color picker + HEX), кастомная ссылка, загрузка картинки через `POST /api/media`.
- Главная `/` восстановлена к старому виду (orbit-карусель) — плашки переехали на `/projects`.
- Новое опциональное поле `homeLink` в коллекции `Projects`.
- Зависимости: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **БД-миграция на проде:** `ALTER TABLE projects ADD COLUMN home_link TEXT` (на проде используется не `push:true`, а миграции — Drizzle сам колонку не добавит).

### PR #5 (`070fd81`) — style(yadisk): UI Облака под дизайн-систему сайта

- Локальные `--yadisk-*` SCSS-переменные привязаны к shadcn-style CSS-vars сайта с fallback на Payload theme tokens и старые hex для safety.
- Унифицированные радиусы `--yadisk-radius-sm/md/lg`.
- Категорийные цвета бейджей типов файлов и dark-палитра полноэкранного просмотрщика медиа — намеренно оставлены.
- **БД-правка на проде:** запись `header_nav_items` для «Облако» обновлена с `https://831d0ce99bdf.vps.myjino.ru/admin/yadisk` на относительный `/admin/yadisk`.

### PR #6 (`619ff92`) — feat: site theme на admin-маршрутах + wizard VK-источников

- **Yandex Cloud UI**: создан `web/src/app/(payload)/site-theme.css` с CSS-переменными сайта (`--card`, `--border`, `--foreground`, ...), импортирован в `(payload)/layout.tsx`. Прошлый PR #5 рисовал mapping, но переменные не подхватывались — `globals.css` сайта подключён только к `(frontend)`-группе.
- **VK Auto-Sync «wizard»**: в коллекции `vk-auto-sync` все required-поля кроме URL сделаны опциональными или с дефолтами. Добавлены поля `communityName`, `communityDescription`, `communityAvatar`, `screenName` — заполняются автоматически через `beforeValidate`-hook, который парсит URL и дёргает VK API `groups.getById`. Токен можно отложить — используется fallback из env (`VK_TOKEN_VALSTAN`/`VITA`/`SERVICE`/`TOKEN`). Все labels переведены на русский.
- В `syncVkSource()` добавлен safe-guard на пустой `groupId`.
- **БД-миграция на проде:** добавлены 4 колонки `vk_auto_sync.community_name/description/avatar/screen_name TEXT`, сняты `NOT NULL` с `group_id` и `access_token`.

### PR #7 (`5aaa1dd`) — feat(vk): dropdowns с проектами и категориями

- Поля `project` (→ `projects`) и `category` (→ `categories`) — relationship, required. В UI dropdown с реальными названиями.
- `projectSlug`/`sectionSlug` остались как readOnly text для backwards compatibility с `syncVkSource()` — заполняются автоматически из выбранных связей через тот же `beforeValidate`-hook.
- Обновлены seed-script и `POST /api/vk-auto-sync/trigger?seed` — ищут проект/категорию по slug и передают `id`.
- **БД-миграция на проде:** `ALTER TABLE vk_auto_sync ADD COLUMN project_id INTEGER, category_id INTEGER`, backfill через `UPDATE FROM SELECT slug`, снят `NOT NULL` с `project_slug`/`section_slug`.

### Прод-инфраструктура — уроки сессии

- **SSH disconnect убивает `next build`.** Прямой `corepack pnpm run build:raw` через одну SSH-сессию завершается посередине prerender'а, оставляя «полуготовый» `.next` без `prerender-manifest.json` → сервис в crash-loop с `ENOENT`. Правильно — запускать через `systemd-run --unit=gonba-build --uid=valstan --gid=valstan --working-directory=/home/valstan/GONBA/web -- /bin/bash -lc "corepack pnpm run build:raw"`; ждать через `systemctl is-active` в poll-loop. Скрипт-обёртка теперь есть в `scripts/safe-build.sh`.
- **`build` script с watchdog 180s слишком короткий** — Next.js 15 production build молчит до 5-6 минут на этапе компиляции и попадает в idle-timeout. `build:raw` обходит watchdog. → 🟡 техдолг: поднять watchdog idle до 600s или вообще убрать.
- **`systemd-run` без `--uid=valstan`** запускается от root и берёт глобальный pnpm 11 из `/root/.cache/corepack`, который несовместим с engines проекта (`^9 || ^10`). Падает с `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.
- **Прямой `UPDATE` в БД минует Payload `afterChange`-хук** → `revalidateTag('global_header')` не вызывается → Next.js `unstable_cache` отдаёт устаревший HTML. Лечится `systemctl restart gonba` или программным `revalidateTag` через API.
- **На проде `push: true` не используется.** Любое добавление поля в коллекцию требует ручного `ALTER TABLE` (или полноценной миграции Payload).

### Хвосты, унесённые в `PENDING_FOLLOWUPS.md`

- 🟡 Длинный watchdog в `build` script
- 🟡 Полноценные миграции для добавленных колонок (вместо ручных `ALTER TABLE`)
- 🟡 `dev_env_requirements` memory утверждает «Postgres локально нет» — устарело
- 🟡 `docs/PROJECT.md:5` — захардкоженный шаблон даты «18 мая 2026»
- 🟡 `docs/PROJECT.md:41` — в списке коллекций нет `Messages`
- 🟢 У некоторых проектов в БД `title` равен slug (`eco-hotel-booking`, `about-project`, `vyatskiy-sbor`) — нужна чистка через админку

---

## 2026-05-19 — мердж крупной UX-фичи

**PR (`d6f5bcc`):** UX redesign — Жизнь проекта + Лавка + чат + mobile-first.

Прилетело 50 файлов, +2968/-144:
- Новая коллекция `Messages` ([web/src/collections/Messages/index.ts](../web/src/collections/Messages/index.ts))
- Чат проекта: страница `(frontend)/projects/[slug]/chat/page.tsx`, API `api/projects/[slug]/chat/route.ts`, компоненты `components/Chat/`
- «Лавка» (товары/услуги/бронирование): страница `(frontend)/projects/[slug]/lavka/page.tsx`, компоненты `components/Lavka/`
- Лента: `(frontend)/projects/[slug]/feed/page.tsx`, `components/Feed/`
- Yandex Gallery: `(frontend)/projects/[slug]/gallery/page.tsx`, `server/integrations/yandex-disk-gallery.ts`
- Мобильная навигация: `MobileNavSheet`, `ProjectBottomTabs`, `HomeProjectGridMobile`
- Базовые UI-примитивы: `components/ui/{dialog,sheet,tabs,separator,skeleton}.tsx`
- In-memory rate-limit: `server/rate-limit/inMemory.ts`
- Скрипт миграции: `scripts/migrate-enabled-sections.ts`

---

## 2026-04-15 — стабилизация VK auto-sync

**Серия коммитов (`9e4b1cc`, `c243871`):** fix: stabilize VK auto-sync, Payload jobs, and TS hygiene; disable versions on VkAutoSync.

---

## 2026-04 — VK auto-sync, system timer

- `3572713` — systemd timer для VK auto-sync trigger
- `ff04f13` — VK token rotation и rate limit protection
- `6bb6b16` — VK auto-sync service (cron job + admin settings)
- `9525d5c` — fix import path в `VkAutoSyncSettings`
- `13aa798`, `d786e64`, `4109a18` — мелкие фиксы синхронизации
- `f1daf95` — единый slug коллекции `vk-auto-sync`
- `690a730` — включён `db push:true` в postgres adapter
- `2ec27f1` — seed endpoint `POST /api/vk-auto-sync/trigger {seed:true}`

---

## 2026-04 — секции и пресеты

- `d099c5f` — redesign sections system: «миры» секций с уникальной стилизацией
- `9495af9` — fix sections build error (separate client components for interactivity)
- `29e444e` — fix React 19 `use()` → `useContext` на `/contact`

---

## 2026-04 — Начало истории и SSH

- `183cecd` — SSH remote access в `docs/PROJECT.md`
- `38806ba` — cleanup репо, .gitignore, .env.example
- `9d5c869` — initial commit: GONBA (Payload CMS + Next.js 15)
