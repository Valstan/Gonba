# opencode-web.test.ps1 — регрессия запускателя OpenCode Web (GONBA).
#
# Зачем отдельный тест. У этого бага есть свойство, из-за которого он НЕ виден в
# неинтерактивном прогоне. 17.10 запускатель упал при двойном клике из настоящей
# консоли сразу после подъёма туннеля, но до получения ссылки входа:
#
#     Невозможно вызвать метод для выражения со значением NULL.
#     ...opencode-web.ps1:178
#     +     return @{ status = $status; code = $code; out = $text; err = $err ...
#     FullyQualifiedErrorId : InvokeMethodOnNull
#
# Причина: ssh на Windows в интерактивной консоли не пишет в stderr ничего,
# `Get-Content -Raw` на пустом файле отдаёт $null (а не пустую строку), и `.Trim()`
# по нему — исключение. В среде без консоли ssh добавляет в stderr предупреждение
# GetConsoleMode, файл перестаёт быть пустым — баг маскируется: `-Check` зелёный,
# а ярлык падает (зелёный пайплайн не равен корректному результату, pool #011).
#
# Что делает тест: берёт ТЕКУЩИЙ scripts/opencode-web.ps1 и делает из него две копии
#   buggy — с вырезанной нулевой защитой в Read-OcRawText (историческое поведение),
#   фикс  — как есть,
# и в ОБЕИХ подменяет имя файла stderr на реально пустой файл. Это ровно то
# состояние, в котором запускатель оказывается при двойном клике, — и оно получено
# инъекцией, а не догадкой, поэтому проверка детерминированная и не требует консоли.
#
# Ожидание: buggy падает тем же исключением, текущая версия проходит `-Check`
# и отдаёт ссылку входа в сценарии двойного клика (без -Check, -NoOpen -NoWait).
#
# Требуется ssh-доступ к боксу — тот же, что нужен запускателю: тест ходит на прод
# (только чтение: systemctl is-active, curl /api/info, opencode --version, ссылка входа).
# E2E-шаг выполняется, только если туннель уже поднят: иначе тест не оставляет за
# собой лишнее окно ssh. Файл обязан быть UTF-8 с BOM — Windows PowerShell 5.1 иначе
# читает его как CP1251 и падает на кириллице в комментариях.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/opencode-web.test.ps1 [-LocalPort 14974]
# Exit:   0 — регрессия пройдена; 1 — не пройдена; 9 — не удалось собрать копии.

[CmdletBinding()]
param(
    [int]$LocalPort = 14974
)

$ErrorActionPreference = 'Continue'

$source = Join-Path $PSScriptRoot 'opencode-web.ps1'
if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "нет файла $source"
    exit 9
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('oc_web_test_' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $tmp -Force)
$emptyFile = Join-Path $tmp 'empty-stderr.txt'
[System.IO.File]::WriteAllBytes($emptyFile, (New-Object byte[] 0))
$buggyPath = Join-Path $tmp 'opencode-web-buggy.ps1'
$fixedPath = Join-Path $tmp 'opencode-web-fixed.ps1'

function New-EmptyStderrCopy {
    param([string]$Dest, [switch]$BreakNullGuard)
    $lines = Get-Content -LiteralPath $script:source
    $guard = 0
    $paths = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($BreakNullGuard -and $lines[$i] -match '\$null -eq \$raw') { $lines[$i] = ''; $guard++ }
        if ($lines[$i] -match '\$errText\s*=') {
            $before = $lines[$i]
            $lines[$i] = $lines[$i] -replace '\$errFile', ("'{0}'" -f $script:emptyFile)
            if ($lines[$i] -ne $before) { $paths++ }
        }
    }
    Set-Content -LiteralPath $Dest -Value $lines -Encoding UTF8
    return @{ guard = $guard; paths = $paths }
}

function Invoke-Launcher {
    param([string]$Path, [string[]]$Extra = @())
    $cliArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Path) + $Extra
    $out = (& powershell @cliArgs 2>&1 | Out-String)
    return @{ code = $LASTEXITCODE; out = [string]$out }
}

function Write-Lines {
    param([string]$Text)
    if (-not $Text) { return }
    ($Text.Trim() -split "`r?`n") | ForEach-Object { Write-Host "   | $_" }
}

Write-Host "Источник: $source"
Write-Host "Копии в:  $tmp"
Write-Host ''

$b = New-EmptyStderrCopy -Dest $buggyPath -BreakNullGuard
$f = New-EmptyStderrCopy -Dest $fixedPath
if ($b.guard -ne 1 -or $f.guard -ne 0 -or $b.paths -ne 1 -or $f.paths -ne 1) {
    Write-Host '!!! копии не собрались: структура opencode-web.ps1 изменилась — поправь тест'
    Write-Host "    buggy: guard=$($b.guard) stderr_path=$($b.paths); fixed: guard=$($f.guard) stderr_path=$($f.paths)"
    exit 9
}
Write-Host 'Подготовка: в обеих копиях stderr читается из реально пустого файла (как при двойном клике).'

Write-Host ''
Write-Host '--- RED: копия без нулевой защиты (ожидаем крах) ---'
$red = Invoke-Launcher -Path $buggyPath -Extra @('-Check')
Write-Host "   exit=$($red.code)"
Write-Lines $red.out
$redOk = ($red.code -ne 0) -and ($red.out -match 'InvokeMethodOnNull|значением NULL')
if (-not $redOk -and $red.out -match 'НЕТ ОТВЕТА') {
    Write-Host '   [повтор] ssh не уложился в потолок запускателя — это дрожание сети, а не проверяемое свойство; гоняю ещё раз'
    $red = Invoke-Launcher -Path $buggyPath -Extra @('-Check')
    Write-Host "   exit=$($red.code) (повтор)"
    Write-Lines $red.out
    $redOk = ($red.code -ne 0) -and ($red.out -match 'InvokeMethodOnNull|значением NULL')
}

Write-Host ''
Write-Host '--- GREEN: текущая версия (ожидаем «всё на месте») ---'
$green = Invoke-Launcher -Path $fixedPath -Extra @('-Check')
Write-Host "   exit=$($green.code)"
Write-Lines $green.out
$greenOk = ($green.code -eq 0) -and ($green.out -match 'opencode v')
if (-not $greenOk -and $green.out -match 'НЕТ ОТВЕТА') {
    # Замерено 17.10 (2 из 2) и подтверждено 18.10: первый ssh после паузы может не
    # уложиться в потолок запускателя — на публичном :22 бокса висят сканеры (18.10
    # в SYN-RECV стояло 70 чужих соединений, холодный вход занял 42 с), а на боксе
    # 1 ядро. К проверяемому свойству это не относится, поэтому повторяем один раз и
    # честно помечаем это в выводе, а не молчим.
    Write-Host '   [повтор] ssh не уложился в потолок — дрожание сети, а не регрессия; гоняю ещё раз'
    $green = Invoke-Launcher -Path $fixedPath -Extra @('-Check')
    Write-Host "   exit=$($green.code) (повтор)"
    Write-Lines $green.out
    $greenOk = ($green.code -eq 0) -and ($green.out -match 'opencode v')
}

Write-Host ''
Write-Host '--- E2E: сценарий двойного клика (без -Check) ---'
$portUp = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $portUp = $tcp.ConnectAsync('127.0.0.1', $LocalPort).Wait(1000) -and $tcp.Connected
    $tcp.Close()
} catch { $portUp = $false }

$e2eState = 'skipped (туннель не поднят)'
$e2eFail = $false
if (-not $portUp) {
    Write-Host "   порт $LocalPort не поднят — пропускаю, чтобы тест не оставил за собой лишнее окно ssh"
    Write-Host "   (подними туннель и повтори, если нужен полный прогон)"
} else {
    $e2e = Invoke-Launcher -Path $fixedPath -Extra @('-NoOpen', '-NoWait')
    Write-Host "   exit=$($e2e.code)"
    Write-Lines $e2e.out
    if (($e2e.code -eq 0) -and ($e2e.out -match ('http://127\.0\.0\.1:' + $LocalPort))) {
        $e2eState = 'ссылка получена'
    } elseif ($e2e.out -match 'НЕТ ОТВЕТА|не ответил|таймаут') {
        # Клиент ssh на Windows иногда не отдаёт вывод дольше 30 с (замерено 17.10 при
        # частых вызовах подряд): процесс жив, маркер не появляется, а следующий вызов
        # проходит сразу. Это дрожание клиента, а не проверяемое свойство — и уж точно
        # не доказательство работоспособности, поэтому помечаем inconclusive, а не ok.
        $e2eState = 'inconclusive (ssh-клиент не отдал вывод за 60 с; повтори прогон позже)'
    } else {
        $e2eState = "ПРОВАЛ (exit=$($e2e.code))"
        $e2eFail = $true
    }
}

Write-Host ''
if ($redOk -and $greenOk -and -not $e2eFail) {
    Write-Host "РЕГРЕССИЯ ПРОЙДЕНА: красное ($($red.code)) -> зелёное ($($green.code)); e2e: $e2eState."
    exit 0
}
Write-Host "РЕГРЕССИЯ НЕ ПРОЙДЕНА: red=$redOk green=$greenOk e2e=$e2eState"
exit 1
