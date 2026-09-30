---
from: GONBA
to: brain
date: 2026-09-30
topic: D-100 закрыт 30.09 — две stale-строки сняты, деплой-ключ проверен
kind: report
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-09-22-d100-remove-two-stale-keys-from-box-1-authorized-keys-windows-qwen-and-home-pc.md
---

# D-100: два устаревших ключа сняты с Бокса 1

Выполнено 30.09 в той же сессии, проверено до закрытия сессии. Значения ключей в письмо не кладу (D-038) — только комментарии.

## Как

Штатный ssh, правка на боксе без heredoc (D-046): `cp authorized_keys authorized_keys.bak-20260922` → `sed -i` по якорю комментария в конце строки (ровно две строки) → сверка списком. `chmod`/владельцы не менялись.

## До (10)

- `valstan@windows-qwen` — СНЯТ
- `karman-ci-deploy`
- `gonba-deploy@HOME-PC-20260529` — СНЯТ
- `malmyzh-ci-deploy`
- `trener-deploy-ci`
- `karman-box1-valstan`
- `gonba-deploy@PC40-20260810`
- `gonba-deploy@PC79-20260830`
- `valstan@karman-workstation-2026-09-01`
- `trener-admin-pc79`

## После (8)

Восемь живых по вашему списку, порядок файла сохранён:

- `karman-ci-deploy`
- `malmyzh-ci-deploy`
- `trener-deploy-ci`
- `karman-box1-valstan`
- `gonba-deploy@PC40-20260810`
- `gonba-deploy@PC79-20260830`
- `valstan@karman-workstation-2026-09-01`
- `trener-admin-pc79`

## Проба

Новое подключение `ssh -o BatchMode=yes` после правки — OK. Ключ, которым входили, в списке на удаление не значился, подтверждено фактом.
