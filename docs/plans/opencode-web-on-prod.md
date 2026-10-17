# OpenCode Web на прод-боксе (анонимный пул, доступ из браузера)

> План-ранбук, 17.10.2026. Запрос владельца: «поставить опенкод на прод и управлять им
> удалённо из браузера с любого компьютера; аккаунт анонимный — без ключа».
> Схема пулов взята у Мозга: плейбук `brain_matrica/docs/plans/opencode-two-pools-deploy.md`
> (два пула лимитов), грабли — [G460](../../../brain_matrica/cross-project-ideas/gotchas/G460.md)
> (пароль/сопряжение), [G463](../../../brain_matrica/cross-project-ideas/gotchas/G463.md)
> (утечка fff в `/tmp`).

## Что делаем

Ставим **OpenCode v2 (CLI + встроенный веб-UI)** на прод-бокс GONBA, но:

- сервер слушает **только loopback** (`127.0.0.1:49374`) — нового публичного порта нет;
- пул **анонимный**: без `auth login`, без ключей; работают бесплатные модели (лимит по IP);
- вход в браузере — по одноразовой ссылке сопряжения (5 минут) → cookie-сессия ≈30 дней;
- наружу попадаем **через SSH-туннель** с компьютера владельца.

## Раскладка на боксе

| Что | Где |
|---|---|
| Бинарник | `/usr/local/bin/opencode` (v2.0.32, из `opencode.ai/update/api/latest/cli/opencode/opencode-linux-x64.tar.gz`, sha256 архива `ba3f5d9dd983f12f06981b5b9eb966c03db63266afab28adc4000bbad6adc33c`) |
| Юнит сервера | `deploy/systemd/opencode-web.service` → `/etc/systemd/system/opencode-web.service` |
| Данные пула | `/home/valstan/.local/share/opencode-anon` (`XDG_DATA_HOME`) — своя `opencode.db`, свой пул лимитов |
| Пароль сервера | `/home/valstan/.config/opencode-web/anon.env` (`OPENCODE_PASSWORD=…`, `chmod 600`) — в git не попадает |
| Глобальный конфиг/политики | `deploy/opencode/opencode.json` → `/home/valstan/.config/opencode/opencode.json` |
| Рабочий каталог агента | `/home/valstan/work/GONBA` — **отдельный клон**, не боевой `/home/valstan/GONBA` |
| Метёлка `/tmp` (G463) | `scripts/opencode-tmp-sweep.sh` → `/usr/local/bin/opencode-tmp-sweep` + `opencode-tmp-sweep.{service,timer}` |

## Как входить (с компьютера владельца)

```bash
# 1. Туннель (алиас GONBA уже в ~/.ssh/config)
ssh -N -L 14974:127.0.0.1:49374 GONBA

# 2. Одноразовая ссылка (пароль не печатается — берётся на боксе из anon.env)
ssh GONBA "opencode-pair-link 49374 14974"
→ http://127.0.0.1:14974/auth/connect/<код>

# 3. Открыть ссылку в браузере своего компьютера
```

Одним кликом на Windows: `powershell -ExecutionPolicy Bypass -File scripts\opencode-web.ps1`
(поднимает туннель, берёт ссылку, открывает браузер; окно держать открытым).

Почему не «просто порт наружу»: у сервера нет TLS, а внутри — агент с shell-доступом
к общему боксу, где живут чужие проекты и `/etc/gonba/gonba.env`. Туннель даёт тот же
браузерный UI без новой публичной поверхности.

Порт `49374` — дефолт OpenCode для Linux (одна константа в юните и документации).
Локальный порт `14974` выбран, чтобы не столкнуться с локальными пулами `:4096`/`:4097`.

## «Добрый сосед» (бокс общий: 1 ядро, ~650 МБ свободной ОЗУ, 6.9 ГБ диска)

- `Nice=5`, `CPUWeight=50`, `IOWeight=50` — под нагрузкой соседи важнее агента.
- `MemoryHigh=500M`, `MemoryMax=700M`, `MemorySwapMax=0`, `OOMScoreAdjust=200` —
  при нехватке памяти ядро убивает агента, а не Postgres/nginx/gonba.
  Замер 17.10: первый старт 362 МБ (пик 387 МБ, прогрев), устоявшееся состояние 220 МБ (пик 274 МБ).
- `StartLimitBurst=5/300s` — цикл падений не превращается в молотилку.
- **Никаких сборок на боксе.** Канон проекта: сборка — в CI (`deploy-prod.yml`),
  на боксе только рантайм. Прогон `npm run build` на этом боксе бьёт соседей.
- `PrivateTmp=yes` — утечка fff (G463) не попадает в общий `/tmp` бокса.

## Где агент работает

`WorkingDirectory=/home/valstan/work/GONBA` — **отдельный клон** репозитория.
Боевое дерево `/home/valstan/GONBA` трогать нельзя: деплой делает
`git pull --ff-only origin main` и падает на незакоммиченных локальных правках
([deploy-prod.yml](../../.github/workflows/deploy-prod.yml) — шаг проверки чистоты дерева).

Правки уходят обычным PR-флоу (`gh` на боксе авторизован как Valstan, scopes `repo`, `workflow`).

## Политики (жёсткие запреты)

`deploy/opencode/opencode.json` переносит канон `.claude/settings.json` на бокс и добавляет
бокс-специфику: `deny` на `git push origin main|master` (все формы, включая force),
`gh workflow run deploy*`, `sudo *` и чтение `/etc/gonba/*` (прод-секреты).
Политики — не «спросить», а жёсткий блок: их нельзя снять одобрением в UI.

Плюс `NoNewPrivileges=yes` в юните: `sudo`/`su` внутри юнита не работают даже без политики.
Прод-операции (рестарты, миграции) остаются за владельцем — по канону #025.

## G463 — утечка `/tmp` (почему это отдельная забота)

Наш бокс — Linux, а платформенная граница по этой грабле в экосистеме не разведана:
у Мозга и корпуса второго opencode на Linux-боксе нет, а у SARAFAN 15.10 утечка съела
диск до 100% и уронила Postgres. Поэтому:

1. `PrivateTmp=yes` — сервис пишет в свой `/tmp` (чистится при остановке юнита);
2. `opencode-tmp-sweep.timer` каждые 15 минут сносит в `/tmp` и `/var/tmp` файлы вида
   `*-00000000.so` / `*-00000000.dylib` старше 60 минут — страховка для запусков вне юнита;
3. замер до/после первого запуска (см. «Приёмка») — вклад в разведку платформы.

## Установка (по шагам)

```bash
# 0. предпосылки: gcc-подобные — не нужны, бинарник статичный ELF x86-64 (glibc 2.39, avx2 есть)

# 1. бинарник (архив, без curl|bash)
curl -fsSL -o /tmp/opencode-linux-x64.tar.gz \
  https://opencode.ai/update/api/latest/cli/opencode/opencode-linux-x64.tar.gz
tar -xzf /tmp/opencode-linux-x64.tar.gz -C /tmp/oc-install
sudo install -m 0755 /tmp/oc-install/opencode /usr/local/bin/opencode
opencode --version

# 2. каталоги и пароль (пароль не печатать в чат/логи)
mkdir -p ~/.config/opencode-web ~/.local/share/opencode-anon ~/work
chmod 700 ~/.config/opencode-web
[ -s ~/.config/opencode-web/anon.env ] || \
  printf 'OPENCODE_PASSWORD=%s\n' "$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40)" \
  > ~/.config/opencode-web/anon.env
chmod 600 ~/.config/opencode-web/anon.env

# 3. глобальный конфиг с политиками
mkdir -p ~/.config/opencode
cp ~/GONBA/deploy/opencode/opencode.json ~/.config/opencode/opencode.json

# 4. рабочий клон (не боевой!)
[ -d ~/work/GONBA ] || git clone https://github.com/Valstan/Gonba.git ~/work/GONBA

# 5. юниты и метёлка
sudo cp ~/GONBA/scripts/opencode-tmp-sweep.sh /usr/local/bin/opencode-tmp-sweep
sudo chmod 0755 /usr/local/bin/opencode-tmp-sweep
sudo cp ~/GONBA/scripts/opencode-pair-link.sh /usr/local/bin/opencode-pair-link
sudo chmod 0755 /usr/local/bin/opencode-pair-link
sudo cp ~/GONBA/deploy/systemd/opencode-web.service \
        ~/GONBA/deploy/systemd/opencode-tmp-sweep.service \
        ~/GONBA/deploy/systemd/opencode-tmp-sweep.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opencode-web.service
sudo systemctl enable --now opencode-tmp-sweep.timer
```

## Приёмка (17.10.2026)

- [x] `systemctl is-active opencode-web` → `active`; `ss -ltn` → `127.0.0.1:49374`, публичного слушателя нет.
- [x] корень `http://127.0.0.1:49374/` → `200` (это только статика — G460).
- [x] `/api/info` без пароля → `401`; с паролем из `anon.env` → `200`.
- [x] `opencode models --server …` → 10 бесплатных моделей `opencode/*-free` (beam, big-pickle, deepseek-v4.1-flash-free, glm-5.3-flash-free, longcat-2.5-preview-free, mimo-v2.6-flash-free, nemotron-3-ultra-free, nemotron-3.5-lightning-free, nemotron-3.5-super-vl-free, space-bunny-free).
- [x] `opencode run --server … "Ответь одним словом"` → ответ получен моделью по умолчанию пула (`big-pickle`) **без единого ключа**.
- [x] `opencode auth list --server …` → `No authenticated integrations` (в аккаунт не входили).
- [x] изоляция: свой `XDG_DATA_HOME`, свой порт, кука `opencode_session_14974` (имя включает локальный порт туннеля).
- [x] туннель с компьютера владельца: корень через `127.0.0.1:14974` → `200`, `/api/info` → `401`; ссылка входа отдаёт `302 → /` + `set-cookie: opencode_session_14974`, после чего `/api/info` → `200`.
- [x] `/tmp`: файлов `*-00000000.*` на хосте `0` до и после прогонов; у юнита свой приватный `/tmp` (`/tmp/systemd-private-*-opencode-web.service-*/tmp`) — утечка G463 в общий `/tmp` не идёт.
- [x] метёлка: подложенный файл старше 60 минут удалён, свежий оставлен, строка в journal; таймер в `systemctl list-timers` (каждые 15 мин).
- [x] замер ресурсов: первый старт 362 МБ RSS (пик 387 МБ, прогрев), устоявшееся состояние 220 МБ (пик 274 МБ) при ~910 МБ доступной ОЗУ; диск 6.5 ГБ свободно (78%).

**Найденные тонкости (в канон):**

1. Голый `opencode` (без `--server`) на боксе поднимает **свой фоновый сервис на `:49374`** и падает с «port is already in use» — CLI запускать с `--server http://127.0.0.1:49374`.
2. Ссылка `/auth/connect/<код>` отдаёт куку только при браузерном `Accept: text/html` (`302` + `set-cookie`); при `Accept: application/json` вместо куки выдаёт `{"token":"…"}` — это путь приложений, не браузера.
3. `opencode run` без явного `< /dev/null` **съедает stdin**, если вызван в скрипте по пайпу — остаток скрипта уходит модели как промпт.
4. `opencode models` без `XDG_DATA_HOME` смотрит в дефолтный каталог данных — для пула задавать `XDG_DATA_HOME=/home/valstan/.local/share/opencode-anon`.

## Откат

```bash
sudo systemctl disable --now opencode-web.service opencode-tmp-sweep.timer
sudo rm /etc/systemd/system/opencode-web.service \
        /etc/systemd/system/opencode-tmp-sweep.{service,timer}
sudo systemctl daemon-reload
# данные пула и пароль остаются: rm -rf ~/.local/share/opencode-anon ~/.config/opencode-web
```

## Дальше (не в этой итерации)

- Второй пул — **аккаунтный** (`:49375`, свой `XDG_DATA_HOME`, ключ с `opencode.ai/auth`):
  отдельный пул лимитов, вход строго в нём. Схема Мозга: никогда не логиниться в анонимном пуле.
- Доступ «с любого компьютера без SSH» — `opencode pair --remote` (OpenTunnel, E2E-шифрование,
  пароль сервера). Требует явного согласия владельца: это публикация наружу.
- Письмо Мозгу отправлено 17.10 (`mailbox/to-brain/2026-10-17-opencode-web-pool-on-linux-prod.md`):
  замер платформенной границы G463 (Linux, v2.0.32 — утечки нет), три грабли Linux-схемы
  (порт 49374 занят дефолтом managed-сервиса, кука pair-ссылки только под `Accept: text/html`,
  `opencode run` съедает stdin) + вопрос про неполученную инструкцию.
