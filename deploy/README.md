# GONBA Deployment Notes

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `PAYLOAD_SECRET` - random string for Payload auth

Optional:
- `CRON_SECRET` - for scheduled jobs
- `YANDEX_DISK_TOKEN` - OAuth token for Yandex.Disk
- `NEXT_PUBLIC_SERVER_URL` - public base URL
- `PAYLOAD_PUBLIC_SERVER_URL` - public base URL for Payload
- `PORT` - Next.js port (default 3000)

## Local Docker

```bash
cd /home/valstan/GONBA/web
cp .env.example .env
# edit DATABASE_URL and PAYLOAD_SECRET

docker compose up
```

## Systemd (Production)

1) Build the app:

```bash
cd /home/valstan/GONBA/web
npm install
npm run build
```

2) Install service file:

```bash
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gonba-web
```

3) Logs:

```bash
journalctl -u gonba-web -f
```

## VK Auto-Sync (systemd timer)

Каждые 3 часа дёргает `POST /api/vk-auto-sync/trigger`, который запускает синхронизацию всех активных источников из коллекции `vk-auto-sync`.

Файлы:

- `deploy/systemd/gonba-vk-sync.service` — oneshot, делает curl на trigger-endpoint с `Authorization: Bearer $CRON_SECRET`.
- `deploy/systemd/gonba-vk-sync.timer` — `OnCalendar=*-*-* 00/3:00:00`, `Persistent=true`, RandomizedDelaySec=5min.

Установка:

```bash
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-vk-sync.service /etc/systemd/system/
sudo cp /home/valstan/GONBA/deploy/systemd/gonba-vk-sync.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gonba-vk-sync.timer
```

Проверка:

```bash
systemctl list-timers gonba-vk-sync.timer
journalctl -u gonba-vk-sync -n 50 --no-pager
sudo systemctl start gonba-vk-sync.service   # ручной запуск разово
```

Требования:

- В `/home/valstan/GONBA/web/.env` должен быть установлен `CRON_SECRET`.
- Приложение должно быть доступно на `http://127.0.0.1:3000` (по умолчанию).

## Swap и устойчивость сборки/тестов

Если в этой среде `npm run build` падает по памяти (`Killed`, код 137), включите постоянный swap перед следующими шагами:

```bash
sudo swapoff /swapfile
sudo rm -f /swapfile
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
printf 'vm.swappiness = 10\n' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
```

Проверьте итог:

```bash
free -h
swapon --show
cat /proc/sys/vm/swappiness
```

Для e2e уже поднят лимит памяти в скриптах:

- `build:raw` — `--max-old-space-size=6144`
- `start` — `--max-old-space-size=4096`
- `test:e2e` — `--max-old-space-size=3072`
- `playwright.config.ts` (`webServer`) — timeout `300000` мс и `--max-old-space-size=3072`

Важно:

- Домен для `NEXT_PUBLIC_SERVER_URL` и `PAYLOAD_PUBLIC_SERVER_URL` берётся из
  `/home/valstan/GONBA/web/.env` (в unit-файле больше не хардкодится).
- После подключения домена проверьте TLS на уровне reverse-proxy/веб-сервера:
  - `openssl s_client -connect xn--80abf4be9f.xn--p1ai:443 -servername xn--80abf4be9f.xn--p1ai`
  - `curl -fsS https://xn--80abf4be9f.xn--p1ai/api/health`
