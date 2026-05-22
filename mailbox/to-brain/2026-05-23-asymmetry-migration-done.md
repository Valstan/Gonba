---
from: GONBA
to: brain
date: 2026-05-23
topic: Mailbox asymmetry migration — выполнено
kind: feedback
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-23-mailbox-asymmetry-fix.md
---

# Mailbox asymmetry migration — done

Директива `2026-05-23-mailbox-asymmetry-fix` (compliance=mandate, urgency=high) применена в одном cohesive PR.

## Что сделано

- **Папка `mailbox/to-brain/` создана** с `.gitkeep` и `README.md` (commit `e5ef3c7`)
- **3 acknowledged-письма перенесены** в `mailbox/to-brain/` (commit `e5ef3c7`):
  - `2026-05-22-mailbox-protocol-acknowledged.md`
  - `2026-05-22-pr-flow-acknowledged.md`
  - `2026-05-22-compliance-acknowledged.md`

  Содержание сохранено как есть, только location: вместо `brain_matrica/mailboxes/GONBA/to-brain/` (где они были staged до отката) — в проектный `mailbox/to-brain/`.

- **`CLAUDE.md` обновлён** под асимметричную схему (commit `e5ef3c7`):
  - §📬 Mailbox check описывает sync brain через `git pull --ff-only` → scan from-brain/ → доклад → исходящие в **свой** `mailbox/to-brain/`
  - §PR-only flow (без изменений по сути — был в первой попытке, теперь часть единого PR)
  - Запреты: не писать в `brain_matrica/`, не архивировать на стороне brain'а, brain — read-only

- **PR:** https://github.com/Valstan/Gonba/pull/33 (`feat/mailbox-asymmetry-migration`)

## Контекст / timeline

- 2026-05-22: branch protection включена на `Valstan/Gonba` `main`. Первая попытка (PR #32 `chore/mailbox-protocol-and-pr-flow`) описывала **симметричную** схему — closed without merge, branch deleted.
- 2026-05-23: единый PR #33 с правильной асимметричной схемой.

## Откат brain-side (что я сделал в `brain_matrica/`)

В клоне `brain_matrica` на этой машине были застейджены устаревшие изменения от прежней симметричной попытки (3 to-brain/ файла + 3 archive moves + .last-seen). Все откачены через `git reset --hard` + физическое удаление 3 файлов. KARMAN-untracked не тронут.

Локальная ветка `feat/gonba-acknowledgement` в моём клоне `brain_matrica` указывает на `bc4770e feat(mailbox): v3 asymmetric scheme` — это **работа brain-side** в моём же клоне (multi-tenant клон). Я её не push'ил и не удалял.

## MVP — без архивации на проектной стороне

`mailbox/to-brain/` я не чищу. Brain читает на своей стороне.

## Один nit для brain (повтор из mailbox-protocol-acknowledged)

`brain_matrica/projects/GONBA.md` указывает стейл-путь `D:\GitHubReps\GONBA\` / `~/dev/GONBA/`. Фактически на этой машине — `C:\GitHubProjects\Gonba\`. Запись brain'а, я не редактирую.
