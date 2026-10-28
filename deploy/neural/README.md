# Egress движка через ВПН (улей на прод-боксе)

Зачем: free-модели OpenCode квотируются **на сеть** (`сообщения за сутки на IP`), а не на аккаунт.
Пока улей ходил напрямую, он ел квоту сети прод-бокса (белый IP, за ним живёт сайт), а суммарную
частоту не видел никто. Слово владельца 22.10 ([D-152](../../../brain_matrica/docs/DECISIONS.md)) и
письмо Мозга `2026-10-22-hive-egress-via-vpn-or-stop-idle.md` (mandate): **трафик улья — через ВПН
или улей не держим включённым.** Здесь — серверная половина: свой ВПН-клиент и смена сервера.

Канон: `brain_matrica/docs/plans/neural-selfhost.md`. Эталоны скриптов —
`brain_matrica/docs/plans/neural/`. Копии в репозитории нужны, чтобы **деплой** ставил файлы на
бокс (файл, который никто не исполняет, — не источник правды).

## Схема

```text
opencode serve (127.0.0.1:49374)  ── HTTPS_PROXY ──> xray http-in 127.0.0.1:8118
                                                        │
                                                        ▼
                                             VLESS+REALITY — сервер подписки
                                                        │
                                                        ▼
                                                    выход ВПН
```

- HTTP-инбаунд `8118` — то, чем пользуется движок (Bun уважает `HTTPS_PROXY`, socks игнорирует).
- SOCKS-инбаунд `10808` остаётся для ручных замеров (`curl --socks5-hostname …`).
- **nft-redirect по uid здесь сознательно НЕ используется:** движок и сайт работают под одним
  пользователем `valstan`, и redirect увёл бы в туннель весь прод-сайт. Изоляция — на уровне
  переменных окружения юнита `opencode-web`.
- **Fail-closed:** упал xray — у движка нет выхода в модели (connexion refused), тихого прямого
  выхода не бывает. Это требование D-152, а не побочный эффект.

## Раскладка на боксе

| Что | Откуда | Куда |
|---|---|---|
| `refresh-subscription.sh` | репо `deploy/neural/` | `/usr/local/lib/neural/refresh-subscription.sh` |
| `10-nextgenvpn.sh` | репо `deploy/neural/` | `/etc/neural/egress.d/10-nextgenvpn.sh` |
| `neural-vpn.service` | репо `deploy/neural/` | `/etc/systemd/system/neural-vpn.service` |
| подписка (секрет) | вручную, каналом секретов | `/etc/neural/vpn/subscription.url` (600 root) |
| `servers.json`, `sub.raw` | генерит `refresh-subscription.sh` | `/etc/neural/vpn/` (600 root) |
| `client.json` | генерит `10-nextgenvpn.sh` | `/etc/neural/vpn/client.json` (640 root:nogroup) |
| состояние («где мы сейчас») | пишет `10-nextgenvpn.sh` | `/var/lib/neural/vpn/current.json` |

Скрипты и юнит ставит **деплой** (`.github/workflows/deploy-prod.yml`, идемпотентный `cmp`+`cp`).
Руками — только ссылка подписки, потому что она секрет и в git не идёт.

## Установка с нуля (новая машина)

```bash
sudo install -d -m 755 /usr/local/lib/neural /var/lib/neural/vpn
sudo install -d -m 750 /etc/neural/egress.d /etc/neural/vpn
sudo chown root:nogroup /etc/neural/vpn          # xray работает под nobody
sudo install -m 755 deploy/neural/refresh-subscription.sh /usr/local/lib/neural/
sudo install -m 755 deploy/neural/10-nextgenvpn.sh /etc/neural/egress.d/
sudo install -m 644 deploy/neural/neural-vpn.service /etc/systemd/system/
# бинарник xray (та же версия, что на эталоне)
sudo install -m 755 xray /usr/local/bin/xray
# секрет: только на боксе
printf '%s\n' '<ссылка подписки>' | sudo tee /etc/neural/vpn/subscription.url >/dev/null
sudo chmod 600 /etc/neural/vpn/subscription.url
sudo /usr/local/lib/neural/refresh-subscription.sh      # → servers=N и список
sudo /etc/neural/egress.d/10-nextgenvpn.sh              # первый рабочий выход + client.json
sudo systemctl daemon-reload && sudo systemctl start neural-vpn
```

`enable` намеренно **не** делаем: улей не должен занимать память и держать туннель, пока
владелец не нажал «Чат». `opencode-web` тянет ВПН за собой через `Wants=neural-vpn.service`,
а ярлык «Выключить улей» гасит оба.

Порядок важен: `10-nextgenvpn.sh` сам пишет `client.json`, без него юнит не стартует
(«permission denied»/«no such file» в журнале — это оно).

## Проверка

```bash
# socks-выход
curl -s --socks5-hostname 127.0.0.1:10808 https://api.ipify.org; echo
# HTTP-инбаунд (им ходит движок)
curl -s -x http://127.0.0.1:8118 https://api.ipify.org; echo
# и он не равен адресу бокса
curl -s --max-time 10 ifconfig.me; echo
# движок отвечает
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:49374/api/info   # 401 — норма (нужен пароль)
```

## Смена сервера (то, ради чего всё)

```bash
sudo /etc/neural/egress.d/10-nextgenvpn.sh
```

Печатает `egress: <страна@сервер> -> <ip> (<cc>)` и выход через HTTP-инбаунд. Движок **не
перезапускается** — сессии в веб-UI живут. Скрипт пробует серверы по кругу, от прежнего индекса,
пока не получит живой выход, отличный от предыдущего.

⚠️ Лимит free-моделей считается по IP и на **израсходованном** выходе остаётся: смена сервера
гарантирует свежий IP, но не гарантирует свежую квоту (замер 22.10: PL/DE/TR — везде `429`,
подписка массовая).

## Грабли

- **Каталог `/etc/neural/vpn` — `750 root:nogroup`**, файл `client.json` — `640 root:nogroup`.
  При `700 root:root` xray под `nobody` падает, а systemd пишет только «Scheduled restart job».
- **Не путать с `es-vps`**: там движок под `valstan` и включён nft-redirect. У нас один uid на
  движок и сайт, поэтому только `HTTPS_PROXY`.
- **`~/tmp/ocpkg` (исходники npm-пакета движка, ~310 МБ) удалять после установки** — диск бокса
  маленький (84 % на 28.10).
