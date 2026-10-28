#!/bin/bash
# Обновление подписки NextGenVPN на боксе и пересборка servers.json.
#
# Ссылка подписки — секрет: живёт ТОЛЬКО в /etc/neural/vpn/subscription.url (600 root),
# в репозиторий и письма не попадает. Запуск — от root.
#
# Источник истины рецепта — brain_matrica/docs/plans/neural-selfhost.md;
# эта копия лежит в репо, чтобы деплой ставил её на бокс, а не «руки».
set -eu
URLFILE=/etc/neural/vpn/subscription.url
RAW=/etc/neural/vpn/sub.raw
SERVERS=/etc/neural/vpn/servers.json
[ -r "$URLFILE" ] || { echo "нет $URLFILE (600 root): положи ссылку подписки" >&2; exit 1; }
url=$(tr -d '[:space:]' < "$URLFILE")
# UA как у клиента Happ: часть панелей отдаёт разное в зависимости от клиента.
code=$(curl -sS -L --max-time 30 -A 'Happ/2.9.0' -o "$RAW.tmp" -w '%{http_code}' "$url")
if [ "$code" != "200" ]; then
  rm -f "$RAW.tmp"
  echo "подписка: http $code" >&2
  exit 1
fi
mv "$RAW.tmp" "$RAW"
chmod 600 "$RAW"

python3 - <<'PY'
import base64, json, os
from urllib.parse import urlparse, parse_qs, unquote
raw = open('/etc/neural/vpn/sub.raw', 'rb').read()
txt = raw.decode('utf-8', 'replace').strip()
if '://' not in txt:
    txt = base64.b64decode(txt + '=' * (-len(txt) % 4)).decode('utf-8', 'replace')
servers = []
for i, line in enumerate(l.strip() for l in txt.splitlines() if '://' in l):
    p = urlparse(line)
    q = parse_qs(p.query)
    def one(key, default=''):
        v = q.get(key)
        return unquote(v[0]) if v else default
    servers.append({
        'i': i, 'proto': p.scheme, 'uuid': unquote(p.username or ''),
        'host': p.hostname, 'port': p.port,
        'name': unquote(p.fragment) if p.fragment else f'server-{i+1}',
        'security': one('security').lower(),
        'network': (one('type', 'tcp') or 'tcp').lower(),
        'flow': one('flow'), 'sni': one('sni', one('host')),
        'fp': one('fp'), 'pbk': one('pbk'), 'sid': one('sid'),
        'path': one('path'), 'ws_host': one('host'), 'alpn': one('alpn'),
    })
json.dump(servers, open('/etc/neural/vpn/servers.json', 'w'),
          ensure_ascii=False, indent=1)
os.chmod('/etc/neural/vpn/servers.json', 0o600)
print(f"servers={len(servers)}")
for s in servers:
    print(f"{s['i']:2d} | {s['name'][:34]:34s} | {s['host']}:{s['port']} | {s['security']}/{s['network']}")
PY
