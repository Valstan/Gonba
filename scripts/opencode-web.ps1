# Запускатель веб-UI OpenCode на прод-боксе GONBA: SSH-туннель + вход в браузере.
#
# Что делает: поднимает `ssh -N -L <локальный порт>:127.0.0.1:<порт на боксе> <цель>`, забирает
# у бокса одноразовую ссылку входа (код живёт 5 минут) и открывает её в браузере ЭТОГО компьютера.
# Пароль сервера нигде не печатается и на этом компьютере не хранится.
#
# Запуск (двойной клик — `opencode-web.cmd` рядом, либо из консоли):
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1          # подключиться (выключенную службу поднимет сам)
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Setup   # настроить этот компьютер
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Check   # проверить, всё ли на месте
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -NoOpen  # не открывать браузер
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -NoWait  # не ждать Enter (туннель остаётся)
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Stop    # закрыть туннель этого компьютера
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Off     # ВЫКЛЮЧИТЬ: остановить службу на боксе и снять туннель
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Server <алиас>  # сервер из каталога (папка servers\)
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Servers  # какие серверы вообще лежат рядом
#
# Туннель и служба — разные вещи, и стоят они по-разному. Туннель — это одна ssh-сессия на боксе
# и один процесс ssh на этом компьютере: держать его поднятым дёшево (владелец так и хочет —
# закрыл браузер, туннель остался). А ест бокс САМ СЕРВЕР: юнит `opencode-web` в покое занимает
# ~180 МБ (замер 18.10: 185,9 МБ) и растёт с сессиями — 18.10 именно он упёрся в MemoryHigh=500M
# и задушил веб-UI. Поэтому `-Off` гасит службу (память возвращается боксу), а запуск без ключей
# поднимает её обратно: владелец держит прод лёгким, когда не работает, и включает одним ярлыком.
#
# Настройки компьютера лежат рядом со скриптом, в `opencode-web.conf` (шаблон — `opencode-web.conf.example`):
#   SSH_TARGET    — алиас из ~/.ssh/config этого компьютера либо user@host
#   IDENTITY_FILE — приватный ключ (пусто — ключи по умолчанию / ssh-agent)
#   LOCAL_PORT    — локальный порт туннеля (по умолчанию 14974)
#   REMOTE_PORT   — порт сервера на боксе (по умолчанию 49374)
# Файла нет — работают умолчания. Скрипт переносимый: ни адреса, ни пользователя внутри нет.
#
# Серверов может быть несколько: в папке `servers\` рядом со скриптом лежат фрагменты
# `servers\<алиас>.conf` — тот же диалект, что выше (их раскладывает Мозг, каталог серверов
# `docs/machines/servers/`). Выбор сервера — ключ `-Server <алиас>`, а что лежит рядом —
# ключ `-Servers`. Форму Мозг предложил 18.10.2026 (письмо «Формат пульта») и она принята
# как есть; отличие от умолчаний ровно одно: названный сервер не подменяется молча — нет
# фрагмента, значит остановка с перечнем того, что есть. Опечатка в имени не должна уводить
# запускатель на другой бокс, а «нет файла — работай как раньше» здесь означало бы именно это.
# Окно запускателя — пульт, а не туннель: сам `ssh` стартует СКРЫТО (`-WindowStyle Hidden`), поэтому
# чёрного окна ssh.exe на экране больше нет — 18.10 замерено, что оно есть и мешает (MainWindowHandle
# 395146 → 0 после правки). Enter в окне запускателя закрывает туннель; с `-NoWait` окно закрывается
# само, а туннель остаётся поднятым — закрыть его потом одним ключом `-Stop` (он же нужен Пасеке).
#
# Грабля клиента: OpenSSH для Windows не завершает процесс, если его std-хендлы перенаправлены
# (запуск не из консоли), хотя команда на боксе уже отработала. Поэтому здесь НЕ полагаемся на
# выход процесса: ждём в файле маркер `OC_DONE:<код>` и добиваем ssh, чтобы не оставлять зомби.
# В интерактивной консоли ssh завершается сам — маркер просто подтвердит успех.
#
# Грабля 18.10.2026 (вечер): «служба выключена, не могу поднять» и вечный цикл у владельца.
# На самом деле служба была **активна и молчала**: cgroup держал 548 МБ при MemoryHigh=500M,
# memory pressure 100 %, OOM не случился (`NRestarts=0`), ядро не убило никого — сервер
# задохнулся в пределах своего потолка и перестал отвечать на HTTP. Проверка службы «через
# туннель» не отличает молчащую службу от выключенной, поэтому запускатель честно печатал
# «поднимаю её» и делал `systemctl start` по **уже активному** юниту — то есть ничего, и так
# по кругу. Плюс `-Stop`/`-Off` проигрывали гонку: в юните `TimeoutStopSec` по умолчанию 90 с,
# а сессия запускателя ждала ровно столько же. Теперь тупик разбирается вопросом к боксу
# (`Get-OcBoxState`: юнит активен? сервер отвечает НА БОКСЕ?) и тремя разными исходами:
# выключен — поднять, активен и молчит — `restart`, активен и отвечает — виноват туннель,
# пересоздать его. Плюс сторож `opencode-web-watchdog.timer` на боксе ловит этот же класс
# без участия владельца (три немых проверки подряд → restart).
# Регрессия: scripts/opencode-web.test.ps1 (сценарии «активен и молчит» / «виноват туннель» /
# «выключен»).
#
# Находки Мозга 18.10.2026 (письмо «Замер запускателя на живом»: он прогнал ярлык с COMPUTER до
# чужого бокса, и канал там шёл через ВПН владельца). Первая находка — тихий `-LocalPort` — уже
# вылечена каталогом (`Resolve-OcSettings`: параметры командной строки старше файла). Две эти —
# здесь:
#   (2) повтор сессии заведён на КЛАСС ВЫВОДА, а не только на собственный 60-секундный таймаут.
#       На деградировавшем канале banner exchange занимал 10–15 с, ssh выходил САМ по
#       `ConnectTimeout` (тогда там стояло 8 с), и повтор этого не ловил: пять мёртвых окон подряд,
#       при том что туннель (он без потолка) поднимался всегда. Теперь потолок задан константой
#       `$SshConnectTimeoutSec = 20`, а класс ловит Test-OcRetryableSshFailure;
#   (3) туннель переиспользуется только у СВОЕЙ цели: прежде поиск шёл по паре портов, и туннель
#       к другому серверу на том же локальном порту молча подошёл бы — ссылка входа от одного
#       бокса, UI от другого. Теперь цель сверяется (Test-OcTunnelCommandLine), а «порт слушает»
#       перестало быть доказательством, что слушает НАШ ssh (Test-OcPortMine): чужой форвард
#       больше не подменяет собой свой.
# Регрессия на оба класса — четвёртая часть scripts/opencode-web.test.ps1 (офлайновая, без ssh).
# Честная граница: bash-версия (`opencode-web.sh`) этих правок не получила — она вообще осталась
# на ревизии #314 и не знает ни `-Stop`/`-Off`, ни сверки живости туннеля. Расхождение записано,
# а не спрятано: чинить его отдельной задачей, а не походя.

param(
    [string]$SshTarget = '',
    [int]$LocalPort = 0,
    [int]$RemotePort = 0,
    [string]$IdentityFile = '',
    [string]$Config = '',
    [string]$Server = '',
    [switch]$Servers,
    [switch]$Setup,
    [switch]$Check,
    [switch]$NoOpen,
    [switch]$NoWait,
    [switch]$Stop,
    [switch]$Off
)

$ErrorActionPreference = 'Stop'

# Ярлык запускают двойным кликом: непредвиденная ошибка должна выглядеть одной
# понятной строкой, а не стеком PowerShell (туннель, если он наш, за собой убираем).
trap {
    Write-Host ''
    Write-Host "Запускатель остановился с ошибкой: $($_.Exception.Message)"
    Write-Host 'Если туннель остался поднятым (чёрного окна ssh.exe больше нет — он стартует скрыто) — закрой его ключом -Stop и запусти ярлык снова.'
    try {
        if ($ownTunnel -and $tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
    } catch { }
    exit 1
}

$DefaultTarget = 'GONBA'
$DefaultLocalPort = 14974
$DefaultRemotePort = 49374
$RemoteUnit = 'opencode-web'
$PairHelper = 'opencode-pair-link'
$DoneMarker = 'OC_DONE'

# Чем ходить на бокс. Замер 18.10.2026 на машине владельца, один и тот же адрес, одна минута:
# curl и .NET открывают TCP за 78 мс, OpenSSH 10.5 из Git for Windows логинится целиком за 1,2 с,
# а системный «OpenSSH for Windows 7.7p1» (C:\Windows\System32\OpenSSH, сборка 2018 года) —
# за 11–30 с, а иногда не укладывается вообще. Копия того же файла под другим именем ведёт себя
# точно так же, значит дело не в правилах по имени приложения, а в самом клиенте. Поэтому клиент
# ВЫБИРАЕМ: берём самый свежий из найденных, системный — только если других нет (тогда `-Check`
# честно скажет, что вход будет медленным, и что поставить).
$SshExeCandidates = @(
    (Join-Path $env:ProgramFiles 'Git\usr\bin\ssh.exe'),
    $(if (${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} 'Git\usr\bin\ssh.exe' }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs\OpenSSH\ssh.exe' }),
    (Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe')
)
# Ниже 9 — это ветка 2018 года: соединение до бокса висит 11–30 с вместо 1,2 с.
$SshSlowMajorVersion = 9

function Get-OcSshExe {
    param([string[]]$Candidates)
    $found = @()
    foreach ($candidate in $Candidates) {
        if (-not $candidate) { continue }
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        $text = ''
        # `ssh -V` печатает версию в stderr, и при `$ErrorActionPreference = 'Stop'` это
        # исключение NativeCommandError, а не пустая строка (проверено 18.10: версия ловилась
        # в catch). Поэтому спрашиваем версию через cmd /c с явным 2>&1.
        try { $text = (cmd /c "`"$candidate`" -V 2>&1").Trim() } catch { $text = '' }
        $major = 0
        if ($text -match 'OpenSSH[_\s]+(?:for_Windows_)?(\d+)') { $major = [int]$Matches[1] }
        $found += [pscustomobject]@{ Path = $candidate; Major = $major; Text = $text }
    }
    if ($found.Count -eq 0) { return $null }
    return ($found | Sort-Object -Property Major -Descending | Select-Object -First 1)
}

# Потолок одной ssh-сессии до бокса. Публичный :22 бокса живёт под сканерами, sshd придерживает
# новые подключения: замер 18.10 — 78–81 соединение в SYN-RECV, холодный вход занял 42,5 с. Прежние
# 30 с давали ложное «SSH не ответил» и у `-Check`, и у ярлыка владельца (поймано на живом прогоне).
$SshSessionTimeoutMs = 60000

# Потолок на СОГЛАСОВАНИЕ (`ConnectTimeout`) для одиночных сессий. Было 8 с — и на деградировавшем
# канале (замер Мозга 18.10 вечером: COMPUTER → другой бокс через ВПН владельца, banner exchange
# 10–15 с) ssh выходил САМ по этому потолку раньше, чем получал баннер: запрос ссылки падал
# детерминированно, пять окон подряд, при том что туннель (у него потолка нет) поднимался всегда.
# 20 с — не роскошь: повтор остаётся, но теперь первая же попытка имеет шанс дойти.
$SshConnectTimeoutSec = 20

# ---------------------------------------------------------------- чтение вывода

# `Get-Content -Raw` на ПУСТОМ файле отдаёт $null, а не пустую строку. Дальше
# `.Trim()` в Invoke-OcSshSession падал с «Невозможно вызвать метод для выражения
# со значением NULL» — и ровно в том сценарии, для которого запускатель написан:
# двойной клик из настоящей консоли. Там ssh, в отличие от консоли без stdin, не
# сыплет предупреждением GetConsoleMode, stderr пуст — и запускатель умирал сразу
# после подъёма туннеля. Регрессия на этот класс: scripts/opencode-web.test.ps1
# (подставляет реально пустой stderr и гоняет копию с защитой и без неё).
function Read-OcRawText {
    param([string]$Path)
    $raw = ''
    if (Test-Path -LiteralPath $Path) {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
        if ($null -eq $raw) { $raw = '' }
    }
    return $raw
}

# ---------------------------------------------------------------- файл настроек

function Read-OcConfig {
    param([string]$Path)
    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $result }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $text = $line.Trim()
        if ($text.Length -eq 0) { continue }
        if ($text.StartsWith('#')) { continue }
        $eq = $text.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $text.Substring(0, $eq).Trim().ToUpperInvariant()
        $value = $text.Substring($eq + 1).Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $result[$key] = $value
    }
    return $result
}

function Write-OcConfig {
    param([string]$Path, [hashtable]$Values)
    $lines = @(
        '# Настройки запускателя OpenCode Web на ЭТОМ компьютере.',
        '# Правится вручную или через `opencode-web.ps1 -Setup`.',
        '',
        '# Куда идти по SSH: алиас из ~/.ssh/config этого компьютера либо user@host.',
        "SSH_TARGET=$($Values.ssh_target)",
        '',
        '# Приватный ключ (пусто — ключи по умолчанию / ssh-agent). Путь лучше с прямыми слэшами.',
        "IDENTITY_FILE=$($Values.identity_file)",
        '',
        '# Локальный порт туннеля на этом компьютере (должен быть свободен).',
        "LOCAL_PORT=$($Values.local_port)",
        '',
        '# Порт, на котором сервер OpenCode слушает на боксе. Менять не нужно.',
        "REMOTE_PORT=$($Values.remote_port)"
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    # Папки может не быть: фрагмент сервера (`servers\<алиас>.conf`) `-Setup` заводит сам,
    # а на новой машине папки `servers\` ещё нет — WriteAllLines по несуществующему пути падает.
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { [void](New-Item -ItemType Directory -Path $dir -Force) }
    [System.IO.File]::WriteAllLines($Path, $lines, $utf8NoBom)
}

# ---------------------------------------------------------------- выбор сервера

# Каталог серверов: `servers\<алиас>.conf` рядом со скриптом, тот же диалект, что и
# `opencode-web.conf`. Фрагменты (со адресами и именами ключей) в git НЕ идут — иначе
# адреса боксов уехали бы в публичный репозиторий (D-038); поэтому в отслеживаемых файлах
# лежит только README с форматом, а сами фрагменты кладёт Мозг на машину владельца.
function Get-OcServerFragments {
    param([string]$ServerDir)
    if (-not (Test-Path -LiteralPath $ServerDir)) { return @() }
    $found = @(Get-ChildItem -LiteralPath $ServerDir -Filter '*.conf' -File -ErrorAction SilentlyContinue |
        Sort-Object -Property Name | ForEach-Object { $_.BaseName })
    return $found
}

# Настройки запуска одним куском: файл (общий или фрагмент сервера) → параметры командной
# строки поверх него. Возвращает `ok = $false`, если сервер назван, а фрагмента нет:
# решает вызывающий, но подменять названный сервер умолчаниями мы не даём.
function Resolve-OcSettings {
    param(
        [string]$ConfigPath, [string]$ServerName, [string]$ServerDir,
        [string]$SshTarget, [string]$IdentityFile, [int]$LocalPort, [int]$RemotePort,
        [string]$DefaultTarget, [int]$DefaultLocalPort, [int]$DefaultRemotePort,
        [switch]$AllowMissing
    )
    $confPath = $ConfigPath
    $available = @()
    if ($ServerName) {
        $available = Get-OcServerFragments -ServerDir $ServerDir
        $fragment = Join-Path $ServerDir ($ServerName + '.conf')
        if (-not (Test-Path -LiteralPath $fragment) -and -not $AllowMissing) {
            return @{ ok = $false; confPath = $fragment; server = $ServerName; available = $available }
        }
        $confPath = $fragment
    }

    $settings = Read-OcConfig -Path $confPath
    $target = $DefaultTarget
    $identity = ''
    $local = $DefaultLocalPort
    $remote = $DefaultRemotePort
    if ($settings.ContainsKey('SSH_TARGET') -and $settings['SSH_TARGET']) { $target = $settings['SSH_TARGET'] }
    if ($settings.ContainsKey('IDENTITY_FILE') -and $settings['IDENTITY_FILE']) { $identity = Resolve-OcPath $settings['IDENTITY_FILE'] }
    if ($settings.ContainsKey('LOCAL_PORT') -and $settings['LOCAL_PORT']) {
        $parsed = 0
        if ([int]::TryParse($settings['LOCAL_PORT'], [ref]$parsed)) { $local = $parsed }
    }
    if ($settings.ContainsKey('REMOTE_PORT') -and $settings['REMOTE_PORT']) {
        $parsed = 0
        if ([int]::TryParse($settings['REMOTE_PORT'], [ref]$parsed)) { $remote = $parsed }
    }
    if ($SshTarget) { $target = $SshTarget }
    if ($IdentityFile) { $identity = Resolve-OcPath $IdentityFile }
    if ($LocalPort -gt 0) { $local = $LocalPort }
    if ($RemotePort -gt 0) { $remote = $RemotePort }

    return @{
        ok = $true; confPath = $confPath; server = $ServerName; available = $available
        target = $target; identity = $identity; localPort = $local; remotePort = $remote
    }
}

# ---------------------------------------------------------------- мелочи

function Test-OcPort {
    param([int]$Port, [int]$TimeoutMs = 700)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { $client.Close(); return $false }
        $client.EndConnect($async)
        $client.Close()
        return $true
    } catch { return $false }
}

# Слушает ли этот порт ИМЕННО наш процесс. «Порт занят» — не то же самое, что «наш туннель
# поднялся»: порт мог держать чужой форвард (другой сервер на том же локальном порту) или
# посторонний процесс. Тогда ssh выйдет по `ExitOnForwardFailure=yes`, а `Test-OcPort` всё равно
# скажет «занят» — и запускатель молча работал бы через чужой туннель (та же находка 3, только
# с другой стороны). Возвращает `$null`, если проверить нечем (старая Windows без NetTCPIP) —
# вызывающий в этом случае возвращается к прежнему поведению «порт слушает».
function Test-OcPortMine {
    param([int]$Port, [int]$ProcessId)
    try {
        $mine = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Where-Object { $_.OwningProcess -eq $ProcessId })
        return ($mine.Count -gt 0)
    } catch { return $null }
}

# След нашего туннеля в командной строке ssh: ПАРА ПОРТОВ и ЦЕЛЬ. Порты отвечают на вопрос «тот ли
# это форвард», цель — «к тому ли боксу». Без второй сверки туннель, поднятый к другому серверу на
# том же локальном порту, «переиспользовался» бы: ссылка входа — от одного бокса, UI — от другого
# (находка 3 письма Мозга 18.10, замер на живом). Уникальность портов по каталогу серверов — это
# договорённость машин владельца, а не свойство; сверка цели снимает класс целиком.
# Цель идёт последним аргументом, а кавычки вокруг неё зависят от того, как Start-Process склеил
# строку (Quote-OcArg кавычит только пробелы), поэтому принимаем три формы: без кавычек, в двойных
# и в одинарных.
function Test-OcTunnelCommandLine {
    param([string]$CommandLine, [int]$LocalPort, [int]$RemotePort, [string]$Target = '')
    if (-not $CommandLine) { return $false }
    if (-not $CommandLine.Contains("-L $LocalPort`:127.0.0.1:$RemotePort")) { return $false }
    if (-not $Target) { return $true }
    $tail = $CommandLine.TrimEnd()
    # Сравнение регистрозависимое — как у самого ssh: замер 19.10 на этой машине при `Host GONBA`
    # в ~/.ssh/config: `ssh gonba` → «Could not resolve hostname gonba». То есть псевдоним в другом
    # регистре — это не наш туннель (его и не могло появиться: ssh на нём падает). Держать здесь
    # мягче самого ssh значило бы выдумать поведение, которого нет.
    return ($tail.EndsWith(" $Target") -or
        $tail.EndsWith(" `"$Target`"") -or
        $tail.EndsWith(" '$Target'"))
}

# Туннель мы поднимаем сами строкой `-L <локальный>:127.0.0.1:<удалённый> <цель>` — по ней его и
# находим (окна у него нет, командная строка — единственный след). Порты и цель — из конфига
# компьютера. Цель можно не передавать (тогда сверяется только пара портов), но все вызовы из
# основного хода её передают: без сверки переиспользование может подсунуть чужой бокс.
function Get-OcTunnel {
    param([int]$LocalPort, [int]$RemotePort, [string]$Target = '')
    if ($env:OS -ne 'Windows_NT') {
        $found = @()
        foreach ($sshProc in @(Get-Process -Name ssh -ErrorAction SilentlyContinue)) {
            $cmdline = ''
            try { $cmdline = [System.IO.File]::ReadAllText("/proc/$($sshProc.Id)/cmdline") -replace "`0", ' ' } catch { }
            if (Test-OcTunnelCommandLine -CommandLine $cmdline -LocalPort $LocalPort -RemotePort $RemotePort -Target $Target) {
                $found += [pscustomobject]@{ ProcessId = $sshProc.Id }
            }
        }
        return $found
    }
    return @(Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue |
        Where-Object { Test-OcTunnelCommandLine -CommandLine $_.CommandLine -LocalPort $LocalPort -RemotePort $RemotePort -Target $Target })
}

# Живой туннель — это НЕ «порт слушает». Замер 18.10.2026 (вечер): процесс ssh пережил
# задохнувшийся сервер и висел с сотнями сокетов в CLOSE_WAIT — порт принимал соединения
# (Test-OcPort доволен), а форвардить было некуда, и запускатель считал службу выключенной,
# хотя на самом деле её надо было перезапускать. Признак жизни — установленное TCP-соединение
# транспорта (наружу, не loopback), а не наличие слушателя. Цель передаём и здесь: туннель,
# поднятый к ДРУГОМУ боксу, для нас не туннель вовсе (находка 3).
function Test-OcTunnelLive {
    param([int]$LocalPort, [int]$RemotePort, [string]$Target = '')
    $tunnels = @(Get-OcTunnel -LocalPort $LocalPort -RemotePort $RemotePort -Target $Target)
    if ($tunnels.Count -eq 0) { return $false }
    # На Unix-ветке коннекты не разбираем: /proc уже доказал, что это наш процесс туннеля.
    if ($env:OS -ne 'Windows_NT') { return $true }
    foreach ($tunnelProc in $tunnels) {
        try {
            $established = @(Get-NetTCPConnection -OwningProcess $tunnelProc.ProcessId -State Established -ErrorAction Stop)
        } catch {
            # Проверить нечем (старая Windows без NetTCPIP, нет прав) — не мешаем работать:
            # безопасное поведение здесь прежнее, «порт слушает = туннель есть».
            return $true
        }
        foreach ($conn in $established) {
            $remote = [string]$conn.RemoteAddress
            if ($remote -and $remote -ne '127.0.0.1' -and $remote -ne '::1' -and $remote -ne '0.0.0.0' -and $remote -ne '::') {
                return $true
            }
        }
    }
    return $false
}

function Resolve-OcPath {
    param([string]$Path)
    if (-not $Path) { return '' }
    if ($Path -eq '~' -or $Path.StartsWith('~/') -or $Path.StartsWith('~\')) {
        return (Join-Path $env:USERPROFILE $Path.Substring(2))
    }
    return $Path
}

# Start-Process склеивает аргументы пробелами и сам не экранирует — кавычим сами.
function Quote-OcArg {
    param([string]$Value)
    if ($Value -match '\s') { return '"' + $Value + '"' }
    return $Value
}

# Достать значение маркера `OC_ИМЯ:значение` из вывода сессии на боксе.
function Get-OcMarker {
    param([string]$Text, [string]$Name)
    if (-not $Text) { return '' }
    if ($Text -match "$([regex]::Escape($Name))`:([^\r\n]+)") { return $Matches[1].Trim() }
    return ''
}

function New-OcSshArgs {
    param([string]$Identity)
    # `-T` вместо `-n`: команда уходит на бокс через stdin (см. Invoke-OcSshSession), поэтому
    # stdin нужен живым, а псевдо-tty — нет.
    $args = @('-T', '-o', 'BatchMode=yes', '-o', "ConnectTimeout=$SshConnectTimeoutSec")
    if ($Identity) { $args += @('-i', (Quote-OcArg $Identity)) }
    return $args
}

# Команда на бокс: в одинарных кавычках, поэтому `$?` уходит на бокс как есть.
# Подстановки — через плейсхолдеры, чтобы не экранировать кавычки внутри строки.
function New-OcRemoteCommand {
    param([string]$Template, [hashtable]$Values)
    $command = $Template
    foreach ($key in $Values.Keys) { $command = $command.Replace($key, [string]$Values[$key]) }
    return $command
}

# Отдаём команду на бокс и ждём в выводе маркер `OC_DONE:<код>` (его печатает сама команда).
# Процесс не ждём до конца: см. граблю клиента в шапке файла.
#
# Команда уходит НЕ аргументом, а потоком — `bash -s` со stdin, куда подставляется файл.
# Замер 18.10.2026: через клиент из Git for Windows (MSYS) аргумент портится — `%{http_code}`
# доезжал как `%http_code`, а точка с запятой исчезала, и маркер слипался с выводом curl
# (`http=%http_codeOC_DONE:0`). С системным клиентом тот же аргумент доезжал целым, поэтому
# баг был невидим; поток же не зависит от того, кто разбирает аргументы.
function Invoke-OcSshSession {
    param([string[]]$SshArgs, [string]$Target, [string]$Command, [int]$TimeoutMs = 25000)
    $suffix = [guid]::NewGuid().ToString('N')
    $outFile = Join-Path $env:TEMP "oc_ssh_out_$suffix.txt"
    $errFile = Join-Path $env:TEMP "oc_ssh_err_$suffix.txt"
    $scriptFile = Join-Path $env:TEMP "oc_ssh_cmd_$suffix.sh"
    # UTF-8 без BOM: BOM перед первой командой сломал бы её. Переводы строк — LF (Unix).
    $scriptText = ($Command -replace "`r`n", "`n") + "`n"
    [System.IO.File]::WriteAllText($scriptFile, $scriptText, (New-Object System.Text.UTF8Encoding($false)))
    $started = Get-Date
    $text = ''
    $errText = ''
    $status = 'timeout'
    $proc = Start-Process -FilePath $SshExe -ArgumentList ($SshArgs + @($Target, 'bash', '-s')) `
        -RedirectStandardInput $scriptFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile -NoNewWindow -PassThru
    while (((Get-Date) - $started).TotalMilliseconds -lt $TimeoutMs) {
        if (Test-Path -LiteralPath $outFile) {
            $text = Read-OcRawText -Path $outFile
            if ($text -and $text -match "$DoneMarker`:(\d+)") { $status = 'ready'; break }
        }
        if ($proc.HasExited) { $status = 'exited'; break }
        Start-Sleep -Milliseconds 200
    }
    $text = Read-OcRawText -Path $outFile
    $errText = Read-OcRawText -Path $errFile
    if (-not $proc.HasExited) {
        try { $proc.Kill() } catch { }
        try { [void]$proc.WaitForExit(3000) } catch { }
    }
    Remove-Item -LiteralPath $outFile, $errFile, $scriptFile -Force -ErrorAction SilentlyContinue

    $code = $null
    if ($text -match "$DoneMarker`:(\d+)") { $code = [int]$Matches[1] }
    if ($code -eq $null -and $proc.HasExited) { $code = $proc.ExitCode }
    if ($errText) {
        # ssh на Windows жалуется на отсутствие консольного stdin — к делу не относится
        $errText = (($errText -split "`r?`n") | Where-Object { $_ -and $_ -notmatch 'GetConsoleMode' }) -join "`n"
    }
    return @{ status = $status; code = $code; out = $text; err = $errText.Trim() }
}

# Стоит ли повторять сессию. Повтор заведён на КЛАСС ВЫВОДА, а не только на собственный таймаут
# запускателя: на плохом канале ssh завершается САМ по `ConnectTimeout` («timed out during banner
# exchange»), и прежнее условие `status -eq 'timeout'` такой заход не ловило — замер Мозга 18.10
# (COMPUTER → бокс через ВПН): пять мёртвых окон подряд, в журнале бокса на каждый заход
# `Connection closed by <адрес> [preauth]`, а ручные ssh проходили со 2–3-й попытки.
# Класс узкий и про соединение ДО аутентификации — ровно там, где повтор помогает: отказ по ключу
# (`Permission denied`), неизвестный хост и прочие осмысленные ошибки сюда не попадают, их повтор
# только затянул бы. `Connection closed by`/`reset by peer` — тот же preauth-класс: sshd под
# сканерами придерживает слоты и рвёт часть новых соединений (MaxStartups 50:30:150 на боксе).
function Test-OcRetryableSshFailure {
    param($Session)
    if (-not $Session) { return $false }
    if ($Session.status -eq 'timeout') { return $true }
    $text = "$($Session.err)`n$($Session.out)"
    if (-not $text.Trim()) { return $false }
    return [bool]($text -match 'timed out during banner exchange|Connection timed out|Connection closed by|Connection reset by peer|kex_exchange_identification')
}

function Show-OcSshProblem {
    param([string]$Text, [string]$Target, [string]$ConfPath, [string]$Identity)
    Write-Host ''
    if ($Text -match 'Could not resolve hostname|Name or service not known|nodename nor servname') {
        Write-Host "Хост «$Target» не разрешается: на этом компьютере нет такой записи в ~/.ssh/config."
        Write-Host 'Добавь запись (адрес бокса и имя ключа владелец даёт отдельно):'
        Write-Host ''
        Write-Host "    Host $Target"
        Write-Host '        HostName <адрес бокса>'
        Write-Host '        User <пользователь>'
        Write-Host '        IdentityFile ~/.ssh/<имя ключа>'
        Write-Host ''
        Write-Host 'Либо просто укажи цель явно: -Setup → SSH_TARGET = user@адрес'
    } elseif ($Text -match 'Permission denied|no supported authentication methods|Could not load key') {
        Get-OcKeyRecipe -Target $Target -ConfPath $ConfPath
        if ($Identity) { Write-Host "Сейчас в настройках указан ключ: $Identity — проверь, что он существует и добавлен на бокс." }
        Write-Host 'Если у ключа есть парольная фраза — запусти ssh-agent и добавь ключ: ssh-add <путь к ключу>.'
    } elseif ($Text -match 'timed out|No route to host|Connection refused|Network is unreachable') {
        Write-Host 'Сеть: бокс не ответил. Проверь интернет и что SSH-порт бокса доступен с этой сети.'
    } else {
        Write-Host 'SSH не отработал. Ответ:'
        Write-Host $Text
    }
    Write-Host ''
}

function Get-OcKeyRecipe {
    param([string]$Target, [string]$ConfPath)
    $key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_opencode'
    $pub = "$key.pub"
    $hostLine = $Target
    if ($hostLine -eq '') { $hostLine = $DefaultTarget }
    Write-Host ''
    Write-Host 'Бокс пускает только по SSH-ключу (пароли выключены), и этот компьютер пока не пущен.'
    Write-Host 'Что сделать один раз:'
    Write-Host ''
    Write-Host '  1) создать ключ здесь:'
    Write-Host "       ssh-keygen -t ed25519 -f `"$key`" -C `"opencode-web@$env:COMPUTERNAME`""
    Write-Host '     (на вопрос о парольной фразе можно нажать Enter — тогда вход будет без пароля)'
    Write-Host ''
    Write-Host '  2) посмотреть публичную часть — её и добавляем, приватную никому не отправлять:'
    Write-Host "       Get-Content `"$pub`""
    Write-Host ''
    Write-Host '  3) добавить эту строку на бокс — с любой машины, где доступ уже есть:'
    Write-Host "       Get-Content `"$pub`" | ssh $hostLine `"tr -d '\r' | cat >> ~/.ssh/authorized_keys`""
    Write-Host '     (или владелец вставит строку в ~/.ssh/authorized_keys бокса вручную)'
    Write-Host ''
    Write-Host '  4) прописать этот ключ здесь:'
    Write-Host "       powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Setup"
    Write-Host "     → IDENTITY_FILE = $key"
    Write-Host ''
    Write-Host "Настройки лежат в: $ConfPath"
}

# ---------------------------------------------------------------- служба на боксе
#
# Владелец: «хочу, чтобы opencode не занимал ресурсы прод-сервера, когда я им не пользуюсь».
# Поэтому служба на боксе — управляемая: `-Off` её гасит, запуск без ключей поднимает обратно.
# Все команды на бокс идут БЕЗ двойных кавычек: `Start-Process` передаёт аргументы строкой,
# разбор аргументов ssh на Windows срезает кавычки — команда доезжает искалеченной (замерено
# на соблазне написать `curl -w "%{http_code}"`). Поэтому `-w %{http_code}` и `sed -n 2p`.

# `free -m` второй строкой отдаёт: `Mem: total used free shared buff/cache available` —
# доступная память это седьмое поле (индекс 6).
function Get-OcAvailableMb {
    param([string]$FreeLine)
    if (-not $FreeLine) { return $null }
    $parts = @($FreeLine.Trim() -split '\s+')
    if ($parts.Count -lt 7) { return $null }
    $value = 0
    if ([int]::TryParse($parts[6], [ref]$value)) { return $value }
    return $null
}

# `MemoryCurrent=185962496` (байты) → «178 МБ»; у остановленного юнита там `[not set]`.
# Скобки в шаблоне обязательны: `$Matches[1]` заполняется только группой захвата, без неё
# получался `$null` и «0 МБ» (поймано на живом прогоне -Check 18.10).
function Format-OcMemory {
    param([string]$Raw)
    if (-not $Raw) { return 'память неизвестна' }
    if ($Raw -match '(\d+)') { return ('{0} МБ' -f [math]::Round([int64]$Matches[1] / 1MB)) }
    return 'память неизвестна'
}

# Жива ли служба — видно ЧЕРЕЗ УЖЕ ПОДНЯТЫЙ туннель, без отдельной ssh-сессии: 401/200 значит
# opencode отвечает, 0 — служба выключена (туннель при этом жив и порт принимает, поэтому
# проверять порт бесполезно — нужен настоящий HTTP-запрос).
function Get-OcServiceHttp {
    param([int]$Port, [int]$TimeoutMs = 4000)
    try {
        $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/api/info")
        $request.Proxy = $null   # системный прокси этой машины (127.0.0.1:10809) здесь только мешает
        $request.Timeout = $TimeoutMs
        $request.Method = 'GET'
        $response = $request.GetResponse()
        $code = [int]$response.StatusCode
        $response.Close()
        return $code
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    } catch {
        return 0
    }
}

# Поднять службу на боксе (если погашена) и дождаться, пока она ответит на самом боксе.
function Start-OcService {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 120000)
    $command = New-OcRemoteCommand -Template 'if systemctl is-active --quiet __UNIT__; then echo OC_UNIT:already; else sudo -n systemctl start __UNIT__; echo OC_UNIT:start:$?; fi; i=0; code=000; while [ $i -lt 60 ]; do code=$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://127.0.0.1:__PORT__/api/info); if [ $code != 000 ]; then break; fi; sleep 1; i=$((i+1)); done; echo OC_HTTP:$code; echo OC_DONE:$?' -Values @{
        __UNIT__ = $Unit; __PORT__ = $Port
    }
    return Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $command -TimeoutMs $TimeoutMs
}

# Перезапустить службу на боксе и дождаться, пока её сервер ответит НА БОКСЕ.
# Зачем отдельная функция: `start` по уже активному юниту ничего не делает, поэтому
# задохнувшуюся (активную и молчащую) службу им не вылечить — нужен именно `restart`.
# Ждём до 90 с: остановка занимает до TimeoutStopSec (30 с в юните), старт — прогрев
# сервера (замеры 17–18.10: первый ответ 10–20 с, под давлением дольше).
function Restart-OcService {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 150000)
    $command = New-OcRemoteCommand -Template 'echo OC_MEMBEFORE:$(systemctl show __UNIT__ -p MemoryCurrent); sudo -n systemctl restart __UNIT__; echo OC_EXIT:$?; i=0; code=000; while [ $i -lt 90 ]; do code=$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://127.0.0.1:__PORT__/api/info); if [ $code != 000 ]; then break; fi; sleep 1; i=$((i+1)); done; echo OC_HTTP:$code; echo OC_ACTIVEAFTER:$(systemctl is-active __UNIT__ 2>/dev/null); echo OC_MEMAFTER:$(systemctl show __UNIT__ -p MemoryCurrent); echo OC_DONE:$?' -Values @{
        __UNIT__ = $Unit; __PORT__ = $Port
    }
    return Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $command -TimeoutMs $TimeoutMs
}

# Что на самом деле со службой: активна ли она, отвечает ли её сервер на САМОМ боксе,
# сколько памяти и какое давление в cgroup. Одна ssh-сессия, и только в тупике (когда через
# туннель — тишина). Без этого вопроса «выключена» и «задохнулась» неразличимы, а лечение
# у них разное: поднять / перезапустить / пересоздать туннель (замер 18.10.2026 вечер —
# запускатель честно выбирал первое и навсегда застревал в цикле).
function Get-OcBoxState {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 60000)
    $command = New-OcRemoteCommand -Template 'echo OC_ACTIVE:$(systemctl is-active __UNIT__ 2>/dev/null); echo OC_ENABLED:$(systemctl is-enabled __UNIT__ 2>/dev/null); echo OC_BOXHTTP:$(curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:__PORT__/api/info); echo OC_MEM:$(systemctl show __UNIT__ -p MemoryCurrent); echo OC_PRESSURE:$(sed -n 1p /sys/fs/cgroup/system.slice/__UNIT__.service/memory.pressure 2>/dev/null); echo OC_DONE:$?' -Values @{
        __UNIT__ = $Unit; __PORT__ = $Port
    }
    return Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $command -TimeoutMs $TimeoutMs
}

# Погасить службу на боксе. Возвращает вместе с кодом замеры «сколько памяти вернулось» —
# владельцу важно видеть, что выключение что-то значит, а не «нажал и не понял».
# Выход из `active` ждём внутри той же сессии, и терпеливее, чем systemd: задохнувшийся
# сервер не отдаёт SIGTERM сразу, и systemd добивает его только по TimeoutStopSec.
# Раньше сессия ждала ровно 90 с — столько же, сколько systemd по умолчанию, — и гонка
# заканчивалась вничью: владелец видел «бокс не ответил» на успешной остановке
# (замер 18.10.2026: ярлык «выключить» не срабатывает).
function Stop-OcService {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$TimeoutMs = 150000)
    $command = New-OcRemoteCommand -Template 'echo OC_MEMBEFORE:$(systemctl show __UNIT__ -p MemoryCurrent); echo OC_AVAILBEFORE:$(free -m | sed -n 2p); sudo -n systemctl stop __UNIT__; echo OC_EXIT:$?; i=0; state=$(systemctl is-active __UNIT__ 2>/dev/null); while [ $i -lt 60 ]; do state=$(systemctl is-active __UNIT__ 2>/dev/null); if [ $state != active ]; then break; fi; sleep 1; i=$((i+1)); done; echo OC_STATE:$state; echo OC_MEMAFTER:$(systemctl show __UNIT__ -p MemoryCurrent); echo OC_AVAILAFTER:$(free -m | sed -n 2p); echo OC_DONE:$?' -Values @{ __UNIT__ = $Unit }
    return Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $command -TimeoutMs $TimeoutMs
}

# Закрыть туннель ЭТОГО компьютера. $true — после уборки локальный порт свободен.
# Цель — часть того, что мы ищем: туннель к другому серверу (пусть и на том же порту) нам не
# принадлежит, и трогать его нельзя — иначе `-Stop`/`-Off` одного сервера гасили бы чужой.
function Close-OcTunnel {
    param([int]$LocalPort, [int]$RemotePort, [string]$Target = '')
    $tunnels = @(Get-OcTunnel -LocalPort $LocalPort -RemotePort $RemotePort -Target $Target)
    if ($tunnels.Count -eq 0) {
        $whom = ''
        if ($Target) { $whom = " к $Target" }
        Write-Host "Туннеля$whom на 127.0.0.1:$LocalPort нет — закрывать нечего."
    } else {
        foreach ($tunnelProc in $tunnels) {
            try {
                Stop-Process -Id $tunnelProc.ProcessId -Force -ErrorAction Stop
                Write-Host "Туннель закрыт (pid $($tunnelProc.ProcessId))."
            } catch {
                Write-Host "Не удалось закрыть pid $($tunnelProc.ProcessId): $($_.Exception.Message)"
            }
        }
    }
    Start-Sleep -Milliseconds 500
    if (Test-OcPort -Port $LocalPort) {
        Write-Host "Порт 127.0.0.1:$LocalPort всё ещё занят — его держит не наш туннель (возможно, форвард к другому серверу)."
        return $false
    }
    Write-Host "Порт 127.0.0.1:$LocalPort свободен."
    return $true
}

# Поднять туннель и дождаться, пока он начнёт принимать локальные соединения.
# Возвращает @{ ok = <порт занят именно нашим ssh>; proc = <процесс ssh> }. Печать проблем
# оставлена вызывающему: при первом запуске это тупик, а при пересоздании — уже другой разговор.
function New-OcTunnel {
    param([string]$SshExe, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort)
    $tunnelArgs = @(
        '-n', '-N',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ExitOnForwardFailure=yes'
    )
    if ($Identity) { $tunnelArgs += @('-i', (Quote-OcArg $Identity)) }
    $tunnelArgs += @('-L', "$LocalPort`:127.0.0.1:$RemotePort", $Target)
    # `-WindowStyle Hidden` — чтобы на экране не висело чёрное окно ssh.exe (оно и мешало владельцу).
    # Замер 18.10: с этим ключом окна нет (MainWindowHandle 0), форвардинг жив (401 через туннель).
    $proc = Start-Process -FilePath $SshExe -ArgumentList $tunnelArgs -PassThru -WindowStyle Hidden
    # Ждём локальный порт до 60 с: ssh поднимает форвард только после аутентификации, а она
    # под сканерами на публичном :22 откладывается (замер 18.10: холодный вход 42 с).
    # Успех — это порт, занятый ИМЕННО нашим ssh: если порт уже держал чужой форвард, ssh выйдет
    # по `ExitOnForwardFailure`, а `Test-OcPort` скажет «занят» — и без этой сверки запускатель
    # выдал бы чужой туннель за свой (находка 3 с другой стороны). Проверить владельца нечем —
    # работаем как раньше, «порт слушает».
    $ok = $false
    for ($i = 0; $i -lt 240; $i++) {
        Start-Sleep -Milliseconds 250
        if ($proc.HasExited) { break }
        $mine = Test-OcPortMine -Port $LocalPort -ProcessId $proc.Id
        if ($null -eq $mine) { $mine = Test-OcPort -Port $LocalPort }
        if ($mine) { $ok = $true; break }
    }
    return @{ ok = $ok; proc = $proc }
}

# «Туннель не поднялся» — общий диагноз для первого запуска и для пересоздания.
function Show-OcTunnelProblem {
    param($Proc, [int]$LocalPort)
    Write-Host ''
    Write-Host "Туннель не поднялся (127.0.0.1:$LocalPort)."
    if ($Proc -and $Proc.HasExited) {
        Write-Host "ssh завершился с кодом $($Proc.ExitCode) (окна у туннеля нет — он стартует скрыто; подробности даст ключ -Check)."
        if (Test-OcPort -Port $LocalPort) {
            Write-Host 'Порт при этом занят, но не нашим туннелем — вероятно, это форвард к другому серверу или посторонний процесс.'
        }
    } else {
        Write-Host 'ssh жив, но порт не занят: чаще всего бокс не успел пустить (сканеры на :22) — повтори запуск.'
    }
    Write-Host "Другая частая причина: локальный порт занят. Запусти с другим портом: -LocalPort $($LocalPort + 1000)"
}

# Пересоздать туннель ЭТОГО компьютера и сразу проверить, отвечает ли через него сервер.
# Возвращает @{ ok = <туннель поднялся>; proc = <процесс ssh>; code = <код ответа через туннель> }.
# Лечение для случая «на боксе сервер отвечает, а через туннель не видно»: порт занят живым
# процессом, но канал уже не форвардит (18.10.2026: сотни CLOSE_WAIT на 14974).
function Restore-OcTunnel {
    param([string]$SshExe, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort)
    [void](Close-OcTunnel -LocalPort $LocalPort -RemotePort $RemotePort -Target $Target)
    $started = New-OcTunnel -SshExe $SshExe -Target $Target -Identity $Identity -LocalPort $LocalPort -RemotePort $RemotePort
    $code = 0
    if ($started.ok) { $code = Get-OcServiceHttp -Port $LocalPort -TimeoutMs 8000 }
    return @{ ok = $started.ok; proc = $started.proc; code = $code }
}

# Тупик «через туннель сервер не отвечает»: спросить бокс и вылечить по обстоятельствам.
# Снаружи выглядят одинаково три разных состояния, а лечение у них разное:
#   служба не активна           → поднять (ярлык врёт, что «выключена», когда она молчит);
#   активна и отвечает на боксе → виноват туннель, пересоздать;
#   активна и молчит на боксе   → задохнулась в своём cgroup (MemoryHigh/OOM), лечится `restart`.
# Возвращает @{ ok; code; proc; own; message }: proc/own нужны вызывающему, чтобы он знал,
# за каким туннелем следить, а message — что сказать владельцу, если вылечить не удалось.
function Repair-OcAccess {
    param(
        [string[]]$SshArgs, [string]$SshExe, [string]$Target, [string]$Identity,
        [string]$Unit, [int]$LocalPort, [int]$RemotePort
    )
    $state = Get-OcBoxState -SshArgs $SshArgs -Target $Target -Unit $Unit -Port $RemotePort
    if ($state.status -eq 'timeout') {
        return @{
            ok = $false; code = 0; proc = $null; own = $false
            message = "Бокс не ответил за отведённое время — состояние службы неизвестно. Проверь вручную: ssh $Target `"systemctl is-active $Unit`""
        }
    }

    $unitActive = Get-OcMarker -Text $state.out -Name 'OC_ACTIVE'
    $boxHttp = Get-OcMarker -Text $state.out -Name 'OC_BOXHTTP'
    if (-not $boxHttp) { $boxHttp = '000' }
    $boxMem = Format-OcMemory -Raw (Get-OcMarker -Text $state.out -Name 'OC_MEM')
    $pressureRaw = Get-OcMarker -Text $state.out -Name 'OC_PRESSURE'
    $pressure = ''
    if ($pressureRaw -match 'avg10=([\d.]+)') { $pressure = ('{0} %' -f [int][double]$Matches[1]) }
    if (-not $pressure) { $pressure = 'неизвестно' }

    if ($unitActive -ne 'active') {
        Write-Host "Служба $Unit на боксе: $unitActive — поднимаю её."
        $action = Start-OcService -SshArgs $SshArgs -Target $Target -Unit $Unit -Port $RemotePort
        $boxHttp = Get-OcMarker -Text $action.out -Name 'OC_HTTP'
        if (-not $boxHttp) { $boxHttp = '000' }
    } elseif ($boxHttp -match '^(200|401|403)$') {
        Write-Host "Служба $Unit активна и отвечает на боксе ($boxHttp) — виноват туннель."
    } else {
        Write-Host "Служба $Unit активна, но сервер на боксе молчит ($boxMem, давление памяти: $pressure) — перезапускаю её."
        $action = Restart-OcService -SshArgs $SshArgs -Target $Target -Unit $Unit -Port $RemotePort
        $boxHttp = Get-OcMarker -Text $action.out -Name 'OC_HTTP'
        if (-not $boxHttp) { $boxHttp = '000' }
        $memAfter = Format-OcMemory -Raw (Get-OcMarker -Text $action.out -Name 'OC_MEMAFTER')
        Write-Host "  память службы: $boxMem → $memAfter"
    }

    $code = Get-OcServiceHttp -Port $LocalPort -TimeoutMs 8000
    $tunnelProc = $null
    $own = $false
    if ($code -eq 0 -and $boxHttp -match '^(200|401|403)$') {
        Write-Host "На боксе сервер отвечает ($boxHttp), а через туннель — нет: пересоздаю туннель."
        $retry = Restore-OcTunnel -SshExe $SshExe -Target $Target -Identity $Identity -LocalPort $LocalPort -RemotePort $RemotePort
        $tunnelProc = $retry.proc
        $own = $retry.ok
        $code = $retry.code
        if (-not $retry.ok) {
            return @{ ok = $false; code = 0; proc = $tunnelProc; own = $own; message = 'Новый туннель не поднялся — см. строки выше.' }
        }
    }

    if ($code -ne 0) {
        return @{ ok = $true; code = $code; proc = $tunnelProc; own = $own; message = '' }
    }

    $note = ''
    if ($action -and $action.status -eq 'timeout') { $note = ' Бокс не ответил вовремя на команду службы.' }
    return @{
        ok = $false; code = 0; proc = $tunnelProc; own = $own
        message = "Не помогло: сервер на боксе отвечает кодом $boxHttp, через туннель — тишина.$note Вручную: ssh $Target `"sudo systemctl restart $Unit`""
    }
}

# ---------------------------------------------------------------- режимы

function Invoke-OcSetup {
    param([string]$ConfPath, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort)
    Write-Host ''
    Write-Host 'Настройка этого компьютера. Enter — оставить значение в скобках.'
    Write-Host ''
    $answer = Read-Host "SSH-цель (алиас из ~/.ssh/config или user@host) [$Target]"
    if ($answer.Trim()) { $Target = $answer.Trim() }

    $answer = Read-Host "Приватный ключ (пусто — ключи по умолчанию) [$Identity]"
    if ($answer.Trim()) { $Identity = $answer.Trim() }

    $answer = Read-Host "Локальный порт туннеля [$LocalPort]"
    $parsed = 0
    if ($answer.Trim() -and [int]::TryParse($answer.Trim(), [ref]$parsed) -and $parsed -gt 0 -and $parsed -lt 65536) {
        $LocalPort = $parsed
    }

    $answer = Read-Host "Порт сервера на боксе [$RemotePort]"
    if ($answer.Trim() -and [int]::TryParse($answer.Trim(), [ref]$parsed) -and $parsed -gt 0 -and $parsed -lt 65536) {
        $RemotePort = $parsed
    }

    Write-OcConfig -Path $ConfPath -Values @{
        ssh_target = $Target; identity_file = $Identity; local_port = $LocalPort; remote_port = $RemotePort
    }
    Write-Host ''
    Write-Host "Записано: $ConfPath"
    return @($Target, $Identity, $LocalPort, $RemotePort)
}

function Invoke-OcCheck {
    param([string]$ConfPath, [string]$ServerName, [string]$ServerDir, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort, [string[]]$SshArgs)
    $failed = 0
    Write-Host ''
    Write-Host 'Проверка этого компьютера и бокса'
    Write-Host ''
    # Каким сервером пульт готов ходить — то, о чём просил Мозг (письмо «Формат пульта»):
    # без `-Server` это прежнее поведение по `opencode-web.conf`, с ним — фрагмент каталога.
    if ($ServerName) {
        Write-Host "  сервер:    $ServerName (фрагмент каталога)"
    } else {
        Write-Host '  сервер:    не выбран — настройки этого компьютера (opencode-web.conf)'
    }
    if (Test-Path -LiteralPath $ConfPath) {
        Write-Host "  настройки: $ConfPath"
    } else {
        Write-Host "  настройки: файла нет ($ConfPath) — работают умолчания"
    }
    if ($ServerDir) {
        $others = @(Get-OcServerFragments -ServerDir $ServerDir | Where-Object { $_ -ne $ServerName })
        if ($others.Count -gt 0) {
            Write-Host "  рядом:     $($others -join ', ')   (запуск: -Server <имя>)"
        }
    }
    Write-Host "  ssh-цель:  $Target"
    Write-Host "  порты:     локальный $LocalPort → на боксе $RemotePort"
    if ($Identity) { Write-Host "  ключ:      $Identity" } else { Write-Host '  ключ:      по умолчанию / ssh-agent' }
    if ($sshClient) {
        Write-Host "  клиент:    $($sshClient.Path)"
        Write-Host "             $($sshClient.Text)"
        if ($sshClient.Major -gt 0 -and $sshClient.Major -lt $SshSlowMajorVersion) {
            Write-Host "  [!] клиент старше $SshSlowMajorVersion-й ветки: соединение до бокса висит 11–30 с (замер 18.10.2026),"
            Write-Host '      хотя сеть отвечает за 78 мс. Лаунчер всё равно работает, но медленно.'
            Write-Host '      Лечится свежим клиентом: Git for Windows уже подхватится сам, либо штатный —'
            Write-Host '      в PowerShell от администратора: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0'
        }
    } else {
        Write-Host '  клиент:    ssh из PATH (версию определить не удалось)'
    }
    Write-Host ''
    if ($Identity -and -not (Test-Path -LiteralPath $Identity)) {
        Write-Host "  [!!] файла ключа нет: $Identity"
        $failed = 1
    }

    $probe = Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command 'true; echo "OC_DONE:$?"' -TimeoutMs $SshSessionTimeoutMs
    if ($probe.status -eq 'ready' -and $probe.code -eq 0) {
        Write-Host '   ssh:       ok'
    } elseif ($probe.status -eq 'exited') {
        Write-Host "   ssh:       НЕ РАБОТАЕТ (код $($probe.code))"
        Show-OcSshProblem -Text $probe.err -Target $Target -ConfPath $ConfPath -Identity $Identity
        return 1
    } else {
        Write-Host '   ssh:       НЕТ ОТВЕТА (таймаут)'
        Write-Host "       Проверь вручную: ssh $Target `"true`""
        return 1
    }

    $unitCmd = New-OcRemoteCommand -Template 'echo OC_ACTIVE:$(systemctl is-active __UNIT__ 2>/dev/null); echo OC_ENABLED:$(systemctl is-enabled __UNIT__ 2>/dev/null); echo OC_MEM:$(systemctl show __UNIT__ -p MemoryCurrent); echo OC_PRESSURE:$(sed -n 1p /sys/fs/cgroup/system.slice/__UNIT__.service/memory.pressure 2>/dev/null); echo OC_DONE:$?' -Values @{ __UNIT__ = $RemoteUnit }
    $unit = (Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $unitCmd -TimeoutMs $SshSessionTimeoutMs).out
    $unitActive = Get-OcMarker -Text $unit -Name 'OC_ACTIVE'
    $unitEnabled = Get-OcMarker -Text $unit -Name 'OC_ENABLED'
    $unitMem = Format-OcMemory -Raw (Get-OcMarker -Text $unit -Name 'OC_MEM')
    # Давление памяти показываем, когда оно уже неприлично большое: cgroup под MemoryHigh
    # начинает жить в reclaim и сервер может молчать, оставаясь «active» — ровно так это
    # выглядело 18.10.2026 вечером (548 МБ при потолке 500 МБ, some avg10=100 %).
    $unitPressureRaw = Get-OcMarker -Text $unit -Name 'OC_PRESSURE'
    $unitPressure = $null
    if ($unitPressureRaw -match 'avg10=([\d.]+)') { $unitPressure = [double]$Matches[1] }
    $pressureNote = ''
    if ($null -ne $unitPressure -and $unitPressure -ge 20) {
        $pressureNote = " — ДАВЛЕНИЕ ПАМЯТИ $([int]$unitPressure) % (cgroup у потолка, сервер может молчать)"
    }
    if ($unitActive -eq 'active') {
        Write-Host "   сервис:    $RemoteUnit — active, ест $unitMem (автозапуск: $unitEnabled)$pressureNote"
    } else {
        # Выключенная служба — больше не авария: ровно так выглядит штатное «выключил, пока
        # не работаю» (ярлык с ключом -Off). Запуск без ключей поднимет её сам, поэтому это
        # замечание для сведения, а не провал проверки.
        Write-Host "   сервис:    $RemoteUnit — $unitActive (выключена; запуск ярлыка поднимет её сам)"
        Write-Host "       Вручную: ssh $Target `"sudo systemctl start $RemoteUnit`""
    }

    $httpCmd = New-OcRemoteCommand -Template 'curl -s -o /dev/null -w http=%{http_code} --max-time 8 http://127.0.0.1:__PORT__/api/info; echo "OC_DONE:$?"' -Values @{ __PORT__ = $RemotePort }
    $http = (Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $httpCmd -TimeoutMs $SshSessionTimeoutMs).out
    if ($http -match 'http=(401|403|200)') {
        Write-Host "   сервер:    отвечает на 127.0.0.1:$RemotePort (код $($Matches[1]) — 401 без пароля это норма)"
    } elseif ($unitActive -ne 'active') {
        Write-Host '   сервер:    не слушает — служба выключена (см. строку выше), это ожидаемо'
    } else {
        Write-Host "  [!!] сервер на 127.0.0.1:$RemotePort не ответил на /api/info (ответ: $http)"
        if ($unitActive -eq 'active') {
            # Активна и молчит — это не «выключена»: `start` по активному юниту ничего не
            # делает, лечится перезапуском. Так выглядел вечер 18.10.2026 у владельца.
            Write-Host '       Служба при этом active — значит сервер задохнулся, а не выключен.'
            Write-Host '       Запуск ярлыка перезапустит его сам; вручную:'
            Write-Host "       ssh $Target `"sudo systemctl restart $RemoteUnit`""
        } else {
            Write-Host "       Проверить: ssh $Target `"curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$RemotePort/api/info`""
        }
        $failed = 1
    }

    $version = (Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command 'opencode --version; echo "OC_DONE:$?"' -TimeoutMs $SshSessionTimeoutMs).out
    $versionText = (($version -split "`r?`n") | Where-Object { $_ -and $_ -notmatch $DoneMarker }) -join ' '
    Write-Host "   opencode:  $versionText"

    if (Test-OcPort -Port $LocalPort) {
        Write-Host "   локально:  порт $LocalPort уже занят — вероятно, туннель поднят; запуск переиспользует его"
    } else {
        Write-Host "   локально:  порт $LocalPort свободен"
    }
    Write-Host ''
    if ($failed -eq 0) { Write-Host 'Итог: всё на месте, можно запускать без параметров.' } else { Write-Host 'Итог: есть замечания (см. [!!] выше).' }
    return $failed
}

# ---------------------------------------------------------------- старт

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $Config) { $Config = Join-Path $scriptDir 'opencode-web.conf' }
$serverDir = Join-Path $scriptDir 'servers'

# --- какие серверы вообще лежат рядом (`-Servers`): список без подключения, ни одной ssh-сессии.
if ($Servers) {
    $found = Get-OcServerFragments -ServerDir $serverDir
    Write-Host ''
    Write-Host "Серверы рядом (папка $serverDir):"
    if ($found.Count -eq 0) {
        Write-Host '  пусто — фрагментов нет.'
        Write-Host '  Их кладёт Мозг: каталог серверов, по одному файлу <алиас>.conf на сервер.'
    } else {
        foreach ($name in $found) {
            $fragmentSettings = Read-OcConfig -Path (Join-Path $serverDir ($name + '.conf'))
            $fragmentTarget = ''
            if ($fragmentSettings.ContainsKey('SSH_TARGET')) { $fragmentTarget = $fragmentSettings['SSH_TARGET'] }
            if ($fragmentTarget) {
                Write-Host "  $name  →  $fragmentTarget"
            } else {
                Write-Host "  $name  →  ssh-цель во фрагменте не задана"
            }
        }
        Write-Host ''
        Write-Host 'Запуск конкретного сервера: этот же скрипт с ключом -Server <имя>.'
    }
    Write-Host ''
    exit 0
}

$resolved = Resolve-OcSettings -ConfigPath $Config -ServerName $Server -ServerDir $serverDir `
    -SshTarget $SshTarget -IdentityFile $IdentityFile -LocalPort $LocalPort -RemotePort $RemotePort `
    -DefaultTarget $DefaultTarget -DefaultLocalPort $DefaultLocalPort -DefaultRemotePort $DefaultRemotePort `
    -AllowMissing:$Setup

if (-not $resolved.ok) {
    Write-Host ''
    Write-Host "Сервер '$Server': фрагмента нет — $($resolved.confPath)"
    if ($resolved.available.Count -gt 0) {
        Write-Host 'Рядом лежат:'
        foreach ($name in $resolved.available) { Write-Host "  $name" }
    } else {
        Write-Host "Рядом ничего нет (папка $serverDir): фрагменты кладёт Мозг — каталог серверов."
    }
    Write-Host 'Посмотреть список: этот же скрипт с ключом -Servers.'
    Write-Host 'Если сервер заводится не Мозгом, а здесь: -Server <имя> -Setup создаст фрагмент на месте.'
    exit 1
}

# Дальше весь скрипт работает с выбранным файлом настроек: без `-Server` это прежний
# `opencode-web.conf`, с `-Server` — фрагмент каталога. Параметры командной строки
# по-прежнему старше файла.
$confPath = $resolved.confPath
$serverName = $resolved.server
$target = $resolved.target
$identity = $resolved.identity
$localPort = $resolved.localPort
$remotePort = $resolved.remotePort

# Клиент выбираем один раз на запуск: от него зависит, будет вход за секунду или за полминуты.
$sshClient = Get-OcSshExe -Candidates $SshExeCandidates
$SshExe = 'ssh'
if ($sshClient) { $SshExe = $sshClient.Path }

$sshArgs = New-OcSshArgs -Identity $identity

# --- закрыть туннель этого компьютера (`-Stop`)
if ($Stop) {
    if (Close-OcTunnel -LocalPort $localPort -RemotePort $remotePort -Target $target) { exit 0 }
    exit 1
}

# --- выключить (`-Off`): служба на боксе + туннель этого компьютера.
# Ярлык «выключить» владельца. Смысл — вернуть боксу память: сам сервер держит ~180 МБ
# и растёт с сессиями, а туннель без сервера бесполезен, поэтому убираем оба.
if ($Off) {
    Write-Host 'Выключаю: служба на боксе + туннель этого компьютера.'
    Write-Host ''
    # Имя переменной не `$stop`: в шапке объявлен ключ `[switch]$Stop`, а регистр в PowerShell
    # не важен — присваивание хеш-таблицы в тот же слот падало «Hashtable → SwitchParameter».
    # Стек при этом указывал на строку вызова, а не на присваивание (замер 18.10.2026).
    $stopResult = Stop-OcService -SshArgs $sshArgs -Target $target -Unit $RemoteUnit
    $stopExit = Get-OcMarker -Text $stopResult.out -Name 'OC_EXIT'
    $stopState = Get-OcMarker -Text $stopResult.out -Name 'OC_STATE'
    $memBefore = Format-OcMemory -Raw (Get-OcMarker -Text $stopResult.out -Name 'OC_MEMBEFORE')
    $memAfter = Format-OcMemory -Raw (Get-OcMarker -Text $stopResult.out -Name 'OC_MEMAFTER')
    $availBefore = Get-OcAvailableMb -FreeLine (Get-OcMarker -Text $stopResult.out -Name 'OC_AVAILBEFORE')
    $availAfter = Get-OcAvailableMb -FreeLine (Get-OcMarker -Text $stopResult.out -Name 'OC_AVAILAFTER')
    $failed = 0
    if ($stopResult.status -eq 'timeout') {
        Write-Host 'Бокс не ответил за отведённое время — состояние службы неизвестно.'
        Write-Host "Проверь вручную: ssh $target `"systemctl is-active $RemoteUnit`""
        $failed = 1
    } elseif ($stopState -eq 'active') {
        Write-Host "Служба $RemoteUnit на боксе осталась active (код остановки: $stopExit)."
        if ($stopResult.err) { Write-Host $stopResult.err }
        $failed = 1
    } elseif (-not $stopState) {
        Write-Host "Ответ бокса непонятен (код остановки: $stopExit)."
        if ($stopResult.out) { Write-Host $stopResult.out }
        $failed = 1
    } else {
        # `failed` здесь — не сбой: приложение завершается кодом 130 по SIGTERM, и без
        # `SuccessExitStatus=130` в юните systemd записывает такую остановку как сбой.
        # Для владельца это остановка, поэтому и слово человеческое.
        $stateWord = if ($stopState -eq 'inactive' -or $stopState -eq 'failed') { 'остановлена' } else { "в состоянии $stopState" }
        Write-Host "Служба $RemoteUnit на боксе: $stateWord."
        Write-Host "  память службы:     $memBefore → $memAfter"
        if ($null -ne $availBefore -and $null -ne $availAfter) {
            Write-Host "  доступно на боксе: $availBefore МБ → $availAfter МБ"
        }
    }
    Write-Host ''
    [void](Close-OcTunnel -LocalPort $localPort -RemotePort $remotePort -Target $target)
    Write-Host ''
    if ($failed -eq 0) {
        Write-Host 'Бокс свободен от opencode. Включить обратно — ярлык запуска: он поднимет и службу, и туннель.'
    } else {
        Write-Host 'Выключение прошло не полностью — см. строки выше.'
    }
    exit $failed
}

if ($Setup) {
    $updated = Invoke-OcSetup -ConfPath $confPath -Target $target -Identity $identity -LocalPort $localPort -RemotePort $remotePort
    $target = $updated[0]
    $identity = $updated[1]
    $localPort = $updated[2]
    $remotePort = $updated[3]
    $sshArgs = New-OcSshArgs -Identity $identity
}

if ($Check) {
    exit (Invoke-OcCheck -ConfPath $confPath -ServerName $serverName -ServerDir $serverDir -Target $target -Identity $identity -LocalPort $localPort -RemotePort $remotePort -SshArgs $sshArgs)
}

if ($serverName) {
    Write-Host "Сервер: $serverName  (фрагмент $confPath)"
}
Write-Host "Веб-UI OpenCode: 127.0.0.1:$localPort → $target (127.0.0.1:$remotePort)"

# Отдельной проверки SSH нет: её роль выполняет запрос ссылки — одна сессия вместо двух.
$tunnel = $null
$ownTunnel = $false
$needTunnel = -not (Test-OcPort -Port $localPort)
if (-not $needTunnel) {
    if (Test-OcTunnelLive -LocalPort $localPort -RemotePort $remotePort -Target $target) {
        Write-Host "Туннель уже поднят на 127.0.0.1:$localPort — переиспользую его."
    } else {
        # Порт занят, а живого SSH-соединения за ним нет (или соединение ведёт к ДРУГОМУ серверу —
        # сверка цели в Test-OcTunnelLive): так выглядит туннель, переживший падение сервера
        # (замер 18.10.2026 вечер: сотни сокетов в CLOSE_WAIT, порт принимает соединения, а
        # форвардить некуда — и служба «выключена» на ровном месте).
        Write-Host "Порт 127.0.0.1:$localPort занят, но нашего живого SSH-соединения за ним нет — пересоздаю туннель."
        [void](Close-OcTunnel -LocalPort $localPort -RemotePort $remotePort -Target $target)
        $needTunnel = $true
    }
}
if ($needTunnel) {
    $fresh = New-OcTunnel -SshExe $SshExe -Target $target -Identity $identity -LocalPort $localPort -RemotePort $remotePort
    $tunnel = $fresh.proc
    $ownTunnel = $fresh.ok
    if (-not $fresh.ok) {
        Show-OcTunnelProblem -Proc $fresh.proc -LocalPort $localPort
        if ($fresh.proc -and -not $fresh.proc.HasExited) { $fresh.proc.Kill() }
        exit 1
    }
}

# --- служба на боксе: выключенную поднимаем, задохнувшуюся перезапускаем, мёртвый туннель
# пересоздаём — всё одним кликом.
# Ярлык «выключить» (-Off) гасит службу, чтобы она не ела память бокса. Запуск должен
# возвращать всё обратно, иначе смысл выключателя теряется. Живость проверяем через УЖЕ
# поднятый туннель (HTTP), а не отдельной ssh-сессией: на публичном :22 под сканерами лишняя
# сессия стоит десятки секунд. В обычном случае (служба работает) здесь не тратится ни одного
# ssh-подключения и ни одной секунды; вопрос к боксу задаётся только в тупике — потому что
# снаружи молчащая служба и выключенная выглядят одинаково (разбор — в шапке скрипта).
$serviceCode = Get-OcServiceHttp -Port $localPort
if ($serviceCode -eq 0) {
    Write-Host ''
    Write-Host 'Через туннель сервер не отвечает — спрашиваю бокс, что со службой.'
    $repair = Repair-OcAccess -SshArgs $sshArgs -SshExe $SshExe -Target $target -Identity $identity -Unit $RemoteUnit -LocalPort $localPort -RemotePort $remotePort
    if ($repair.proc) { $tunnel = $repair.proc }
    if ($repair.own) { $ownTunnel = $true }
    if (-not $repair.ok) {
        Write-Host $repair.message
        if ($ownTunnel -and $tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
        exit 1
    }
    $serviceCode = $repair.code
    Write-Host "Сервер отвечает (код $serviceCode)."
}

# --- одноразовая ссылка входа (пароль берётся на боксе, здесь не появляется)
$pairCmd = New-OcRemoteCommand -Template '__HELPER__ __RPORT__ __LPORT__; echo "OC_DONE:$?"' -Values @{
    __HELPER__ = $PairHelper; __RPORT__ = $remotePort; __LPORT__ = $localPort
}
$pair = Invoke-OcSshSession -SshArgs $sshArgs -Target $target -Command $pairCmd -TimeoutMs $SshSessionTimeoutMs
if (Test-OcRetryableSshFailure -Session $pair) {
    # Бокс общий и маленький, а на его публичном :22 висит фон интернета: новое подключение
    # иногда не укладывается в 60 с (замер 17.10: повтор помогал; 18.10: в SYN-RECV висело
    # 78–81 чужое соединение, холодный вход занял 42,5 с), а на плохом канале ssh выходит сам
    # по `ConnectTimeout`, и прежний повтор ждал своего таймаута зря. Класс — в
    # Test-OcRetryableSshFailure. Один повтор дешевле, чем мёртвое окно у владельца.
    if ($pair.status -eq 'timeout') {
        Write-Host 'SSH не ответил за 60 с — повторяю запрос ссылки один раз.'
    } else {
        Write-Host 'SSH оборвался на согласовании (banner exchange / таймаут соединения) — повторяю запрос ссылки один раз.'
    }
    $pair = Invoke-OcSshSession -SshArgs $sshArgs -Target $target -Command $pairCmd -TimeoutMs $SshSessionTimeoutMs
}
$link = ''
if ($pair.out -match 'http://\S+') { $link = $Matches[0] }
if ($link) {
    Write-Host ''
    Write-Host 'Ссылка входа (живёт 5 минут; сессия в браузере ≈30 дней, пароль не печатается):'
    Write-Host "  $link"
    if (-not $NoOpen) { Start-Process $link }
    Write-Host ''
    Write-Host "Дальше тот же адрес: http://127.0.0.1:$localPort/ (пока браузер помнит сессию, ссылка не нужна)."
} else {
    Write-Host ''
    Write-Host 'Не удалось получить ссылку входа.'
    if ($pair.status -eq 'exited') {
        Show-OcSshProblem -Text $pair.err -Target $target -ConfPath $confPath -Identity $identity
    } elseif ($pair.status -eq 'timeout') {
        Write-Host "SSH не ответил за отведённое время. Проверь вручную: ssh $target `"true`""
    }
    if ($pair.out) { Write-Host 'Ответ бокса:'; Write-Host $pair.out }
    if ($pair.err -and $pair.status -ne 'exited') { Write-Host $pair.err }
    Write-Host 'Если это новая машина — прогони: -Setup (подскажет, как завести ключ).'
    if ($ownTunnel -and $tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
    exit 1
}

if ($ownTunnel -and -not $NoWait) {
    Write-Host ''
    Write-Host 'Туннель работает, пока открыто это окно. Enter — закрыть туннель.'
    [void](Read-Host)
    if ($tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
    Write-Host 'Туннель закрыт.'
} elseif ($ownTunnel -and $NoWait) {
    Write-Host ''
    Write-Host 'Туннель остаётся поднятым и после закрытия окна (окно ssh скрыто).'
    Write-Host 'Закрыть его: этот же скрипт с ключом -Stop.'
}
