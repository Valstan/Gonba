#!/bin/bash
# Смена сервера egress (NextGenVPN) — «следующий сервер подписки до рабочего выхода».
# Выход 0 только когда туннель ожил и фактический IP выхода отличается от прежнего.
#
# Отличия от эталона (brain_matrica/docs/plans/neural/10-nextgenvpn.sh):
#   1. добавлен HTTP-инбаунд 127.0.0.1:8118 — движок ходит через `HTTPS_PROXY`,
#      потому что nft-redirect по uid здесь неприменим: у нас движок и сайт
#      работают под ОДНИМ пользователем (valstan), и redirect увёл бы в туннель
#      весь прод-сайт. Держим изоляцию на уровне переменных окружения юнита;
#   2. убран dokodemo-door/12345 (прозрачный инбаунд) — при HTTPS_PROXY он не нужен.
set -eu
SERVERS=/etc/neural/vpn/servers.json
CLIENT=/etc/neural/vpn/client.json
STATE_DIR=/var/lib/neural/vpn
STATE=$STATE_DIR/current.json
SOCKS=127.0.0.1:10808
HTTP_PROXY_URL=http://127.0.0.1:8118
mkdir -p "$STATE_DIR"

prev_ip=""
prev_i=-1
if [ -f "$STATE" ]; then
  prev_ip=$(python3 -c "import json;d=json.load(open('$STATE'));print(d.get('ip') or '')" 2>/dev/null || true)
  prev_i=$(python3 -c "import json;d=json.load(open('$STATE'));print(d.get('i',-1))" 2>/dev/null || echo -1)
fi

render() {
  python3 - "$1" <<'PY'
import json, sys
i = int(sys.argv[1])
s = json.load(open('/etc/neural/vpn/servers.json'))[i]
cfg = {
  "log": {"loglevel": "warning"},
  "inbounds": [
    {"tag": "socks", "listen": "127.0.0.1", "port": 10808,
     "protocol": "socks", "settings": {"udp": False}},
    # HTTP-прокси для движка: юнит opencode-web получает HTTPS_PROXY=http://127.0.0.1:8118
    {"tag": "http", "listen": "127.0.0.1", "port": 8118,
     "protocol": "http", "settings": {}}
  ],
  "outbounds": [
    {"tag": "proxy", "protocol": "vless",
     "settings": {"vnext": [{"address": s['host'], "port": s['port'],
       "users": [{"id": s['uuid'], "encryption": "none", "flow": s['flow']}]}]},
     "streamSettings": {"network": s['network'], "security": s['security'],
       "realitySettings": {"serverName": s['sni'], "fingerprint": s['fp'] or "chrome",
         "publicKey": s['pbk'], "shortId": s['sid'], "spiderX": "/"}}},
    {"tag": "direct", "protocol": "freedom"}
  ],
  "routing": {"rules": [
    {"type": "field", "outboundTag": "direct",
     "ip": ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12",
            "192.168.0.0/16", "169.254.0.0/16"]}
  ]}
}
json.dump(cfg, open('/etc/neural/vpn/client.json', 'w'), ensure_ascii=False, indent=1)
print(s['name'])
PY
  chown root:nogroup "$CLIENT"
  chmod 640 "$CLIENT"
}

n=$(python3 -c "import json;print(len(json.load(open('$SERVERS'))))")
tries=$n
i=$prev_i
while [ "$tries" -gt 0 ]; do
  i=$(( (i + 1) % n ))
  tries=$(( tries - 1 ))
  name=$(render "$i") || continue
  systemctl restart neural-vpn || continue
  up=""
  for _ in $(seq 1 20); do
    if (exec 3<>/dev/tcp/127.0.0.1/10808) 2>/dev/null; then up=1; break; fi
    sleep 0.5
  done
  [ -n "$up" ] || continue
  ip=$(curl -s --max-time 15 --socks5-hostname "$SOCKS" https://api.ipify.org || true)
  ip=$(printf '%s' "$ip" | tr -d '[:space:]')
  [ -n "$ip" ] || continue
  [ "$ip" != "$prev_ip" ] || continue
  country=$(curl -s --max-time 10 --socks5-hostname "$SOCKS" https://ipinfo.io/country || true)
  country=$(printf '%s' "$country" | tr -d '[:space:]' | cut -c1-2)
  # Проверяем не только socks, но и HTTP-инбаунд: именно им пользуется движок.
  http_ip=$(curl -s --max-time 15 -x "$HTTP_PROXY_URL" https://api.ipify.org || true)
  http_ip=$(printf '%s' "$http_ip" | tr -d '[:space:]')
  # Fail-closed: сервер считается рабочим только если HTTP-инбаунд (тот, которым
  # реально пользуется движок) отдал ТОТ ЖЕ выход. Иначе «socks жив, а движок
  # без egress» — ровно тот тихий прямой выход, который запрещает D-152.
  [ -n "$http_ip" ] && [ "$http_ip" = "$ip" ] || continue
  python3 - "$i" "$ip" "$country" "$name" "$http_ip" <<'PY'
import json, sys, time
i, ip, country, name, http_ip = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
json.dump({"i": i, "name": name, "ip": ip, "country": country,
           "http_ip": http_ip, "at": int(time.time())},
          open('/var/lib/neural/vpn/current.json', 'w'), ensure_ascii=False)
PY
  chmod 644 "$STATE"
  echo "egress: $name -> $ip ($country)"
  echo "движок (HTTPS_PROXY): $http_ip"
  exit 0
done
echo "egress: ни один сервер подписки не дал рабочий выход" >&2
exit 1
