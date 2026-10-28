# Session Handoff

**Status:** IDLE
**Updated:** 2026-10-28
**Branch:** main
**Прод:** содержимое прода = `fda87a7` ([PR #328](https://github.com/Valstan/Gonba/pull/328)), деплой `40765223637` success; перед ним `4f29210` ([PR #327](https://github.com/Valstan/Gonba/pull/327)), деплой success. Health 200, главная 200, admin 200. **Улей** (движок `opencode v2.0.32` на loopback `127.0.0.1:49374`, `neural-vpn` поднят, оба юнита `disabled`) — без изменений с прошлой сессии. Диск 83 % (триггер 85 %), RAM: доступно ~498 МБ.

---

## Текущая нитка

Сессия — **закрытие открытого письма Мозга `2026-10-22-webmaster-pass-gonba-missing-title`**: рекомендация Вебмастера «на части страниц нет `<title>` и нет description» воспроизведена на проде и оказалась **не про кэш и не про робота**.

**Что было (замер до правки):** `/events`, `/services`, `/shop` и **все** их карточки (`/events/[slug]` 9, `/services/[slug]` 16, `/shop/[slug]` 3 — 28 документов + 3 списка) не отдавали `<title>` вообще: у маршрутов не было ни `metadata`, ни `generateMetadata`. Вторая причина — `generateMeta` без фолбэка: при пустом `meta.title` (`/o-proekte`, `/contact`) подставлялось имя сайта, а `description` пробрасывался как есть, поэтому его не было ни у кого, кто не заполнил SEO-поле руками (`/posts`, `/search` тоже).

**Что сделано (два PR):** [#327](https://github.com/Valstan/Gonba/pull/327) — `generateMeta` принимает структурный `MetaDoc` (`title`/`slug`/`summary`/`meta`) и обслуживает pages/posts/events/services/products; заголовок `meta.title` → `title` документа, описание `meta.description` → `summary` → описание сайта с заголовком страницы; метаданные у списков и карточек events/services/shop, description у `/posts` (+пагинация) и `/search`. [#328](https://github.com/Valstan/Gonba/pull/328) — догон по факту деплоя: у VK-импорта `title` — целая строка поста, страница отдала `<title>` в **192 знака**, добавлено мягкое усечение по границе слова (окно 60) **только для `doc.title`** (`meta.title` автора не режем); фолбэк-описание перестало склеивать два тире.

**Данные в БД не правились** — и это осознанно: описания выводятся из существующих `title`/`summary`, значит по versioned-докам не понадобился ни сырой SQL (он не доходит до плагина поиска и затирается следующей публикацией), ни разовый Local API-прогон на проде.

**Приёмка после деплоя:** `/events` 25 зн. title + description, `/services` 25 + description, `/shop`, `/events/<slug>` 70 зн. (обрыв по слову), `/services/prokat-sapov`, `/shop/vyatka-honey`, `/o-proekte` («О проекте ГОНЬБА | Жемчужина Вятки»), `/contact`, `/posts`, `/search` — все с title и description. Контроль-негатив: `/` и `/usadba` не изменились. Гейты: оба PR — `web-quality` зелёный; локальные typecheck/lint не гонялись (правило улья), деплой-гейт G24 проверен перед каждым мержем.

## Следующий шаг

1. **Почта Мозга** — на `/start` смотреть `from-brain/` двухканально. Ответ по вебмастеру отправлен: `mailbox/to-brain/2026-10-28-webmaster-titles-fixed-and-salvage-closed.md` (маршруты, причина, что сделано + строка о сносе salvage + попутно про образ раннера).
2. **`ubuntu-latest` → Ubuntu 26 (due 25.10 — срок прошёл).** Пункт закрыт по существу 28.10: образ **по-прежнему Ubuntu 24.04** (`Image Release: ubuntu24/20261012.334`). Метод, который сработал, — не `gh run view --log` (он отдаёт пустой лог), а API-zip: `curl -sL -H "Authorization: token $(gh auth token)" -o ci.zip https://api.github.com/repos/Valstan/Gonba/actions/runs/<id>/logs` + `grep "Runner Image"`. Возврат: первый красный прогон на этой теме.
3. **Два клиентских запускателя** (`scripts/opencode-web.ps1` vs `scripts/gonba-kit/`) — решить: поглощение или разделение ролей в шапках.
4. **Диск 83 %** (`~/.cache/ms-playwright` 681 МБ + `~/.npm` 390 МБ — замер 28.10): снять, это не данные.
5. **Открытые вопросы к владельцу:** восстановление комнаты KARMAN (bootstrap-токен + происхождение значения в GH secret); G135 — шесть FK-мин (design + прод-DDL, `#025`); DeepSeek top-up (VK-план «Афиша»); ротация SSH CI-ключа **до 08.11**.

## Контекст

- **План/ранбук улья:** [`docs/plans/opencode-web-on-prod.md`](plans/opencode-web-on-prod.md) (раздел «Возврат улья на бокс 28.10»). Серверная половина — [`deploy/neural/README.md`](../../deploy/neural/README.md), клиентская — [`scripts/gonba-kit/README.md`](../../scripts/gonba-kit/README.md).
- **Коммиты сессии:** `4f29210` (#327), `fda87a7` (#328).
- **Единый источник фактов о сайте** — `web/src/seo/site.ts` (`SITE.name`/`description`/`sections`); новые метаданные берут имя сайта оттуда, литералов «Жемчужина Вятки» в новом коде нет.
- **Гейты:** локальные typecheck/lint внутри улья **не** гоняем (memory pressure, `deny` в `deploy/opencode/opencode.json`); гейт = зелёный `web-quality`. Деплой-гейт G24 — `bash scripts/deploy_gate_check.sh --gate` перед каждым мержем.
- **Гидратация:** правки чисто метаданные (head), клиентские бандлы не менялись; визуальный браузерный чек в улье не снимали — проверены RSC-payload и чанки в HTML (`self.__next_f.push` на месте), контент рендерится.

## Не забыть (low-priority)

- **Копия набора на рабочем столе** `D:\Desktop\GONBA\` — после правок `scripts/gonba-kit/` сверять хеш (`Copy-Item` + `Get-FileHash`), иначе ярлыки живут старым кодом.
- **Подписка ВПН — только на боксе** (`/etc/neural/vpn/subscription.url`, 600 root). В git не идёт и не должна; `deploy/neural/README.md` описывает установку с нуля без значения.
- **Бинарник `xray` ставится руками** (деплой везёт скрипты и юнит, но не 25 МБ бинаря) — триггер: новая машина или апдейт xray.
- **Клон агента обновляется кликом «Чат»** (`git pull --ff-only` в `~/repo/Gonba`), деплой его не трогает — он тянет боевое дерево `~/GONBA`.
- **Ссылка входа одноразовая (≈5 мин)**, после рестарта движка кука-сессия рвётся — нужна новая через «Чат».
- **Ротация SSH наполовину (с 09.10):** новый ключ пускает только с этой машины, CI ходит старым — старую строку из `authorized_keys` не снимать до зелёного штатного деплоя. Полная ротация — до 2026-11-08.
- **`web/next-env.d.ts`** переписывается при локальном `lint`/`build` — после гейтов `git status` и откат.
- **Проверка пуша:** «push timed out» ≠ успех — всегда `git ls-remote <ref>` + сверка SHA.
- **Windows-машина (dev):** локальный Postgres 17.5 есть, но `web/.env` указывает на устаревшую учётку `postgres`; рабочие креды — `%USERPROFILE%\pg-local-credentials.json`, поле `creds.GONBA`.
- **На боксе лежит чужой `/tmp/prod-cleanup.sh`** — общий бокс, не трогать.

---

> Sticky note — 28.10 (вторая половина дня): письмо Мозга по вебмастеру закрыто кодом, прод `fda87a7` (#327 + #328). Найдено: не кэш, а **отсутствие метаданных-экспорта у целых разделов** (28 карточек + 3 списка) плюс `generateMeta` без фолбэка на `title`/`summary`. Побочный эффект первого захода — `<title>` в 192 знака у VK-импорта, поймали сразу после деплоя и закрыли до конца дня. Попутно: образ раннера — **ubuntu24/20261012.334**, то есть переезда на Ubuntu 26 нет; достаётся он только API-zip'ом, `gh run view --log` пуст. Открыто: два клиентских запускателя, диск 83 %, KARMAN Vault, G135, DeepSeek top-up, ротация SSH до 08.11.
