# Запускатель веб-UI OpenCode на прод-боксе GONBA: SSH-туннель + вход в браузере.
#
# Что делает: поднимает `ssh -N -L <локальный порт>:127.0.0.1:<порт на боксе> <цель>`, забирает
# у бокса одноразовую ссылку входа (код живёт 5 минут) и открывает её в браузере ЭТОГО компьютера.
# Пароль сервера нигде не печатается и на этом компьютере не хранится.
#
# Запуск (двойной клик — `opencode-web.cmd` рядом, либо из консоли):
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1          # подключиться
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Setup   # настроить этот компьютер
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Check   # проверить, всё ли на месте
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -NoOpen  # не открывать браузер
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -NoWait  # не ждать Enter (туннель остаётся)
#   powershell -ExecutionPolicy Bypass -File opencode-web.ps1 -Stop    # закрыть туннель этого компьютера
#
# Настройки компьютера лежат рядом со скриптом, в `opencode-web.conf` (шаблон — `opencode-web.conf.example`):
#   SSH_TARGET    — алиас из ~/.ssh/config этого компьютера либо user@host
#   IDENTITY_FILE — приватный ключ (пусто — ключи по умолчанию / ssh-agent)
#   LOCAL_PORT    — локальный порт туннеля (по умолчанию 14974)
#   REMOTE_PORT   — порт сервера на боксе (по умолчанию 49374)
# Файла нет — работают умолчания. Скрипт переносимый: ни адреса, ни пользователя внутри нет.
# Окно запускателя — пульт, а не туннель: сам `ssh` стартует СКРЫТО (`-WindowStyle Hidden`), поэтому
# чёрного окна ssh.exe на экране больше нет — 18.10 замерено, что оно есть и мешает (MainWindowHandle
# 395146 → 0 после правки). Enter в окне запускателя закрывает туннель; с `-NoWait` окно закрывается
# само, а туннель остаётся поднятым — закрыть его потом одним ключом `-Stop` (он же нужен Пасеке).
#
# Грабля клиента: OpenSSH для Windows не завершает процесс, если его std-хендлы перенаправлены
# (запуск не из консоли), хотя команда на боксе уже отработала. Поэтому здесь НЕ полагаемся на
# выход процесса: ждём в файле маркер `OC_DONE:<код>` и добиваем ssh, чтобы не оставлять зомби.
# В интерактивной консоли ssh завершается сам — маркер просто подтвердит успех.

param(
    [string]$SshTarget = '',
    [int]$LocalPort = 0,
    [int]$RemotePort = 0,
    [string]$IdentityFile = '',
    [string]$Config = '',
    [switch]$Setup,
    [switch]$Check,
    [switch]$NoOpen,
    [switch]$NoWait,
    [switch]$Stop
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

# Потолок одной ssh-сессии до бокса. Публичный :22 бокса живёт под сканерами, sshd придерживает
# новые подключения: замер 18.10 — 78–81 соединение в SYN-RECV, холодный вход занял 42,5 с. Прежние
# 30 с давали ложное «SSH не ответил» и у `-Check`, и у ярлыка владельца (поймано на живом прогоне).
$SshSessionTimeoutMs = 60000

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
    [System.IO.File]::WriteAllLines($Path, $lines, $utf8NoBom)
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

# Туннель мы поднимаем сами строкой `-L <локальный>:127.0.0.1:<удалённый>` — по ней его и находим
# (окна у него нет, командная строка — единственный след). Порты берутся из конфига компьютера.
function Get-OcTunnel {
    param([int]$LocalPort, [int]$RemotePort)
    $needle = "-L $LocalPort`:127.0.0.1:$RemotePort"
    if ($env:OS -ne 'Windows_NT') {
        $found = @()
        foreach ($sshProc in @(Get-Process -Name ssh -ErrorAction SilentlyContinue)) {
            $cmdline = ''
            try { $cmdline = [System.IO.File]::ReadAllText("/proc/$($sshProc.Id)/cmdline") -replace "`0", ' ' } catch { }
            if ($cmdline -like "*$needle*") { $found += [pscustomobject]@{ ProcessId = $sshProc.Id } }
        }
        return $found
    }
    return @(Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($needle) })
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

function New-OcSshArgs {
    param([string]$Identity)
    $args = @('-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8')
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
function Invoke-OcSshSession {
    param([string[]]$SshArgs, [string]$Target, [string]$Command, [int]$TimeoutMs = 25000)
    $suffix = [guid]::NewGuid().ToString('N')
    $outFile = Join-Path $env:TEMP "oc_ssh_out_$suffix.txt"
    $errFile = Join-Path $env:TEMP "oc_ssh_err_$suffix.txt"
    $started = Get-Date
    $text = ''
    $errText = ''
    $status = 'timeout'
    $proc = Start-Process -FilePath 'ssh' -ArgumentList ($SshArgs + @($Target, $Command)) `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile -NoNewWindow -PassThru
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
    Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue

    $code = $null
    if ($text -match "$DoneMarker`:(\d+)") { $code = [int]$Matches[1] }
    if ($code -eq $null -and $proc.HasExited) { $code = $proc.ExitCode }
    if ($errText) {
        # ssh на Windows жалуется на отсутствие консольного stdin — к делу не относится
        $errText = (($errText -split "`r?`n") | Where-Object { $_ -and $_ -notmatch 'GetConsoleMode' }) -join "`n"
    }
    return @{ status = $status; code = $code; out = $text; err = $errText.Trim() }
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
    param([string]$ConfPath, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort, [string[]]$SshArgs)
    $failed = 0
    Write-Host ''
    Write-Host 'Проверка этого компьютера и бокса'
    Write-Host ''
    if (Test-Path -LiteralPath $ConfPath) {
        Write-Host "  настройки: $ConfPath"
    } else {
        Write-Host "  настройки: файла нет ($ConfPath) — работают умолчания"
    }
    Write-Host "  ssh-цель:  $Target"
    Write-Host "  порты:     локальный $LocalPort → на боксе $RemotePort"
    if ($Identity) { Write-Host "  ключ:      $Identity" } else { Write-Host '  ключ:      по умолчанию / ssh-agent' }
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

    $unitCmd = New-OcRemoteCommand -Template 'systemctl is-active __UNIT__; echo "OC_DONE:$?"' -Values @{ __UNIT__ = $RemoteUnit }
    $unit = (Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $unitCmd -TimeoutMs $SshSessionTimeoutMs).out
    $unitState = (($unit -split "`r?`n") | Where-Object { $_ -and $_ -notmatch $DoneMarker }) -join ' '
    if ($unitState -match 'active') {
        Write-Host "   сервис:    $RemoteUnit — active"
    } else {
        Write-Host "  [!!] сервис $RemoteUnit на боксе: $unitState"
        Write-Host "       Поднять: ssh $Target `"sudo systemctl start $RemoteUnit`""
        $failed = 1
    }

    $httpCmd = New-OcRemoteCommand -Template 'curl -s -o /dev/null -w http=%{http_code} --max-time 8 http://127.0.0.1:__PORT__/api/info; echo "OC_DONE:$?"' -Values @{ __PORT__ = $RemotePort }
    $http = (Invoke-OcSshSession -SshArgs $SshArgs -Target $Target -Command $httpCmd -TimeoutMs $SshSessionTimeoutMs).out
    if ($http -match 'http=(401|403|200)') {
        Write-Host "   сервер:    отвечает на 127.0.0.1:$RemotePort (код $($Matches[1]) — 401 без пароля это норма)"
    } else {
        Write-Host "  [!!] сервер на 127.0.0.1:$RemotePort не ответил на /api/info (ответ: $http)"
        Write-Host "       Проверить: ssh $Target `"curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$RemotePort/api/info`""
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

$settings = Read-OcConfig -Path $Config
$target = $DefaultTarget
$identity = ''
$localPort = $DefaultLocalPort
$remotePort = $DefaultRemotePort
if ($settings.ContainsKey('SSH_TARGET') -and $settings['SSH_TARGET']) { $target = $settings['SSH_TARGET'] }
if ($settings.ContainsKey('IDENTITY_FILE') -and $settings['IDENTITY_FILE']) { $identity = Resolve-OcPath $settings['IDENTITY_FILE'] }
if ($settings.ContainsKey('LOCAL_PORT') -and $settings['LOCAL_PORT']) {
    $parsed = 0
    if ([int]::TryParse($settings['LOCAL_PORT'], [ref]$parsed)) { $localPort = $parsed }
}
if ($settings.ContainsKey('REMOTE_PORT') -and $settings['REMOTE_PORT']) {
    $parsed = 0
    if ([int]::TryParse($settings['REMOTE_PORT'], [ref]$parsed)) { $remotePort = $parsed }
}
if ($SshTarget) { $target = $SshTarget }
if ($IdentityFile) { $identity = Resolve-OcPath $IdentityFile }
if ($LocalPort -gt 0) { $localPort = $LocalPort }
if ($RemotePort -gt 0) { $remotePort = $RemotePort }

$sshArgs = New-OcSshArgs -Identity $identity

# --- закрыть туннель этого компьютера (`-Stop`)
if ($Stop) {
    $tunnels = @(Get-OcTunnel -LocalPort $localPort -RemotePort $remotePort)
    if ($tunnels.Count -eq 0) {
        Write-Host "Туннеля на 127.0.0.1:$localPort нет — закрывать нечего."
        exit 0
    }
    foreach ($tunnelProc in $tunnels) {
        try {
            Stop-Process -Id $tunnelProc.ProcessId -Force -ErrorAction Stop
            Write-Host "Туннель закрыт (pid $($tunnelProc.ProcessId))."
        } catch {
            Write-Host "Не удалось закрыть pid $($tunnelProc.ProcessId): $($_.Exception.Message)"
        }
    }
    Start-Sleep -Milliseconds 500
    if (Test-OcPort -Port $localPort) {
        Write-Host "Порт 127.0.0.1:$localPort всё ещё занят — его держит не наш туннель."
        exit 1
    }
    Write-Host "Порт 127.0.0.1:$localPort свободен."
    exit 0
}

if ($Setup) {
    $updated = Invoke-OcSetup -ConfPath $Config -Target $target -Identity $identity -LocalPort $localPort -RemotePort $remotePort
    $target = $updated[0]
    $identity = $updated[1]
    $localPort = $updated[2]
    $remotePort = $updated[3]
    $sshArgs = New-OcSshArgs -Identity $identity
}

if ($Check) {
    exit (Invoke-OcCheck -ConfPath $Config -Target $target -Identity $identity -LocalPort $localPort -RemotePort $remotePort -SshArgs $sshArgs)
}

Write-Host "Веб-UI OpenCode: 127.0.0.1:$localPort → $target (127.0.0.1:$remotePort)"

# Отдельной проверки SSH нет: её роль выполняет запрос ссылки — одна сессия вместо двух.
$tunnel = $null
$ownTunnel = $false
if (Test-OcPort -Port $localPort) {
    Write-Host "Туннель уже поднят на 127.0.0.1:$localPort — переиспользую его."
} else {
    $tunnelArgs = @(
        '-n', '-N',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ExitOnForwardFailure=yes'
    )
    if ($identity) { $tunnelArgs += @('-i', (Quote-OcArg $identity)) }
    $tunnelArgs += @('-L', "$localPort`:127.0.0.1:$remotePort", $target)
    # `-WindowStyle Hidden` — чтобы на экране не висело чёрное окно ssh.exe (оно и мешало владельцу).
    # Замер 18.10: с этим ключом окна нет (MainWindowHandle 0), форвардинг жив (401 через туннель).
    $tunnel = Start-Process -FilePath 'ssh' -ArgumentList $tunnelArgs -PassThru -WindowStyle Hidden
    $ownTunnel = $true
    # Ждём локальный порт до 60 с: ssh поднимает форвард только после аутентификации, а она
    # под сканерами на публичном :22 откладывается (замер 18.10: холодный вход 42 с).
    for ($i = 0; $i -lt 240; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-OcPort -Port $localPort) { break }
        if ($tunnel.HasExited) { break }
    }
    if (-not (Test-OcPort -Port $localPort)) {
        Write-Host ''
        Write-Host "Туннель не поднялся (127.0.0.1:$localPort)."
        if ($tunnel.HasExited) {
            Write-Host "ssh завершился с кодом $($tunnel.ExitCode) (окна у туннеля нет — он стартует скрыто; подробности даст ключ -Check)."
        } else {
            Write-Host 'ssh жив, но порт не занят: чаще всего бокс не успел пустить (сканеры на :22) — повтори запуск.'
        }
        Write-Host "Другая частая причина: локальный порт занят. Запусти с другим портом: -LocalPort $($localPort + 1000)"
        if ($tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
        exit 1
    }
}

# --- одноразовая ссылка входа (пароль берётся на боксе, здесь не появляется)
$pairCmd = New-OcRemoteCommand -Template '__HELPER__ __RPORT__ __LPORT__; echo "OC_DONE:$?"' -Values @{
    __HELPER__ = $PairHelper; __RPORT__ = $remotePort; __LPORT__ = $localPort
}
$pair = Invoke-OcSshSession -SshArgs $sshArgs -Target $target -Command $pairCmd -TimeoutMs $SshSessionTimeoutMs
if ($pair.status -eq 'timeout') {
    # Бокс общий и маленький, а на его публичном :22 висит фон интернета — новое
    # подключение иногда не укладывается и в 60 с (замер 17.10: повтор помогал,
    # 18.10: в SYN-RECV висело 78–81 чужое соединение, холодный вход занял 42,5 с).
    # Один повтор дешевле, чем мёртвое окно у владельца.
    Write-Host 'SSH не ответил за 60 с — повторяю запрос ссылки один раз.'
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
        Show-OcSshProblem -Text $pair.err -Target $target -ConfPath $Config -Identity $identity
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
