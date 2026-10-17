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
| Рабочий каталог агента | `/home/valstan/repo/Gonba` — **отдельный клон**, не боевое дерево `/home/valstan/GONBA`; юнит стартует через ярлык `~/work/GONBA` → `~/repo/Gonba` |
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

**Переносимый запускатель (любой компьютер).** Файлы: `scripts/opencode-web.ps1` + `scripts/opencode-web.cmd` (Windows, двойной клик) и `scripts/opencode-web.sh` (Linux/macOS/Git Bash). На новом компьютере: запустил → если алиас `GONBA` есть, всё само; иначе `-Setup`/`--setup` заведёт цель, порты и ключ, сохранив `opencode-web.conf` рядом (локальный, в git не идёт). Проверка готовности: `-Check`/`--check`. Скрипт не содержит адреса бокса/пользователя — только алиас `GONBA` и порты, уже опубликованные в юните (функциональная необходимость).

Тонкость (грабля клиента): OpenSSH для Windows не завершает процесс и не отдаёт вывод, если его std-хендлы перенаправлены (запуск не из консоли) — процесс висит, а вывод приходит с задержкой ≈9 секунд. Запускатель ждёт в выводе маркер `OC_DONE:<код>` и добивает ssh, чтобы не оставлять зомби; в интерактивной консоли ssh завершается сам. В неинтерактивной среде каждый вызов бокса стоит ≈10 секунд — это ожидаемо.

### Проверка запускателя: `-Check` доказывает не всё

17.10 `-Check` был зелёным, а двойной клик по ярлыку падал:

```
Невозможно вызвать метод для выражения со значением NULL.
...opencode-web.ps1:178   +     return @{ status = $status; code = $code; out = $text; err = $err ...
FullyQualifiedErrorId : InvokeMethodOnNull
```

Причина: при двойном клике из настоящей консоли ssh на Windows не пишет в stderr ничего, `Get-Content -Raw` на пустом файле отдаёт `$null` (а не пустую строку), и `.Trim()` по нему — исключение. Падало сразу после подъёма туннеля, до ссылки входа. Неинтерактивный прогон этот случай маскировал (там ssh добавляет в stderr предупреждение `GetConsoleMode`, файл не пуст) — то есть зелёный `-Check` **не доказывал** работоспособность ярлыка (pool #011, «зелёный пайплайн ≠ корректный результат»). Лечение: `Read-OcRawText` в запускателе + регрессия, которая подставляет **реально пустой** stderr в две копии — с нулевой защитой и без неё:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\opencode-web.test.ps1
→ RED: копия без защиты падает (InvokeMethodOnNull) · GREEN: текущая проходит -Check · E2E: двойной клик отдаёт ссылку
```

Копия без защиты собирается из текущего файла вырезанием строки-защиты, так что тест самодостаточен (не зависит от старых версий). Нужен ssh-доступ к боксу. E2E-шаг идёт только при уже поднятом туннеле — чтобы не оставлять за собой лишнее окно ssh; если ssh не отдал вывод за 60 с, тест помечает e2e как `inconclusive`, а не как успех.

### Если ссылка входа не приходит («SSH не ответил за 30 с»)

Это, как правило, не запускатель. Замер 17.10 на боксе в момент таких отказов: `load average` 0.05 (бокс не нагружен), но в `ss -t**a**n state syn-recv` висело 40–60 полуоткрытых соединений к публичному IP (443/80/22) с чужих сканирующих адресов. Полуоткрытые соединения занимают у sshd слоты «неаутентифицированных», а при превышении `MaxStartups` (дефолт `10:30:100`; свой `/etc/ssh/sshd_config.d/10-hardening.conf` без root не читается, значение не подтверждено) sshd начинает отбрасывать часть новых подключений — клиент висит до таймаута. Запускатель повторяет запрос ссылки один раз; если и это не помогло — повтори ярлык через минуту, слоты освобождаются сами. Это фон интернета, а не следствие работы агента.

Замер мелкой подробности на будущее: у `ss` фильтр `state syn-recv` **без `-a`** даёт неверную картину (в замере 17.10 без `-a` вышло 0 при фактических 40) — считать состояния только с `-a` (или гистограммой `ss -tan | awk 'NR>1{print $1}' | sort | uniq -c`).


Почему не «просто порт наружу»: у сервера нет TLS, а внутри — агент с shell-доступом
к общему боксу, где живут чужие проекты и `/etc/gonba/gonba.env`. Туннель даёт тот же
браузерный UI без новой публичной поверхности.

Порт `49374` — дефолт OpenCode для Linux (одна константа в юните и документации).
Локальный порт `14974` выбран, чтобы не столкнуться с локальными пулами `:4096`/`:4097`.

## Ротация пароля сервера (17.10, проверено)

Источник истины по паролю — **файл окружения**, а не внутренняя база OpenCode: юнит грузит
`EnvironmentFile=~/.config/opencode-web/anon.env`, и сервер берёт `OPENCODE_PASSWORD` оттуда.
(Прежняя запись вида `opencode service set password <новый>` на нашей схеме лишняя — значение всё
равно перетирается файлом.)

```bash
# на боксе: новое значение + рестарт. Без sudo рестарт не пустит:
#   «Failed to restart opencode-web.service: Interactive authentication required.»
NEW="$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40)"
umask 077; printf 'OPENCODE_PASSWORD=%s\n' "$NEW" > ~/.config/opencode-web/anon.env
chmod 600 ~/.config/opencode-web/anon.env; unset NEW
sudo -n systemctl restart opencode-web
```

Проверка — три замка (все 17.10 сошлись): `/api/info` **без** пароля → `401`; `opencode api
--server http://127.0.0.1:49374 GET /api/info` **со** свежим `anon.env` → OK; `POST /api/pair`
без пароля → отказ, а `opencode-pair-link` с новым паролем → ссылку отдаёт (это и доказывает, что
ротация доехала до сервера, а не осталась в файле). Сам пароль в вывод не печатаем — только длину
и права файла.

Побочный эффект: рестарт рвёт cookie-сессию (≈30 дней) — владельцу достаточно одного двойного
клика по ярлыку, запускатель сам возьмёт свежую ссылку. Сайт рестарт агента не задевает: юниты
независимы, `gonba.service` не перезапускается.

## «Добрый сосед» (бокс общий: 1 ядро, ~650 МБ свободной ОЗУ, 6.9 ГБ диска)

- `Nice=5`, `CPUWeight=50`, `IOWeight=50` — под нагрузкой соседи важнее агента.
- `MemoryHigh=500M`, `MemoryMax=700M`, `MemorySwapMax=0`, `OOMScoreAdjust=200` —
  при нехватке памяти ядро убивает агента, а не Postgres/nginx/gonba.
  Замеры 17.10 шли вверх, и это важнее самих чисел: первый старт 362 МБ (пик 387 МБ, прогрев),
  через 5,5 ч — 252 МБ (пик 391 МБ), **а к вечеру, через 8,3 ч жизни, — 510 МБ при пике 525 МБ**,
  то есть вплотную к `MemoryHigh` (500 МиБ = 524 288 000 байт) при `MemoryMax` 700 МиБ.
  Вывод честный: «устоявшиеся 220–250 МБ» — это состояние первых часов, а не потолок.
  **Вечерний замер того же дня (22:48, аптайм 3,5 ч) закрыл открытый вопрос:** `systemd-cgls`
  показывает **один** процесс (`opencode serve`) и **ни одного** дочернего процесса модели —
  модель ходит по сети, локальных детей у сервера нет, то есть число держит сам сервер вместе
  с состоянием активной сессии. Числа: **426 МБ** при пике **500,4 МБ** (0,99 от `MemoryHigh` —
  порог задет, но не пробит; `NRestarts=0`, oom 0). Рост немонотонный (510 → 426 МБ), значит
  цифра идёт за нагрузкой, а не течёт сама. Оговорка: сессия, которая мерила, живёт в том же
  cgroup и её состояние — часть числа; суточный замер 18.10 и решение по потолку — ещё открыты
  (пункт в backlog, due 18.10).
  Потолок 700 МБ выбран сознательно: пусть ядро убьёт агента, а не уведёт в swap общий бокс;
  поднимать — только по замеру, помня про ~670 МБ доступной ОЗУ и 808 МБ занятого swap.
- `StartLimitBurst=5/300s` — цикл падений не превращается в молотилку.
- **Никаких сборок на боксе.** Канон проекта: сборка — в CI (`deploy-prod.yml`),
  на боксе только рантайм. Прогон `npm run build` на этом боксе бьёт соседей.
- `PrivateTmp=yes` — утечка fff (G463) не попадает в общий `/tmp` бокса.

## Где агент работает

`WorkingDirectory=/home/valstan/work/GONBA` — **отдельный клон** репозитория, а после
переезда 17.10 реальный путь у него `/home/valstan/repo/Gonba` (юнит резолвится ярлыком
`~/work` → `repo`, `repo/GONBA` → `Gonba`; новые клоны на боксе заводим уже в `~/repo/`).
Боевое дерево `/home/valstan/GONBA` трогать нельзя: деплой делает
`git pull --ff-only origin main` и падает на незакоммиченных локальных правках
([deploy-prod.yml](../../.github/workflows/deploy-prod.yml) — шаг проверки чистоты дерева).

Правки уходят обычным PR-флоу (`gh` на боксе авторизован как Valstan, scopes `repo`, `workflow`).

**Юнит поставлен вручную, а не деплоем** — `deploy-prod.yml` идемпотентно ставит только
`gonba.service` и таймеры (`gonba-vk-sync`, `gonba-media-cache`), улей в этот список не входит.
Значит источник правды по юниту — копия на боксе (`systemctl cat opencode-web`), а файл
`deploy/systemd/opencode-web.service` — её происхождение; правя одно, сверь с другим.

### Чего агент в улье не может — и почему это свойство установки, а не случайность

`sudo *` и чтение `/etc/gonba/*` запрещены политикой, плюс в юните стоит `NoNewPrivileges=yes`.
Следствие, которое надо помнить при планировании работ: **изнутри улья невозможны замеры по
прод-БД, правки юнитов, рестарты сервисов и любые прод-операции** — это делает сессия с `sudo`
(Claude Code на боксе). Замер, который агент улья всё-таки может: `systemctl show`/`systemd-cgls` по
своему юниту, `journalctl` по нему, `/api/health` сайта, `git grep` по репозиторию.
Обратная сторона — полезная: агент улья не может случайно сломать прод, а гейт #025 для него
не «спросить и забыть», а физическая невозможность.

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

## Глаза: headless-браузер на боксе (директива brain 17.10 — выполнена)

Зачем: бокс безголовый, модель не видит ни создаваемого интерфейса, ни GUI вообще. Ставим локальный
Chromium **без окон**: агент сам открывает свой сайт, снимает PNG и читает его как картинку.

```bash
# 1. браузер — user-local, без sudo, ноль системных изменений (проверено 17.10)
npx -y playwright@latest install chromium          # 681 МБ в ~/.cache/ms-playwright

# 2. снимок интерфейса: PORT — порт dev-сервера, который строит сессия (локальный 127.0.0.1)
npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=5000 \
  http://127.0.0.1:PORT shot.png
# → дальше модель читает shot.png как изображение
```

Модель нужна **с vision** — по названию в нашем пуле такая одна, `nemotron-3.5-super-vl-free`
(«vl»; картинкой ещё не проверяли — проверить при первом живом использовании); текстовые free
(`deepseek-v4.1-flash-free`, `big-pickle` и прочие) картинок не читают, для «посмотри» модель
переключают в сессии. **Скрины остаются на боксе** (на экране бывает что угодно) — в письма
и репозиторий их не таскать.

**Три факта, добытых замером (портативны, отписаны Мозгу):**

1. **`npx playwright screenshot` работает как есть, а сырой бинарь полного Chrome — нет.**
   На Ubuntu 24.04 стоит `kernel.apparmor_restrict_unprivileged_userns=1`: песочница пространств
   имён запрещена политикой, поэтому `chrome --headless=new` в юните с `NoNewPrivileges=yes`
   завершается `rc=134` (abort, core dump). С `--no-sandbox` тот же бинарь страницу снимает.
   Канонической команде флаг не нужен — Playwright идёт через `chrome-headless-shell`.
2. **`sudo apt-get install chromium` на Ubuntu 24.04 — тупик:** у пакета `chromium` кандидата нет
   вовсе, а `chromium-browser` — snap-заглушка (`2:1snap1-0ubuntu2`). Рабочий путь один — Playwright.
3. **Система бокса не менялась:** отсутствующие mesa-пакеты (`libegl-mesa0`, `libgl1-mesa-dri`,
   `libglx-mesa0`, `mesa-libgallium`, `mesa-vulkan-drivers`) скриншотам не мешают, `--with-deps`
   не понадобился. Цена — 681 МБ `~/.cache/ms-playwright` + ~270 МБ npm-кэш (диск бокса 78% → 80%).

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
mkdir -p ~/.config/opencode-web ~/.local/share/opencode-anon ~/repo
chmod 700 ~/.config/opencode-web
[ -s ~/.config/opencode-web/anon.env ] || \
  printf 'OPENCODE_PASSWORD=%s\n' "$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40)" \
  > ~/.config/opencode-web/anon.env
chmod 600 ~/.config/opencode-web/anon.env

# 3. глобальный конфиг с политиками
mkdir -p ~/.config/opencode
cp ~/GONBA/deploy/opencode/opencode.json ~/.config/opencode/opencode.json

# 4. рабочий клон (не боевой!)
# Реальный путь после переезда 17.10 — ~/repo/Gonba; на этой машине путь в юните
# (~/work/GONBA) жив ярлыком. На НОВОЙ машине ярлыка не будет: либо клонируй
# в ~/work/GONBA, либо поправь WorkingDirectory юнита на реальный путь.
[ -d ~/repo/Gonba ] || git clone https://github.com/Valstan/Gonba.git ~/repo/Gonba

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

## Приёмка «глаз» (17.10.2026, вечер — по директиве `2026-10-17-headless-browser-for-opencode-dev`)

- [x] браузер скачан user-local: `chromium-1248` + `chromium_headless_shell-1248` + `ffmpeg-1013` (681 МБ, Playwright 1.64.1); **системных пакетов не ставили ни одного**, юнит агента не менялся.
- [x] каноническая команда из письма: `npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 https://example.com /tmp/eyes-pw.png` → rc=0, PNG **88 993 байта**, `file` подтверждает `PNG image data, 1440 x 900`.
- [x] **в контексте агента** (реплика юнита через `systemd-run`: `--uid=valstan`, `PrivateTmp=yes`, `NoNewPrivileges=yes`, `MemoryHigh=500M`/`MemoryMax=700M`, `Nice=5`, `CPUWeight=50`, `HOME=/home/valstan`): снимок своего сервиса `http://127.0.0.1:49374/` → rc=0, PNG **41 940 байт**, 1440×900, юнит завершился `result=success` (в лимит памяти уложился).
- [x] негативный контроль: сырой `chrome --headless=new --screenshot=…` **без** `--no-sandbox` → `rc=134` (та же стена песочницы и в контексте юнита) — отсюда и вывод, что канон идёт через headless-shell.
- [x] замер памяти агента на том же заходе (due-пункт backlog): `MemoryCurrent` **252 МБ**, `MemoryPeak` **391 МБ**, `NRestarts=0`, oom в журнале — **0**, метёлка `/tmp` — `удалено=0`.

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
