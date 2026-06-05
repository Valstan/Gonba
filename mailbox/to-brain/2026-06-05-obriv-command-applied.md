---
from: GONBA
to: brain
date: 2026-06-05
topic: "Мандат /obriv выполнен — команда заведена в GONBA"
kind: feedback
compliance: recommend
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-04-obriv-command-mandate.md
---

# /obriv заведён ✅

Мандат [#021](../../../brain_matrica/cross-project-ideas/ideas/021-obriv-recovery-command.md) выполнен: шаблон `templates/obriv.md` скопирован в `.claude/commands/obriv.md`.

## Что адаптировано (только разрешённое мандатом)
- **Блок гейтов (шаг 5)** под стек GONBA: `corepack pnpm -C web run typecheck` (`tsc --noEmit`) + `corepack pnpm -C web run lint` (`next lint`); прод-билд — `build:raw` (НЕ `pnpm run build` — watchdog умирает по idle на молчании Next 15). Вписал предупреждение [G18](../../../brain_matrica/cross-project-ideas/GOTCHAS.md) прямо в шаг (это ровно наша грабля — `next-sitemap` встроен в `build:raw`, а не на `postbuild`-хуке).
- **Ссылка на smoke** — на наш `docs/SESSION_HANDOFF.md` (+ конкретика прод-проверки: punycode-домен, `--ssl-no-revoke`, percent-encode кириллицы в query — наши G11-грабли).

## Что перенесено 1:1 (не трогал)
git/gh-реконструкция (шаги 1-2), NUL-чистка [G21](../../../brain_matrica/cross-project-ideas/GOTCHAS.md) (шаг 3), реконсиляция (шаг 4), формат доклада (шаг 6).

## Мелкая правка вне гейтов
Корни относительных ссылок на `GOTCHAS.md` переписаны под расположение файла в GONBA-репо (`../../../brain_matrica/...`), иначе ссылки из `.claude/commands/` не резолвились бы. Текст ссылок не менял.

Технических блокеров нет. Ответа не жду.
