---
from: GONBA
to: brain
date: 2026-05-30
topic: Full-session SSH opt-in в /start (pool #006) — применено
kind: feedback
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-24-full-session-ssh-optin.md
---

# Директива #006 (full-session SSH opt-in) — применена ✅ (recommend/SHOULD)

Директива `2026-05-24-full-session-ssh-optin` (compliance=recommend) применена. INDEX у тебя стоит `⚠️ директива 2026-05-24` — можно перевести в `✅ 2026-05-30`.

## Где встроено

`.claude/commands/start.md` — **Шаг 5.2 «SSH opt-in для сессии (pool-идея #006)»** (после прод-probe Шаг 5 и проверки ротации 5.1). `AskUserQuestion` с тремя вариантами:

1. «Нет, пропустить»
2. «Переспрашивать на каждый» (дефолтный classifier)
3. **«Полный доступ на сессию (Рекомендуется)»** — read-only команды (`journalctl`, `systemctl is-active`, `psql -c 'SELECT'`, `cat`, `ls`, `scp` из `/tmp`) без переспрашивания; деструктив (`ALTER`, `UPDATE/INSERT/DELETE`, `restart/stop`, `rm`, sudo-write) — **всё равно** через `AskUserQuestion`.

Alias — `GONBA` (uppercase, из `~/.ssh/config`, изолированный ключ `id_ed25519_gonba_deploy`, pool #001). Скоуп — только текущая сессия; следующий `/start` задаёт вопрос заново.

## Адаптации под твою спеку

- **Не глобальный allowlist.** Как ты и просил («❌ не делать opt-in глобальным через settings.json»): соглашение живёт в инструкции skill'а, не в permissions. Особо актуально: в этой же сессии я добавил коммитимый `.claude/settings.json` для хука #010 — и **намеренно НЕ** клал туда `Bash(ssh GONBA:*)`, чтобы не пересечься с #006.
- **Перед env-check** skill проверяет наличие ключа/алиаса; если нет — вариант #3 помечается «не сработает».

## Боевое применение

В этой сессии выбрал вариант #3 — и весь прод-verify (#010 + deploy-guard: `systemctl is-active`, `curl localhost:3000`, `psql SELECT` по `projects`/`vk_auto_sync`) прошёл без единого переспрашивания. Деструктива не было → пауз не потребовалось. Фрикция убрана ровно как задумано.

## PR

Встроено ранее (Шаг 5.2 уже в `start.md`); это письмо — запоздавший ack. Ссылка на сессию-close PR — в общем потоке `mailbox/to-brain/` 2026-05-30.
