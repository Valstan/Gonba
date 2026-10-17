# One-click доступ к веб-UI OpenCode на прод-боксе: SSH-туннель + вход в браузере.
#
# Что делает: поднимает `ssh -N -L LocalPort:127.0.0.1:RemotePort SshHost`, просит у
# бокса одноразовую ссылку входа (код живёт 5 минут) и открывает её в браузере.
# Пароль сервера нигде не печатается и не хранится на этом компьютере.
#
# Запуск:
#   powershell -ExecutionPolicy Bypass -File scripts\opencode-web.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\opencode-web.ps1 -LocalPort 15974
#
# Окно надо держать открытым, пока работаешь: в нём живёт туннель. Enter — закрыть.

param(
    [int]$LocalPort = 14974,
    [int]$RemotePort = 49374,
    [string]$SshHost = 'GONBA',
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

function Test-OcPort {
    param([int]$P)
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $iar = $c.BeginConnect('127.0.0.1', $P, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(700)) { $c.Close(); return $false }
        $c.EndConnect($iar)
        $c.Close()
        return $true
    } catch { return $false }
}

$tunnel = $null
if (Test-OcPort $LocalPort) {
    Write-Host "Туннель уже поднят на 127.0.0.1:$LocalPort — переиспользую его."
} else {
    Write-Host "Поднимаю туннель: 127.0.0.1:$LocalPort -> ${SshHost} (127.0.0.1:$RemotePort)"
    $tunnel = Start-Process -FilePath 'ssh' -PassThru -ArgumentList @(
        '-N', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
        '-L', "$LocalPort`:127.0.0.1:$RemotePort", $SshHost
    )
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-OcPort $LocalPort) { break }
    }
    if (-not (Test-OcPort $LocalPort)) {
        Write-Host "Туннель не поднялся. Проверь алиас/ключ: ssh $SshHost"
        if ($tunnel -and -not $tunnel.HasExited) { $tunnel.Kill() }
        exit 1
    }
}

$link = (& ssh -o BatchMode=yes $SshHost "opencode-pair-link $RemotePort $LocalPort" 2>&1 | Out-String).Trim()
if ($link -match 'http://\S+') {
    $url = $Matches[0]
    Write-Host ""
    Write-Host "Ссылка входа (живёт 5 минут, сессия ≈30 дней, пароль не печатается):"
    Write-Host "  $url"
    if (-not $NoOpen) { Start-Process $url }
} else {
    Write-Host "Не удалось получить ссылку входа. Ответ бокса:"
    Write-Host $link
}

if ($tunnel) {
    Write-Host ""
    Write-Host "Туннель работает, пока открыто это окно. Enter — закрыть туннель."
    [void](Read-Host)
    if (-not $tunnel.HasExited) { $tunnel.Kill() }
    Write-Host "Туннель закрыт."
}
