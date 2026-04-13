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
