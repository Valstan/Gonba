#!/usr/bin/env bash
# Запускатель веб-UI OpenCode на прод-боксе GONBA (Linux/macOS/Git Bash): SSH-туннель + браузер.
#
# Что делает: поднимает `ssh -N -L <локальный порт>:127.0.0.1:<порт на боксе> <цель>`, забирает
# у бокса одноразовую ссылку входа (код живёт 5 минут) и открывает её в браузере ЭТОГО компьютера.
# Пароль сервера нигде не печатается и на этом компьютере не хранится.
#
# Запуск:
#   ./opencode-web.sh                 # подключиться
#   ./opencode-web.sh --setup         # настроить этот компьютер
#   ./opencode-web.sh --check         # проверить, всё ли на месте
#   ./opencode-web.sh --no-open       # не открывать браузер
#   ./opencode-web.sh --no-wait       # не ждать Enter (туннель закрывается при выходе)
#
# Настройки компьютера лежат рядом со скриптом, в `opencode-web.conf`
# (шаблон — `opencode-web.conf.example`). Файла нет — работают умолчания.
# Скрипт переносимый: ни адреса, ни пользователя внутри нет.
#
# Грабля клиента: OpenSSH для Windows (в т.ч. из Git Bash) не завершает процесс, если его
# std-хендлы перенаправлены, хотя команда на боксе уже отработала. Поэтому здесь НЕ полагаемся на
# выход процесса: ждём в файле маркер `OC_DONE:<код>` и добиваем ssh, чтобы не оставлять зомби.

set -u

DEFAULT_TARGET='GONBA'
DEFAULT_LOCAL_PORT=14974
DEFAULT_REMOTE_PORT=49374
REMOTE_UNIT='opencode-web'
PAIR_HELPER='opencode-pair-link'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="$SCRIPT_DIR/opencode-web.conf"

TARGET="$DEFAULT_TARGET"
IDENTITY=''
LOCAL_PORT="$DEFAULT_LOCAL_PORT"
REMOTE_PORT="$DEFAULT_REMOTE_PORT"
DO_OPEN=1
DO_WAIT=1
DO_CHECK=0
DO_SETUP=0

usage() {
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
    case "$1" in
        --target)      TARGET="${2:-}"; shift 2 ;;
        --identity)    IDENTITY="${2:-}"; shift 2 ;;
        --local-port)  LOCAL_PORT="${2:-}"; shift 2 ;;
        --remote-port) REMOTE_PORT="${2:-}"; shift 2 ;;
        --config)      CONF="${2:-}"; shift 2 ;;
        --setup)       DO_SETUP=1; shift ;;
        --check)       DO_CHECK=1; shift ;;
        --no-open)     DO_OPEN=0; shift ;;
        --no-wait)     DO_WAIT=0; shift ;;
        -h|--help)     usage; exit 0 ;;
        *) echo "Неизвестный параметр: $1 (см. --help)"; exit 2 ;;
    esac
done

# ---------------------------------------------------------------- файл настроек

load_conf() {
    [ -f "$CONF" ] || return 0
    # BOM (если файл сохранён Windows-редактором) и CR не должны попасть в значения
    local text line key value
    text="$(sed '1s/^\xEF\xBB\xBF//' "$CONF" | tr -d '\r')"
    while IFS= read -r line; do
        case "$line" in ''|'#'*) continue ;; esac
        case "$line" in *=*) ;; *) continue ;; esac
        key="$(printf '%s' "${line%%=*}" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
        value="${line#*=}"
        value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')"
        case "$key" in
            SSH_TARGET)    [ -n "$value" ] && TARGET="$value" ;;
            IDENTITY_FILE) [ -n "$value" ] && IDENTITY="$value" ;;
            LOCAL_PORT)    [ -n "$value" ] && LOCAL_PORT="$value" ;;
            REMOTE_PORT)   [ -n "$value" ] && REMOTE_PORT="$value" ;;
        esac
    done <<< "$text"
}

save_conf() {
    {
        echo '# Настройки запускателя OpenCode Web на ЭТОМ компьютере.'
        echo '# Правится вручную или через `opencode-web.sh --setup`.'
        echo ''
        echo '# Куда идти по SSH: алиас из ~/.ssh/config этого компьютера либо user@host.'
        echo "SSH_TARGET=$TARGET"
        echo ''
        echo '# Приватный ключ (пусто — ключи по умолчанию / ssh-agent).'
        echo "IDENTITY_FILE=$IDENTITY"
        echo ''
        echo '# Локальный порт туннеля на этом компьютере (должен быть свободен).'
        echo "LOCAL_PORT=$LOCAL_PORT"
        echo ''
        echo '# Порт, на котором сервер OpenCode слушает на боксе. Менять не нужно.'
        echo "REMOTE_PORT=$REMOTE_PORT"
    } > "$CONF"
}

expand_tilde() {
    case "$1" in
        '~')   printf '%s' "$HOME" ;;
        '~/'*) printf '%s' "$HOME/${1#\~/}" ;;
        *)     printf '%s' "$1" ;;
    esac
}

port_open() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

open_url() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$1" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "$1" >/dev/null 2>&1 &
    elif command -v cmd.exe >/dev/null 2>&1; then
        cmd.exe /c start "" "$1" >/dev/null 2>&1 &
    else
        echo "Открой ссылку в браузере вручную: $1"
    fi
}

key_recipe() {
    local key="$HOME/.ssh/id_ed25519_opencode"
    echo ''
    echo 'Бокс пускает только по SSH-ключу (пароли выключены), и этот компьютер пока не пущен.'
    echo 'Что сделать один раз:'
    echo ''
    echo '  1) создать ключ здесь:'
    echo "       ssh-keygen -t ed25519 -f \"$key\" -C \"opencode-web@$(hostname)\""
    echo '     (на вопрос о парольной фразе можно нажать Enter — тогда вход будет без пароля)'
    echo ''
    echo '  2) посмотреть публичную часть — её и добавляем, приватную никому не отправлять:'
    echo "       cat \"$key.pub\""
    echo ''
    echo '  3) добавить эту строку на бокс — с любой машины, где доступ уже есть:'
    echo "       cat \"$key.pub\" | ssh $TARGET \"tr -d '\\r' | cat >> ~/.ssh/authorized_keys\""
    echo '     (или владелец вставит строку в ~/.ssh/authorized_keys бокса вручную)'
    echo ''
    echo '  4) прописать этот ключ здесь:'
    echo "       $(basename "${BASH_SOURCE[0]}") --setup     → IDENTITY_FILE = $key"
    echo ''
    echo "Настройки лежат в: $CONF"
}

show_ssh_problem() {
    local text="$1"
    echo ''
    case "$text" in
        *"Could not resolve hostname"*|*"Name or service not known"*|*"nodename nor servname"*)
            echo "Хост «$TARGET» не разрешается: на этом компьютере нет такой записи в ~/.ssh/config."
            echo 'Добавь запись (адрес бокса и имя ключа владелец даёт отдельно):'
            echo ''
            echo "    Host $TARGET"
            echo '        HostName <адрес бокса>'
            echo '        User <пользователь>'
            echo '        IdentityFile ~/.ssh/<имя ключа>'
            echo ''
            echo 'Либо просто укажи цель явно: --setup → SSH_TARGET = user@адрес'
            ;;
        *"Permission denied"*|*"no supported authentication methods"*|*"Could not load key"*)
            key_recipe
            [ -n "$IDENTITY" ] && echo "Сейчас в настройках указан ключ: $IDENTITY — проверь, что он существует и добавлен на бокс."
            echo 'Если у ключа есть парольная фраза — запусти ssh-agent и добавь ключ: ssh-add <путь к ключу>.'
            ;;
        *"timed out"*|*"No route to host"*|*"Connection refused"*|*"Network is unreachable"*)
            echo 'Сеть: бокс не ответил. Проверь интернет и что SSH-порт бокса доступен с этой сети.'
            ;;
        *)
            echo 'SSH не отработал. Ответ:'
            echo "$text"
            ;;
    esac
    echo ''
}

# Отдаём команду на бокс и ждём в выводе маркер `OC_DONE:<код>` (его печатает сама команда).
# Процесс не ждём до конца: см. граблю клиента в шапке файла. Вывод кладём в SSH_OUT/SSH_ERR,
# код возврата — код удалённой команды (или код ssh, если маркера не было).
ssh_run() {
    local command="$1" out_file err_file pid waited code
    out_file="$(mktemp)"; err_file="$(mktemp)"
    ssh -n "${SSH_COMMON[@]}" "${IDENTITY_ARGS[@]+"${IDENTITY_ARGS[@]}"}" "$TARGET" "$command" \
        >"$out_file" 2>"$err_file" </dev/null &
    pid=$!
    waited=0
    code=''
    while [ "$waited" -lt 600 ]; do
        if grep -q 'OC_DONE:[0-9]*' "$out_file" 2>/dev/null; then
            code="$(grep -o 'OC_DONE:[0-9]*' "$out_file" 2>/dev/null | head -1 | cut -d: -f2)"
            break
        fi
        if ! kill -0 "$pid" 2>/dev/null; then break; fi
        sleep 0.1
        waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    else
        wait "$pid" 2>/dev/null || true
    fi
    SSH_OUT="$(cat "$out_file" 2>/dev/null)"
    SSH_ERR="$(cat "$err_file" 2>/dev/null)"
    rm -f "$out_file" "$err_file"
    SSH_ERR="${SSH_ERR//$'\r'/}"
    SSH_ERR="$(printf '%s' "$SSH_ERR" | grep -v 'GetConsoleMode' || true)"
    if [ -n "$code" ]; then return "$code"; fi
    return 1
}

strip_marker() {
    printf '%s' "$1" | sed '/OC_DONE:/d' | sed 's/[[:space:]]*$//'
}

# ---------------------------------------------------------------- старт

[ -n "$IDENTITY" ] && IDENTITY="$(expand_tilde "$IDENTITY")"
load_conf
[ -n "$IDENTITY" ] && IDENTITY="$(expand_tilde "$IDENTITY")"

SSH_COMMON=(-o BatchMode=yes -o ConnectTimeout=8)
IDENTITY_ARGS=()
if [ -n "$IDENTITY" ]; then
    SSH_COMMON+=(-i "$IDENTITY")
    IDENTITY_ARGS=(-i "$IDENTITY")
fi

if [ "$DO_SETUP" = 1 ]; then
    echo ''
    echo 'Настройка этого компьютера. Enter — оставить значение в скобках.'
    echo ''
    read -r -p "SSH-цель (алиас из ~/.ssh/config или user@host) [$TARGET] " answer
    [ -n "$answer" ] && TARGET="$answer"
    read -r -p "Приватный ключ (пусто — ключи по умолчанию) [$IDENTITY] " answer
    [ -n "$answer" ] && IDENTITY="$answer"
    read -r -p "Локальный порт туннеля [$LOCAL_PORT] " answer
    case "$answer" in ''|*[!0-9]*) ;; *) LOCAL_PORT="$answer" ;; esac
    read -r -p "Порт сервера на боксе [$REMOTE_PORT] " answer
    case "$answer" in ''|*[!0-9]*) ;; *) REMOTE_PORT="$answer" ;; esac
    save_conf
    echo ''
    echo "Записано: $CONF"
    SSH_COMMON=(-o BatchMode=yes -o ConnectTimeout=8)
    IDENTITY_ARGS=()
    if [ -n "$IDENTITY" ]; then
        SSH_COMMON+=(-i "$IDENTITY")
        IDENTITY_ARGS=(-i "$IDENTITY")
    fi
fi

if [ "$DO_CHECK" = 1 ]; then
    failed=0
    echo ''
    echo 'Проверка этого компьютера и бокса'
    echo ''
    if [ -f "$CONF" ]; then echo "  настройки: $CONF"; else echo "  настройки: файла нет ($CONF) — работают умолчания"; fi
    echo "  ssh-цель:  $TARGET"
    echo "  порты:     локальный $LOCAL_PORT → на боксе $REMOTE_PORT"
    if [ -n "$IDENTITY" ]; then echo "  ключ:      $IDENTITY"; else echo '  ключ:      по умолчанию / ssh-agent'; fi
    echo ''
    if [ -n "$IDENTITY" ] && [ ! -f "$IDENTITY" ]; then
        echo "  [!!] файла ключа нет: $IDENTITY"
        failed=1
    fi
    ssh_run 'true; echo "OC_DONE:$?"'
    probe_code=$?
    if [ "$probe_code" = 0 ]; then
        echo '   ssh:       ok'
    else
        echo "   ssh:       НЕ РАБОТАЕТ (код $probe_code)"
        show_ssh_problem "$SSH_ERR"
        exit 1
    fi
    ssh_run "systemctl is-active $REMOTE_UNIT; echo \"OC_DONE:\$?\""
    unit="$(strip_marker "$SSH_OUT")"
    if [ "$unit" = 'active' ]; then
        echo "   сервис:    $REMOTE_UNIT — active"
    else
        echo "  [!!] сервис $REMOTE_UNIT на боксе: $unit"
        echo "       Поднять: ssh $TARGET \"sudo systemctl start $REMOTE_UNIT\""
        failed=1
    fi
    ssh_run "ss -ltn 2>/dev/null | grep -c '127.0.0.1:$REMOTE_PORT'; echo \"OC_DONE:\$?\""
    listen="$(strip_marker "$SSH_OUT" | tr -d '[:space:]')"
    case "$listen" in
        0|'') echo "  [!!] на боксе не видно слушателя 127.0.0.1:$REMOTE_PORT"; failed=1 ;;
        *)    echo "   слушает:   127.0.0.1:$REMOTE_PORT на боксе — да" ;;
    esac
    ssh_run 'opencode --version; echo "OC_DONE:$?"'
    echo "   opencode:  $(strip_marker "$SSH_OUT")"
    if port_open "$LOCAL_PORT"; then
        echo "   локально:  порт $LOCAL_PORT уже занят — вероятно, туннель поднят; запуск переиспользует его"
    else
        echo "   локально:  порт $LOCAL_PORT свободен"
    fi
    echo ''
    if [ "$failed" = 0 ]; then echo 'Итог: всё на месте, можно запускать без параметров.'; else echo 'Итог: есть замечания (см. [!!] выше).'; fi
    exit "$failed"
fi

echo "Веб-UI OpenCode: 127.0.0.1:$LOCAL_PORT → $TARGET (127.0.0.1:$REMOTE_PORT)"

ssh_run 'true; echo "OC_DONE:$?"'
probe_code=$?
if [ "$probe_code" != 0 ]; then
    show_ssh_problem "$SSH_ERR"
    echo 'Если это новая машина — прогони: --setup (подскажет, как завести ключ).'
    exit 1
fi

tunnel_pid=''
cleanup() {
    if [ -n "$tunnel_pid" ] && kill -0 "$tunnel_pid" 2>/dev/null; then
        kill "$tunnel_pid" 2>/dev/null || true
    fi
}

reused=0
if port_open "$LOCAL_PORT"; then
    echo "Туннель уже поднят на 127.0.0.1:$LOCAL_PORT — переиспользую его."
    reused=1
else
    ssh -n -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
        "${IDENTITY_ARGS[@]+"${IDENTITY_ARGS[@]}"}" -L "$LOCAL_PORT:127.0.0.1:$REMOTE_PORT" "$TARGET" &
    tunnel_pid=$!
    trap cleanup EXIT INT TERM
    i=0
    while [ "$i" -lt 60 ]; do
        sleep 0.25
        if port_open "$LOCAL_PORT"; then break; fi
        if ! kill -0 "$tunnel_pid" 2>/dev/null; then break; fi
        i=$((i + 1))
    done
    if ! port_open "$LOCAL_PORT"; then
        echo ''
        echo "Туннель не поднялся (127.0.0.1:$LOCAL_PORT)."
        if ! kill -0 "$tunnel_pid" 2>/dev/null; then
            echo 'ssh завершился — подробности выше.'
        fi
        echo "Частая причина: локальный порт занят. Запусти с другим портом: --local-port $((LOCAL_PORT + 1000))"
        exit 1
    fi
fi

ssh_run "$PAIR_HELPER $REMOTE_PORT $LOCAL_PORT; echo \"OC_DONE:\$?\""
link="$(printf '%s' "$SSH_OUT" | grep -o 'http://[^[:space:]]*' | head -1)"

if [ -n "$link" ]; then
    echo ''
    echo 'Ссылка входа (живёт 5 минут; сессия в браузере ≈30 дней, пароль не печатается):'
    echo "  $link"
    [ "$DO_OPEN" = 1 ] && open_url "$link"
    echo ''
    echo "Дальше тот же адрес: http://127.0.0.1:$LOCAL_PORT/ (пока браузер помнит сессию, ссылка не нужна)."
else
    echo ''
    echo 'Не удалось получить ссылку входа. Ответ бокса:'
    echo "$(strip_marker "$SSH_OUT")"
    [ -n "$SSH_ERR" ] && echo "$SSH_ERR"
    exit 1
fi

if [ "$reused" = 0 ] && [ "$DO_WAIT" = 1 ]; then
    echo ''
    echo 'Туннель работает, пока открыто это окно. Enter — закрыть туннель.'
    read -r _ || true
    echo 'Туннель закрыт.'
fi
