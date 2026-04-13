# Release Stability Checklist

This checklist formalizes a safer rollout process for the `gonba` service.

## Pre-release

1. Update dependencies only if required for the release scope.
2. Ensure env variables are set in `web/.env` (or production env file), including:
   - `DATABASE_URL`
   - `PAYLOAD_SECRET`
   - `NEXT_PUBLIC_SERVER_URL`
   - `YANDEX_DISK_TOKEN` (if Yandex sync is used)
3. Run quality gates locally from `web/`:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:int`
   - `npm run build`
   - `npx playwright test tests/e2e/frontend.e2e.spec.ts --config=playwright.config.ts --project=chromium --reporter=line`

## Deploy

1. Install and build:
   - `npm install`
   - `npm run build`
2. Restart service:
   - `sudo systemctl restart gonba`
3. Check service status:
   - `sudo systemctl status gonba --no-pager`

## Post-deploy (first 15 minutes)

1. Watch logs:
   - `journalctl -u gonba -f`
2. Probe health endpoint:
   - `curl -fsS https://<your-domain>/api/health`
3. Smoke-check critical pages:
   - `/`
   - `/posts`
   - `/search`
   - `/admin`
4. If errors spike, rollback to previous known-good release.

## Rollback trigger examples

- Health endpoint returns non-2xx for more than 2 minutes.
- Repeated 5xx responses in application logs.
- Critical user flow is blocked (homepage, booking submit, admin login).
