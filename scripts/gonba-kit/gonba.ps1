# gonba-kit — удалённое управление ульем OpenCode на прод-боксе Гоньбы.
#
# Один файл логики, ярлыки-обёртки рядом (см. README.md). Требования: Windows 10+,
# PowerShell 5.1, ssh.exe (лучше из Git for Windows — G475), алиас `GONBA` в ~/.ssh/config.
#
# D-038: здесь НЕТ адреса бокса, имени пользователя и имени ключа — только алиас `GONBA`.
# Порт 49374 и локальный 14974 — функциональная необходимость (опубликованы в юните).
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Action = 'menu',
    [switch]$Yes,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------- конфиг ----------
$cfg = @{
    SSH_ALIAS       = 'GONBA'
    CHAT_LOCAL_PORT = '14974'
    ENGINE_PORT     = '49374'
}
$conf = Join-Path $script:Root 'gonba.conf'
if (Test-Path $conf) {
    foreach ($line in Get-Content -LiteralPath $conf) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -gt 0) { $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim() }
    }
}

# ---------- ssh ----------
function Find-SshExe {
    $cands = @(
        (Join-Path $env:ProgramFiles 'Git\usr\bin\ssh.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\usr\bin\ssh.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\usr\bin\ssh.exe'),
        (Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe')
    )
    foreach ($c in $cands) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
    $cmd = Get-Command ssh.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw 'ssh.exe не найден: поставь Git for Windows (или компонент «Клиент OpenSSH»).'
}

$script:SshExe = Find-SshExe
$script:Dest = $cfg.SSH_ALIAS
$script:BaseOpts = @(
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=20',
    '-o', 'ServerAliveInterval=20',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'BatchMode=yes'
)

function Read-SharedText {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    try {
        $fs = [IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
        $sr = New-Object IO.StreamReader($fs)
        $t = $sr.ReadToEnd()
        $sr.Close(); $fs.Close()
        return $t
    } catch { return '' }
}

# OpenSSH для Windows не завершает процесс и не отдаёт вывод, если его std-хендлы
# перенаправлены (запуск не из консоли): процесс висит, вывод опаздывает. Поэтому
# вывод идёт в файлы, а конец команды распознаётся по маркеру `OC_DONE:<код>` —
# ровно как в scripts/opencode-web.ps1 (там это стоило полудня отладки).
#
# Вторая, более злая грабля (28.10): `Start-Process -ArgumentList` склеивает массив
# в командную строку БЕЗ кавычек, а ssh.exe разбирает её заново. Строка
# `sudo -n bash -c 'systemctl start opencode-web'` доезжала до бокса как
# `sudo -n bash -c systemctl start opencode-web` — bash запускал голый `systemctl`,
# тот печатал список юнитов и выходил с 0. Снаружи это выглядело как успешный
# запуск службы, которой никто не запускал (45 с ожидания и «не поднялся»), —
# при этом `systemctl stop …` без кавычек работал, что и путало.
# Лечение: тело команды отдаём base64-строкой, в которой нет ни кавычек, ни `$`,
# ни пробелов внутри токена. Разбор аргументов на такой строке ничего не теряет.
function Invoke-RemoteCore {
    param([string]$Command, [int]$TimeoutMs = 90000, [switch]$Root)
    $tag = [guid]::NewGuid().ToString('N')
    $outFile = Join-Path $env:TEMP "gonba-kit-$tag.out"
    $errFile = Join-Path $env:TEMP "gonba-kit-$tag.err"
    $body = ($Command -replace "`r`n", "`n").TrimEnd()
    $scriptBytes = [Text.Encoding]::UTF8.GetBytes($body + "`necho OC_DONE:`$?`n")
    $b64 = [Convert]::ToBase64String($scriptBytes)
    $pipeTarget = if ($Root) { 'sudo -n bash' } else { 'bash' }
    $wrapped = "echo $b64 | base64 -d | $pipeTarget"
    $a = @()
    $a += $script:BaseOpts
    $a += @('-T', $script:Dest, $wrapped)
    $proc = Start-Process -FilePath $script:SshExe -ArgumentList $a -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    $started = Get-Date
    $text = ''
    $code = $null
    while (((Get-Date) - $started).TotalMilliseconds -lt $TimeoutMs) {
        $text = Read-SharedText $outFile
        if ($text -match 'OC_DONE:(\d+)') { $code = [int]$Matches[1]; break }
        if ($proc.HasExited) {
            Start-Sleep -Milliseconds 300
            $text = Read-SharedText $outFile
            if ($text -match 'OC_DONE:(\d+)') { $code = [int]$Matches[1] }
            break
        }
        Start-Sleep -Milliseconds 300
    }
    $timedOut = ($null -eq $code)
    if (-not $proc.HasExited) { try { $proc.Kill() } catch { } }
    $errText = Read-SharedText $errFile
    Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue
    $clean = ($text -replace 'OC_DONE:\d+\s*$', '').TrimEnd()
    if ($timedOut) {
        return [pscustomobject]@{ Output = (($clean + "`n" + $errText).Trim()); Code = 124; Timeout = $true }
    }
    return [pscustomobject]@{ Output = $clean; Code = $code; Timeout = $false }
}

function Invoke-Remote {
    param([string]$Command, [int]$TimeoutMs = 90000)
    return Invoke-RemoteCore -Command $Command -TimeoutMs $TimeoutMs
}

function Invoke-RemoteRoot {
    param([string]$Command, [int]$TimeoutMs = 120000)
    return Invoke-RemoteCore -Command $Command -TimeoutMs $TimeoutMs -Root
}

function Assert-RemoteOk {
    param($Result, [string]$What)
    if ($Result.Code -ne 0) {
        throw "${What}: ssh вернул код $($Result.Code).`n$($Result.Output)"
    }
}

function Test-PortBusy {
    param([int]$Port)
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    }
    return [bool](netstat -ano | Select-String ":$Port\s")
}

function Get-TunnelPidFile { Join-Path $env:TEMP "gonba-kit-chat.pid" }

function Get-OcTunnels {
    # Свои туннели узнаём по командной строке: пара портов И алиас последним аргументом.
    $port = [int]$cfg.CHAT_LOCAL_PORT
    $engine = [int]$cfg.ENGINE_PORT
    $found = @()
    foreach ($p in (Get-CimInstance Win32_Process -Filter "Name = 'ssh.exe'" -ErrorAction SilentlyContinue)) {
        $cl = $p.CommandLine
        if (-not $cl) { continue }
        if ($cl -match "-L\s+${port}:127\.0\.0\.1:${engine}" -and $cl -match "(^|\s)$([regex]::Escape($script:Dest))(\s|$|`")") {
            $found += $p
        }
    }
    return $found
}

function Start-ChatTunnel {
    $port = [int]$cfg.CHAT_LOCAL_PORT
    $engine = [int]$cfg.ENGINE_PORT
    $mine = @(Get-OcTunnels)
    if ($mine.Count -gt 0) {
        Write-Host "Туннель уже поднят (порт $port) — использую его." -ForegroundColor DarkGray
        return
    }
    if (Test-PortBusy $port) {
        throw "Порт $port занят не нашим туннелем (чужой процесс). Закрой его или смени CHAT_LOCAL_PORT в gonba.conf."
    }
    $a = @()
    $a += $script:BaseOpts
    $a += @('-N', '-o', 'ExitOnForwardFailure=yes', '-L', "${port}:127.0.0.1:${engine}", $script:Dest)
    $proc = Start-Process -FilePath $script:SshExe -ArgumentList $a -PassThru -WindowStyle Hidden
    for ($i = 0; $i -lt 80; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PortBusy $port) {
            Set-Content -LiteralPath (Get-TunnelPidFile) -Value $proc.Id -Encoding ascii
            return
        }
        if ($proc.HasExited) { break }
    }
    try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
    throw "Туннель не поднялся за 40 с. Проверь вручную: ssh -N -L ${port}:127.0.0.1:${engine} $($script:Dest)"
}

function Stop-ChatTunnel {
    $file = Get-TunnelPidFile
    if (Test-Path -LiteralPath $file) {
        $id = (Get-Content -LiteralPath $file | Select-Object -First 1)
        try { Stop-Process -Id ([int]$id) -Force -ErrorAction Stop; Write-Host 'Туннель закрыт.' } catch { }
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    }
    foreach ($p in @(Get-OcTunnels)) {
        try { Stop-Process -Id $p.ProcessId -Force; Write-Host "Туннель закрыт (pid $($p.ProcessId))." } catch { }
    }
    if (-not (Test-PortBusy ([int]$cfg.CHAT_LOCAL_PORT))) {
        Write-Host "Порт $($cfg.CHAT_LOCAL_PORT) свободен." -ForegroundColor DarkGray
    }
}

function Get-EngineState {
    # 401/200 от /api/info = живой; 000 = молчит или не запущен.
    $r = Invoke-Remote "curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:$($cfg.ENGINE_PORT)/api/info"
    if ($r.Code -ne 0) { return 'unknown' }
    switch ($r.Output.Trim()) {
        '401' { return 'up' }
        '200' { return 'up' }
        '000' { return 'down' }
        default { return 'down' }
    }
}

function Wait-Engine {
    # Одна ssh-сессия вместо опроса из клиента: на Windows каждый ssh — это
    # секунды на рукопожатие, и «60 попыток» превращаются в пять минут.
    param([int]$TimeoutSec = 60)
    $tmpl = 'i=0; code=000; while [ $i -lt __T__ ]; do code=$(curl -s -o /dev/null -w ''%{http_code}'' --max-time 2 http://127.0.0.1:__P__/api/info); [ "$code" != "000" ] && break; sleep 1; i=$((i+1)); done; echo "OC_HTTP:$code"'
    $cmd = $tmpl.Replace('__T__', "$TimeoutSec").Replace('__P__', $cfg.ENGINE_PORT)
    $r = Invoke-Remote $cmd -TimeoutMs (($TimeoutSec + 30) * 1000)
    if ($r.Output -match 'OC_HTTP:(\d+)') { return ($Matches[1] -ne '000') }
    return $false
}

function Show-Header { param([string]$Text) Write-Host ''; Write-Host "=== $Text ===" -ForegroundColor Cyan }

# ---------- действия ----------
function Action-Chat {
    Show-Header 'Чат OpenCode на боксе Гоньбы'
    if ((Get-EngineState) -ne 'up') {
        Write-Host 'Движок не отвечает — запускаю (ВПН поднимется вместе с ним)...' -ForegroundColor Yellow
        $r = Invoke-RemoteRoot 'systemctl start opencode-web' -TimeoutMs 180000
        if ($r.Code -ne 0) { throw "Не удалось запустить службу:`n$($r.Output)" }
        if (-not (Wait-Engine -TimeoutSec 45)) {
            # Показываем не «не поднялось», а состояние и хвост журнала: иначе владелец
            # снова гадает, что случилось (это уже стоило полутора суток 18.10).
            $diag = Invoke-RemoteRoot 'systemctl is-active opencode-web; systemctl show opencode-web -p Result -p NRestarts; journalctl -u opencode-web -n 8 --no-pager -o cat'
            throw "Движок не поднялся за 45 с.`n$($diag.Output)"
        }
    }
    Start-ChatTunnel
    $r = Invoke-Remote "opencode-pair-link $($cfg.ENGINE_PORT) $($cfg.CHAT_LOCAL_PORT)"
    Assert-RemoteOk $r 'Не удалось получить ссылку входа'
    $link = ($r.Output -split "`r?`n" | Where-Object { $_ -match '^https?://' } | Select-Object -Last 1)
    if (-not $link) { throw "Сервер не вернул ссылку. Ответ: $($r.Output)" }
    Write-Host "Ссылка входа: $link"
    if ($NoOpen) { Write-Host '(браузер не открываю: -NoOpen)' -ForegroundColor DarkGray }
    else { Start-Process $link }
    Write-Host "Туннель 127.0.0.1:$($cfg.CHAT_LOCAL_PORT) держится. Закрыть — ярлык «Закрыть туннели»." -ForegroundColor DarkGray
}

function Action-Off {
    Show-Header 'Выключаю улей (служба на боксе + ВПН + туннель)'
    $r = Invoke-RemoteRoot 'systemctl stop opencode-web neural-vpn'
    if ($r.Code -ne 0) { Write-Host "Остановка службы: $($r.Output)" -ForegroundColor Yellow }
    else { Write-Host 'Движок и ВПН остановлены — бокс больше не тратит на них память.' -ForegroundColor Green }
    Stop-ChatTunnel
}

function Action-Stop {
    Show-Header 'Закрываю туннель (служба на боксе продолжает работать)'
    Stop-ChatTunnel
}

function Action-Vpn {
    Show-Header 'Смена сервера ВПН (egress движка)'
    $before = Invoke-Remote 'cat /var/lib/neural/vpn/current.json 2>/dev/null || echo "нет состояния"'
    Write-Host "было: $($before.Output)"
    Write-Host 'Переключаю (10-60 с: перебор серверов подписки)...'
    $r = Invoke-RemoteRoot '/etc/neural/egress.d/10-nextgenvpn.sh' -TimeoutMs 300000
    if ($r.Code -ne 0) {
        Write-Host $r.Output -ForegroundColor Red
        throw 'Смена сервера не удалась — движок остался без нового выхода (отказ безопасный: прямого выхода у него нет).'
    }
    Write-Host $r.Output
    $after = Invoke-Remote 'cat /var/lib/neural/vpn/current.json'
    Write-Host "стало: $($after.Output)"
    $health = Invoke-Remote "curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:$($cfg.ENGINE_PORT)/api/info"
    Write-Host "движок после смены: HTTP $($health.Output.Trim())"
    Write-Host 'Лимит free-моделей считается по IP: свежий сервер даёт свежий адрес, но массовая подписка часто уже израсходована — тогда лимит остаётся (замер 22.10).' -ForegroundColor Yellow
}

function Action-Restart {
    Show-Header 'Перезапуск движка OpenCode'
    $r = Invoke-RemoteRoot 'systemctl restart opencode-web' -TimeoutMs 180000
    Assert-RemoteOk $r 'Перезапуск не удался'
    if (Wait-Engine -TimeoutSec 60) { Write-Host 'Движок поднялся, отвечает.' -ForegroundColor Green }
    else {
        Write-Host 'Движок не ответил за 60 с. Хвост журнала:' -ForegroundColor Red
        (Invoke-RemoteRoot 'journalctl -u opencode-web -n 20 --no-pager').Output | Write-Host
        exit 1
    }
}

function Action-Status {
    Show-Header 'Состояние бокса Гоньбы'
    $remote = 'echo @@UPTIME; uptime -p; echo @@LOAD; cat /proc/loadavg; echo @@FREE; free -m; echo @@DISK; df -h /; echo @@UNITS; systemctl is-active opencode-web neural-vpn opencode-web-watchdog.timer gonba; echo @@VER; opencode --version 2>/dev/null; echo @@HEALTH; curl -s -o /dev/null -w ''%{http_code}'' --max-time 8 http://127.0.0.1:49374/api/info; echo; echo @@EGRESS; cat /var/lib/neural/vpn/current.json 2>/dev/null; echo; echo @@EXITIP; curl -s -x http://127.0.0.1:8118 --max-time 10 https://api.ipify.org 2>/dev/null; echo'
    $r = Invoke-Remote $remote
    Assert-RemoteOk $r 'Не удалось прочитать состояние'

    $blocks = @{}
    $cur = ''
    foreach ($line in ($r.Output -split "`r?`n")) {
        if ($line -match '^@@(\w+)$') { $cur = $Matches[1]; $blocks[$cur] = @(); continue }
        if ($cur) { $blocks[$cur] += $line }
    }

    Write-Host ("host:   Гоньба (прод)   uptime: {0}" -f (($blocks['UPTIME'] -join ' ').Trim()))
    if ($blocks['LOAD']) {
        $l = ($blocks['LOAD'] -join '').Trim() -split '\s+'
        Write-Host ("load:   {0} {1} {2}" -f $l[0], $l[1], $l[2])
    }
    $freeLine = ($blocks['FREE'] | Where-Object { $_ -match '^Mem:' })
    if ($freeLine) {
        $f = $freeLine.Trim() -split '\s+'
        Write-Host ("ram:    доступно {0} MB из {1} MB" -f $f[6], $f[1])
    }
    $diskLine = ($blocks['DISK'] | Where-Object { $_ -match '/$' })
    if ($diskLine) {
        $d = $diskLine.Trim() -split '\s+'
        Write-Host ("disk:   {0} из {1} ({2})" -f $d[2], $d[1], $d[4])
    }
    Write-Host ''
    $names = @('opencode-web', 'neural-vpn', 'opencode-web-watchdog.timer', 'gonba')
    $states = $blocks['UNITS']
    for ($i = 0; $i -lt $names.Count; $i++) {
        $st = if ($i -lt $states.Count) { $states[$i] } else { '?' }
        $color = if ($st -eq 'active') { 'Green' } else { 'Yellow' }
        Write-Host ("{0,-30} {1}" -f $names[$i], $st) -ForegroundColor $color
    }
    Write-Host ''
    Write-Host ("engine:  {0}" -f (($blocks['VER'] -join ' ').Trim()))
    Write-Host ("health:  HTTP {0} (401 = жив, нужен пароль)" -f (($blocks['HEALTH'] -join ' ').Trim()))
    Write-Host ("egress:  {0}" -f (($blocks['EGRESS'] -join ' ').Trim()))
    # Выход через HTTP-инбаунд — то, чем реально ходит движок. У массовой подписки
    # один «сервер» может отдавать разные адреса (балансировка), поэтому сверяем не
    # с current.json, а с адресом бокса: он не должен совпасть (D-152, fail-closed).
    Write-Host ("выход движка: {0} (прямой адрес бокса — не он)" -f (($blocks['EXITIP'] -join ' ').Trim()))
    Write-Host ''
    $state = if (@(Get-OcTunnels).Count -gt 0) { "поднят на $($cfg.CHAT_LOCAL_PORT)" } else { 'закрыт' }
    Write-Host ("локально: туннель чата — {0}" -f $state) -ForegroundColor DarkGray
}

function Action-Logs {
    Show-Header 'Журнал движка (40 строк)'
    $r = Invoke-RemoteRoot 'journalctl -u opencode-web -n 40 --no-pager'
    Assert-RemoteOk $r 'Журнал не прочитан'
    Write-Host $r.Output
}

function Action-Shell {
    Show-Header 'SSH-консоль бокса Гоньбы (exit — выход)'
    $a = @()
    $a += $script:BaseOpts
    $a += $script:Dest
    & $script:SshExe @a
}

function Action-Doctor {
    Show-Header 'Проверка набора'
    Write-Host "ssh:    $($script:SshExe)"
    # `ssh -V` пишет в stderr: при ErrorActionPreference=Stop PowerShell 5.1
    # превращает это в terminating-ошибку, а при Continue — в шум в консоли.
    # Поэтому версию читаем через cmd /c, как в эталонном наборе es-vps.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $ver = (cmd /c "`"$($script:SshExe)`" -V 2>&1" | Out-String).Trim()
    $ErrorActionPreference = $prev
    $ver = $ver -replace '^ssh\.exe\s*:\s*', ''
    Write-Host "версия: $ver"
    if ($ver -match '7\.7') { Write-Host 'Внимание: системный ssh 7.7p1 медленный (G475) — поставь Git for Windows.' -ForegroundColor Yellow }
    Write-Host "цель:   алиас $($script:Dest) из ~/.ssh/config"
    # `|| true` в конце обязателен: `systemctl is-active` на неактивном юните
    # возвращает 3, и маркер OC_DONE честно приносил 3 — связь при этом живая.
    # Из-за этого «доктор» ругался ровно на выключенном (штатном) улье.
    $r = Invoke-Remote 'hostname -s; echo ---; systemctl is-active opencode-web neural-vpn || true'
    if ($r.Code -eq 0) { Write-Host "связь:  ok`n$($r.Output)" -ForegroundColor Green }
    else { Write-Host "связь:  нет (код $($r.Code))`n$($r.Output)" -ForegroundColor Red }
}

function Action-Menu {
    while ($true) {
        Write-Host ''
        Write-Host '  GONBA — улей OpenCode на прод-боксе' -ForegroundColor Cyan
        Write-Host '  1  Чат OpenCode (туннель + ссылка входа)'
        Write-Host '  2  Сменить сервер ВПН (egress)'
        Write-Host '  3  Перезапустить движок'
        Write-Host '  4  Выключить улей (служба + туннель)'
        Write-Host '  5  Состояние сервера'
        Write-Host '  6  Логи движка'
        Write-Host '  7  SSH-консоль'
        Write-Host '  8  Закрыть туннель (движок продолжает работать)'
        Write-Host '  q  Выход'
        $c = Read-Host 'Выбор'
        switch ($c) {
            '1' { Action-Chat }
            '2' { Action-Vpn }
            '3' { Action-Restart }
            '4' { Action-Off }
            '5' { Action-Status }
            '6' { Action-Logs }
            '7' { Action-Shell }
            '8' { Action-Stop }
            'q' { return }
            default { Write-Host 'Нет такого пункта.' -ForegroundColor Yellow }
        }
    }
}

switch ($Action.ToLower()) {
    'chat' { Action-Chat }
    'vpn' { Action-Vpn }
    'restart' { Action-Restart }
    'off' { Action-Off }
    'stop' { Action-Stop }
    'status' { Action-Status }
    'logs' { Action-Logs }
    'shell' { Action-Shell }
    'doctor' { Action-Doctor }
    'menu' { Action-Menu }
    default { throw "Неизвестное действие: $Action (chat|vpn|restart|off|stop|status|logs|shell|doctor)" }
}
