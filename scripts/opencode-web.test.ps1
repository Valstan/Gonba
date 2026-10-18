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
# Вторая часть (18.10.2026 вечер) — про решение в тупике «через туннель сервер не отвечает»:
# она полностью офлайновая (ssh-вызовы подменены заглушками, бокс подставной) и проверяет
# пять сценариев плюс воспроизведение исторической логики. Ни одной ssh-сессии не тратит.
#
# Третья часть (18.10.2026, письмо Мозга «Формат пульта») — выбор сервера (`-Server`/`-Servers`):
# тоже офлайновая, файлы фрагментов настоящие во временной папке, ssh не нужен. Проверяет, что
# названный сервер не подменяется молча (нет фрагмента — остановка с перечнем), что параметры
# командной строки старше файла, и что без `-Server` поведение прежнее. Красное — инъекция
# исходной формы «файла нет — умолчания»: тот же сценарий становится зелёным по виду
# и неправильным по сути.
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
# ---------------------------------------------------------------- решение в тупике (18.10.2026 вечер)
#
# Вторая часть — про вечерний цикл владельца: «служба opencode-web выключена — поднимаю её»,
# и так по кругу. Служба при этом была АКТИВНА и молчала: cgroup упёрся в MemoryHigh=500M
# (548 МБ, memory pressure 100 %), до MemoryMax не дошёл — ядро никого не убило, и
# `Restart=on-failure` не сработал. Проверка «через туннель» не отличает молчащую службу
# от выключенной, поэтому запускатель делал `systemctl start` по активному юниту — пустую
# операцию — и никогда не выходил из цикла.
#
# Приём тот же, что и в первой части: НЕ догадка по коду, а инъекция исторического поведения
# в копию скрипта (любой тупик = «поднимаю службу»; туннель чинит владелец руками) плюс
# подставной бокс — заглушки вместо ssh-вызовов. Прод не трогается: ни одной ssh-сессии.
$harnessHead = @'
$ErrorActionPreference = 'Stop'
$script:calls = New-Object System.Collections.ArrayList
$script:tunnelRestored = $false
function Add-OcCall { param([string]$Name) [void]$script:calls.Add($Name) }
function Get-OcMarker {
    param([string]$Text, [string]$Name)
    if ($Text -match ('(?m)^' + [regex]::Escape($Name) + ':(.*)$')) { return $Matches[1].Trim() }
    return ''
}
function Format-OcMemory {
    param([string]$Raw)
    if (-not $Raw) { return 'память неизвестна' }
    if ($Raw -match '(\d+)') { return ('{0} МБ' -f [math]::Round([int64]$Matches[1] / 1MB)) }
    return 'память неизвестна'
}
function Get-OcServiceHttp {
    param([int]$Port, [int]$TimeoutMs = 4000)
    if ($script:tunnelRestored) { return [int]$env:STUB_TUNNEL_AFTER }
    return [int]$env:STUB_TUNNEL_BEFORE
}
function Get-OcBoxState {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 60000)
    Add-OcCall 'probe'
    $out = 'OC_ACTIVE:' + $env:STUB_UNIT_ACTIVE + "`n" + 'OC_BOXHTTP:' + $env:STUB_BOX_HTTP + "`n" + 'OC_MEM:548000000' + "`n" + 'OC_PRESSURE:some avg10=100.00 avg60=100.00'
    return @{ status = $env:STUB_STATE_STATUS; code = 0; out = $out; err = '' }
}
function Start-OcService {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 120000)
    Add-OcCall 'start'
    return @{ status = 'ready'; code = 0; out = ('OC_HTTP:' + $env:STUB_ACTION_HTTP); err = '' }
}
function Restart-OcService {
    param([string[]]$SshArgs, [string]$Target, [string]$Unit, [int]$Port, [int]$TimeoutMs = 150000)
    Add-OcCall 'restart'
    return @{ status = 'ready'; code = 0; out = ('OC_HTTP:' + $env:STUB_ACTION_HTTP + "`n" + 'OC_MEMAFTER:161000000'); err = '' }
}
function Restore-OcTunnel {
    param([string]$SshExe, [string]$Target, [string]$Identity, [int]$LocalPort, [int]$RemotePort)
    Add-OcCall 'tunnel'
    $script:tunnelRestored = $true
    return @{ ok = $true; proc = $null; code = [int]$env:STUB_TUNNEL_AFTER }
}
'@
$harnessTail = @'
$repair = Repair-OcAccess -SshArgs @() -SshExe 'ssh' -Target 'GONBA' -Identity '' -Unit 'opencode-web' -LocalPort 14974 -RemotePort 49374
Write-Output ('RESULT ok=' + $repair.ok + ' code=' + $repair.code + ' own=' + $repair.own)
Write-Output ('CALLS ' + ($script:calls -join ','))
Write-Output ('MESSAGE ' + $repair.message)
'@

# В копии калечим ровно решение в тупике — иначе красное и зелёное отличались бы не тем,
# что мы проверяем. Счётчики возвращаются в любом случае: они ловят изменение структуры
# скрипта (как `guard` в первой части), а не только «калечение».
function New-DecisionCopy {
    param([string]$Path, [string]$Dest, [switch]$BreakDecision)
    $lines = @(Get-Content -LiteralPath $Path)
    $decision = 0
    $tunnel = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*if \(\`$unitActive -ne 'active'\) \{") {
            $decision++
            if ($BreakDecision) { $lines[$i] = '    if ($true) {' }
        }
        if ($lines[$i] -match "if \(\`$code -eq 0 -and \`$boxHttp -match") {
            $tunnel++
            if ($BreakDecision) { $lines[$i] = '    if ($false) {' }
        }
    }
    Set-Content -LiteralPath $Dest -Value $lines -Encoding UTF8
    return @{ decision = $decision; tunnel = $tunnel }
}

# Тело решения берём из ТОЙ ЖЕ копии: у калеченой — калеченое, у текущей — настоящее.
function Get-RepairText {
    param([string]$Path)
    $lines = @(Get-Content -LiteralPath $Path)
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^function Repair-OcAccess \{') { $start = $i; break }
    }
    if ($start -lt 0) { return $null }
    for ($j = $start + 1; $j -lt $lines.Count; $j++) {
        if ($lines[$j] -eq '}') { return ($lines[$start..$j] -join "`r`n") }
    }
    return $null
}

function Invoke-DecisionScenario {
    param([string]$HarnessPath, [string]$RepairText, [hashtable]$Env)
    $text = $harnessHead + "`r`n" + $RepairText + "`r`n" + $harnessTail
    Set-Content -LiteralPath $HarnessPath -Value $text -Encoding UTF8
    foreach ($key in $Env.Keys) { Set-Item -Path ('Env:' + $key) -Value $Env[$key] }
    $cliArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $HarnessPath)
    $out = (& powershell @cliArgs 2>&1 | Out-String)
    return [string]$out
}

$decisionBuggyPath = Join-Path $tmp 'opencode-web-decision-buggy.ps1'
$decisionFixedPath = Join-Path $tmp 'opencode-web-decision-fixed.ps1'
$harnessPath = Join-Path $tmp 'decision-harness.ps1'
$db = New-DecisionCopy -Path $source -Dest $decisionBuggyPath -BreakDecision
$df = New-DecisionCopy -Path $source -Dest $decisionFixedPath
$repairBuggy = Get-RepairText -Path $decisionBuggyPath
$repairFixed = Get-RepairText -Path $decisionFixedPath
if ($db.decision -ne 1 -or $db.tunnel -ne 1 -or $df.decision -ne 1 -or $df.tunnel -ne 1 -or -not $repairBuggy -or -not $repairFixed) {
    Write-Host '!!! решение в тупике не собралось: структура Repair-OcAccess изменилась — поправь тест'
    Write-Host "    buggy: decision=$($db.decision) tunnel=$($db.tunnel); fixed: decision=$($df.decision) tunnel=$($df.tunnel); тело: $(!!$repairBuggy)/$(!!$repairFixed)"
    exit 9
}

$scenarios = @(
    @{
        name = 'служба выключена — поднять'
        env = @{ STUB_STATE_STATUS = 'ready'; STUB_UNIT_ACTIVE = 'inactive'; STUB_BOX_HTTP = '000'; STUB_ACTION_HTTP = '401'; STUB_TUNNEL_BEFORE = '401'; STUB_TUNNEL_AFTER = '401' }
        wantText = 'поднимаю её'; wantCalls = 'CALLS probe,start'; wantOk = $true; wantCode = 401; forbidText = 'перезапускаю её'
    },
    @{
        name = 'служба активна и отвечает на боксе — виноват туннель, пересоздать'
        env = @{ STUB_STATE_STATUS = 'ready'; STUB_UNIT_ACTIVE = 'active'; STUB_BOX_HTTP = '401'; STUB_ACTION_HTTP = '401'; STUB_TUNNEL_BEFORE = '0'; STUB_TUNNEL_AFTER = '401' }
        wantText = 'пересоздаю туннель'; wantCalls = 'CALLS probe,tunnel'; wantOk = $true; wantCode = 401; forbidText = 'поднимаю её'
    },
    @{
        name = 'служба активна и молчит на боксе — перезапустить, потом туннель'
        env = @{ STUB_STATE_STATUS = 'ready'; STUB_UNIT_ACTIVE = 'active'; STUB_BOX_HTTP = '000'; STUB_ACTION_HTTP = '401'; STUB_TUNNEL_BEFORE = '0'; STUB_TUNNEL_AFTER = '401' }
        wantText = 'перезапускаю её'; wantCalls = 'CALLS probe,restart,tunnel'; wantOk = $true; wantCode = 401; forbidText = 'поднимаю её'
    },
    @{
        name = 'ничего не помогло — честная сдача, без выдумок'
        env = @{ STUB_STATE_STATUS = 'ready'; STUB_UNIT_ACTIVE = 'active'; STUB_BOX_HTTP = '000'; STUB_ACTION_HTTP = '000'; STUB_TUNNEL_BEFORE = '0'; STUB_TUNNEL_AFTER = '0' }
        wantText = 'Не помогло'; wantCalls = 'CALLS probe,restart'; wantOk = $false; wantCode = 0; forbidText = 'поднимаю её'
    },
    @{
        name = 'бокс не ответил — состояние неизвестно'
        env = @{ STUB_STATE_STATUS = 'timeout'; STUB_UNIT_ACTIVE = 'active'; STUB_BOX_HTTP = '000'; STUB_ACTION_HTTP = '000'; STUB_TUNNEL_BEFORE = '0'; STUB_TUNNEL_AFTER = '0' }
        wantText = 'не ответил за отведённое время'; wantCalls = 'CALLS probe'; wantOk = $false; wantCode = 0; forbidText = 'поднимаю её'
    }
)

$decisionOk = $true
foreach ($scenario in $scenarios) {
    Write-Host ''
    Write-Host ("--- Тупик: " + $scenario.name + ' ---')
    $out = Invoke-DecisionScenario -HarnessPath $harnessPath -RepairText $repairFixed -Env $scenario.env
    $resOk = ($out -match 'RESULT ok=True') -eq [bool]$scenario.wantOk
    $resCode = $out -match ('code=' + $scenario.wantCode + ' ')
    $resCalls = $out -match [regex]::Escape($scenario.wantCalls)
    $resText = $out -match [regex]::Escape($scenario.wantText)
    $resForbid = -not ($out -match [regex]::Escape($scenario.forbidText))
    $pass = $resOk -and $resCode -and $resCalls -and $resText -and $resForbid
    if (-not $pass) { $decisionOk = $false }
    $verdict = if ($pass) { 'ok' } else { 'ПРОВАЛ' }
    Write-Host "   ok=$resOk code=$resCode calls=$resCalls текст=$resText без_чужих_слов=$resForbid → $verdict"
    Write-Lines $out
}

Write-Host ''
Write-Host '--- Тупик, красное: историческая логика («любой тупик = поднимаю», туннель руками) — на том же сценарии ---'
$redOut = Invoke-DecisionScenario -HarnessPath $harnessPath -RepairText $repairBuggy -Env $scenarios[1].env
Write-Lines $redOut
$tunnelRed = ($redOut -match 'RESULT ok=False') -and ($redOut -match 'CALLS probe,start') -and ($redOut -match 'поднимаю её') -and -not ($redOut -match 'пересоздаю туннель')
if ($tunnelRed) {
    Write-Host '   красное воспроизвелось: туннель не пересоздан, служба «поднята» впустую, владельцу сдача'
} else {
    Write-Host '   красное НЕ воспроизвелось — инъекция не сработала, тест ничего не доказывает'
    $decisionOk = $false
}

# --- Часть 3 (18.10.2026, письмо Мозга «Формат пульта»): выбор сервера.
#
# Мозг предложил одно расширение — ключ `-Server <алиас>` читает `servers\<алиас>.conf` рядом
# со скриптом как базу настроек. Форма принята, но с одним отличием: если фрагмента нет,
# запускатель ОСТАНАВЛИВАЕТСЯ и перечисляет, что лежит рядом. Иначе опечатка в имени
# (`alpha` вместо `alphа`) молча уводила бы владельца на другой бокс — а именно это и означает
# исходная формулировка «файла нет — сегодняшнее поведение и умолчания».
#
# Проверяем офлайново: файлы фрагментов настоящие (временная папка), ssh не нужен вообще —
# спрашиваем только разбор настроек (`Resolve-OcSettings`), который теперь отдельной функцией.
# Красное — инъекция исходной формы: убираем защиту, и тот же сценарий «фрагмента нет»
# становится зелёным по виду и неправильным по сути (подключение к чужому серверу по умолчанию).
function Get-OcFunctionText {
    param([string]$Path, [string]$Name)
    $lines = @(Get-Content -LiteralPath $Path)
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match ('^function ' + [regex]::Escape($Name) + ' \{')) { $start = $i; break }
    }
    if ($start -lt 0) { return $null }
    for ($j = $start + 1; $j -lt $lines.Count; $j++) {
        if ($lines[$j] -eq '}') { return ($lines[$start..$j] -join "`r`n") }
    }
    return $null
}

$settingsHarnessHead = @'
$ErrorActionPreference = 'Stop'
'@
$settingsHarnessTail = @'
$r = Resolve-OcSettings -ConfigPath $env:OC_CONF -ServerName $env:OC_SERVER -ServerDir $env:OC_SERVERDIR -SshTarget $env:OC_TARGET -IdentityFile $env:OC_IDENTITY -LocalPort ([int]$env:OC_LP) -RemotePort ([int]$env:OC_RP) -DefaultTarget 'GONBA' -DefaultLocalPort 14974 -DefaultRemotePort 49374 -AllowMissing:([bool]::Parse($env:OC_ALLOW))
Write-Output ('RESULT ok=' + $r.ok + ' target=' + $r.target + ' identity=' + $r.identity + ' local=' + $r.localPort + ' remote=' + $r.remotePort + ' conf=' + $r.confPath + ' available=' + ($r.available -join '|'))
'@

$settingsText = ''
foreach ($fn in @('Read-OcConfig', 'Resolve-OcPath', 'Get-OcServerFragments', 'Resolve-OcSettings')) {
    $text = Get-OcFunctionText -Path $source -Name $fn
    if (-not $text) {
        Write-Host "!!! разбор настроек не собрался: в opencode-web.ps1 нет функции $fn — поправь тест"
        exit 9
    }
    $settingsText = $settingsText + $text + "`r`n"
}

$guardNeedle = 'if (-not (Test-Path -LiteralPath $fragment) -and -not $AllowMissing) {'
$guardCount = ([regex]::Matches($settingsText, [regex]::Escape($guardNeedle))).Count
if ($guardCount -ne 1) {
    Write-Host "!!! защита от подмены сервера не нашлась ($guardCount раз) — структура Resolve-OcSettings изменилась, поправь тест"
    exit 9
}
$settingsRedText = $settingsText.Replace($guardNeedle, 'if ($false) {')
if ($settingsRedText -eq $settingsText) {
    Write-Host '!!! инъекция исходной формы не применилась — тест ничего не доказывает'
    exit 9
}

$settingsHarnessPath = Join-Path $tmp 'settings-harness.ps1'
$settingsHarnessRedPath = Join-Path $tmp 'settings-harness-red.ps1'
Set-Content -LiteralPath $settingsHarnessPath -Value ($settingsHarnessHead + "`r`n" + $settingsText + "`r`n" + $settingsHarnessTail) -Encoding UTF8
Set-Content -LiteralPath $settingsHarnessRedPath -Value ($settingsHarnessHead + "`r`n" + $settingsRedText + "`r`n" + $settingsHarnessTail) -Encoding UTF8

function Invoke-SettingsScenario {
    param([string]$HarnessPath, [hashtable]$Scenario, [int]$Index)
    $dir = Join-Path $tmp ('settings_' + $Index)
    [void](New-Item -ItemType Directory -Path $dir -Force)
    $serverDir = Join-Path $dir 'servers'
    if ($Scenario.fragments) {
        [void](New-Item -ItemType Directory -Path $serverDir -Force)
        foreach ($name in $Scenario.fragments.Keys) {
            Set-Content -LiteralPath (Join-Path $serverDir ($name + '.conf')) -Value $Scenario.fragments[$name] -Encoding UTF8
        }
    }
    $confPath = Join-Path $dir 'opencode-web.conf'
    if ($Scenario.conf) { Set-Content -LiteralPath $confPath -Value $Scenario.conf -Encoding UTF8 }
    Set-Item -Path 'Env:OC_CONF' -Value $confPath
    Set-Item -Path 'Env:OC_SERVERDIR' -Value $serverDir
    Set-Item -Path 'Env:OC_SERVER' -Value $Scenario.server
    Set-Item -Path 'Env:OC_TARGET' -Value $Scenario.target
    Set-Item -Path 'Env:OC_IDENTITY' -Value $Scenario.identity
    Set-Item -Path 'Env:OC_LP' -Value ([string]$Scenario.localPort)
    Set-Item -Path 'Env:OC_RP' -Value ([string]$Scenario.remotePort)
    Set-Item -Path 'Env:OC_ALLOW' -Value ([string]$Scenario.allow)
    $cliArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $HarnessPath)
    $out = (& powershell @cliArgs 2>&1 | Out-String)
    return [string]$out
}

$confBase = @('SSH_TARGET=GONBA', 'LOCAL_PORT=14974', 'REMOTE_PORT=49374')
$fragmentAlpha = @('SSH_TARGET=alpha-box', 'IDENTITY_FILE=~/.ssh/alpha_key', 'LOCAL_PORT=14001', 'REMOTE_PORT=49001')
$settingsScenarios = @(
    @{
        name = 'фрагмент есть — настройки берутся из фрагмента, а не из общего файла'
        conf = $confBase; fragments = @{ 'alpha' = $fragmentAlpha }
        server = 'alpha'; target = ''; identity = ''; localPort = 0; remotePort = 0; allow = $false
        want = @('ok=True', 'target=alpha-box', 'local=14001', 'remote=49001', 'servers\alpha.conf')
        forbid = @('local=14974', 'identity=~/')
    },
    @{
        name = 'фрагмента нет — остановка с перечнем того, что есть (никакой подмены)'
        conf = $confBase; fragments = @{ 'beta' = $confBase; 'gamma' = $confBase }
        server = 'alpha'; target = ''; identity = ''; localPort = 0; remotePort = 0; allow = $false
        want = @('ok=False', 'available=beta|gamma', 'servers\alpha.conf')
        forbid = @('ok=True', 'target=GONBA')
    },
    @{
        name = 'без -Server — прежнее поведение (общий файл и умолчания)'
        conf = $confBase; fragments = @{ 'alpha' = $fragmentAlpha }
        server = ''; target = ''; identity = ''; localPort = 0; remotePort = 0; allow = $false
        want = @('ok=True', 'target=GONBA', 'local=14974', 'opencode-web.conf')
        forbid = @('target=alpha-box')
    },
    @{
        name = 'параметры командной строки старше фрагмента'
        conf = $confBase; fragments = @{ 'alpha' = $fragmentAlpha }
        server = 'alpha'; target = 'cli-box'; identity = 'C:/keys/cli.key'; localPort = 15999; remotePort = 0; allow = $false
        want = @('ok=True', 'target=cli-box', 'local=15999', 'remote=49001', 'identity=C:/keys/cli.key')
        forbid = @('target=alpha-box')
    },
    @{
        name = '-Server вместе с -Setup: фрагмент ещё не заведён, но путь уже его'
        conf = $confBase; fragments = $null
        server = 'alpha'; target = ''; identity = ''; localPort = 0; remotePort = 0; allow = $true
        want = @('ok=True', 'servers\alpha.conf', 'target=GONBA')
        forbid = @('ok=False')
    }
)

$settingsOk = $true
$settingsIndex = 0
foreach ($scenario in $settingsScenarios) {
    $settingsIndex++
    Write-Host ''
    Write-Host ("--- Сервер: " + $scenario.name + ' ---')
    $out = Invoke-SettingsScenario -HarnessPath $settingsHarnessPath -Scenario $scenario -Index $settingsIndex
    $checks = @()
    $pass = $true
    foreach ($want in $scenario.want) {
        $hit = $out -match [regex]::Escape($want)
        if (-not $hit) { $pass = $false }
        $checks += ("есть '$want'=" + $hit)
    }
    foreach ($bad in $scenario.forbid) {
        $hit = $out -match [regex]::Escape($bad)
        if ($hit) { $pass = $false }
        $checks += ("нет '$bad'=" + (-not $hit))
    }
    if (-not $pass) { $settingsOk = $false }
    $verdict = if ($pass) { 'ok' } else { 'ПРОВАЛ' }
    Write-Host ("   " + ($checks -join ' ') + " → $verdict")
    Write-Lines $out
}

Write-Host ''
Write-Host '--- Сервер, красное: исходная форма («файла нет — сегодняшнее поведение и умолчания») ---'
$redScenario = $settingsScenarios[1]
$settingsRedOut = Invoke-SettingsScenario -HarnessPath $settingsHarnessRedPath -Scenario $redScenario -Index 99
Write-Lines $settingsRedOut
$settingsRed = ($settingsRedOut -match 'ok=True') -and ($settingsRedOut -match 'target=GONBA') -and -not ($settingsRedOut -match 'ok=False')
if ($settingsRed) {
    Write-Host '   красное воспроизвелось: фрагмента нет, а запускатель молча пошёл бы на сервер по умолчанию'
} else {
    Write-Host '   красное НЕ воспроизвелось — инъекция не сработала, тест ничего не доказывает'
    $settingsOk = $false
}

Write-Host ''
if ($redOk -and $greenOk -and -not $e2eFail -and $decisionOk -and $tunnelRed -and $settingsOk -and $settingsRed) {
    Write-Host "РЕГРЕССИЯ ПРОЙДЕНА: красное ($($red.code)) -> зелёное ($($green.code)); тупик: $($scenarios.Count) сценариев + красное; сервер: $($settingsScenarios.Count) сценариев + красное; e2e: $e2eState."
    exit 0
}
Write-Host "РЕГРЕССИЯ НЕ ПРОЙДЕНА: red=$redOk green=$greenOk decision=$decisionOk redTunnel=$tunnelRed settings=$settingsOk redSettings=$settingsRed e2e=$e2eState"
exit 1
