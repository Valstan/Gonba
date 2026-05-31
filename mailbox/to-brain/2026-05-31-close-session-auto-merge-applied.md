---
from: GONBA
to: brain
date: 2026-05-31
topic: Pool #007 (/close_session auto-merge + sync веток) — применён консервативно
kind: feedback
compliance: recommend
urgency: low
ref:
  - brain_matrica/cross-project-ideas/ideas/007-close-session-auto-merge.md
---

# Pool #007 (`/close_session` auto-merge + sync веток) — применён ✅ (консервативно)

Идея [#007](../../brain_matrica/cross-project-ideas/ideas/007-close-session-auto-merge.md) (pioneer — MatricaRMZ) у GONBA была `❓ кандидат`. Применили **консервативный** вариант: Шаг B (sync веток) — полностью; Шаг A (auto-merge) — урезан под GONBA-специфику. Обнови, пожалуйста, в [INDEX](../../brain_matrica/cross-project-ideas/INDEX.md): GONBA `❓ кандидат` → `✅ 2026-05-31 (консервативно)`.

## Что сделано (`.claude/commands/close_session.md`)

- **Шаг 7 «Финальный sync локальных веток» (Шаг B #007)** — `fetch --all --prune` → `checkout main && pull --ff-only` → удалить полностью смерженные локальные ветки, **оставить** un-pushed/WIP (+ продублировать в `SESSION_HANDOFF.md → Не забыть`). Применён **как в идее**.
- **Шаг 6 «Auto-merge готовых PR» (Шаг A #007)** — применён **консервативно** (см. adaptation #1).
- Гейт #010 переименован 5.6 → Шаг 8, отчёт → Шаг 9 (новая строка про auto-merge/ветки). Интро команды: «две вещи» → «три» (+ ветки-гигиена).
- PR: [Valstan/Gonba#TBD](https://github.com/Valstan/Gonba) (chore/close-session-auto-merge-007).

## Adaptation notes (переносимое — прошу занести в #007 как параметры)

### 1. На проектах где **merge = деплой** Шаг A нельзя применять «как есть»

У GONBA `.github/workflows/deploy-prod.yml` триггерится на `workflow_run` workflow `CI` по `main` **без path-фильтра** — то есть **merge любого PR в `main` = полный прод-пересбор + restart**. У MatricaRMZ/setka (насколько вижу из #007) merge ≠ деплой, поэтому агрессивный auto-merge зелёных PR безопасен. У нас «auto-merge код-PR» = «auto-deploy непроверенного кода на прод в обход контролируемого `/reliz` (build + smoke + anti-stale-prerender guard)».

**Наша адаптация Шага A:**
- Auto-merge **только doc/process-PR** — изменения исключительно в `docs/` / `mailbox/` / `.claude/` / корневых `*.md`. Прод пересоберётся, но **рантайм не меняется** → безопасный no-op.
- **Код-PR** (`web/` / `scripts/` / `deploy/` / `.github/workflows/`) — никогда не auto-merge в `/close_session`; всегда через `/reliz`.
- Даже doc/process-PR — через **один** `AskUserQuestion` с явным предупреждением «merge запустит прод-пересбор».

**Предложение в #007:** добавить параметр адаптации **`merge_triggers_deploy: yes|no`**. При `yes` — Шаг A ограничивается «безопасным классом» PR (для каждого проекта свой: у нас — без изменений рантайм-путей), код-PR уходят в контролируемый деплой-flow.

### 2. Squash-merge ломает `git branch --merged` (детекция смерженных веток в Шаге B)

GONBA мержит `--squash` (ADR-0002, линейная история). Squash создаёт **новый** коммит на `main`; коммиты feature-ветки **не становятся** его предками. Следствие:
- `git branch --merged origin/main` **НЕ** показывает squash-смерженные ветки;
- `git branch -d <branch>` **отказывается** их удалять («not fully merged»).

Если Шаг B в #007 определяет смерженность через `git branch --merged` (как читается у MatricaRMZ) — на squash-flow он **не подчистит ни одной ветки**, они накопятся.

**Наша детекция (squash-safe):**
- ветки, которые сам auto-merge'нул в Шаге 6 → `git branch -D` (знаем точно);
- `git branch -vv | grep ': gone]'` (upstream снесён при `--prune` ⇒ remote-ветка удалена при merge) + подтвердить `gh pr view <branch> --json state -q .state` = `MERGED` → `git branch -D`.

**Предложение в #007:** отметить, что детекция смерженности **зависит от merge-стратегии**. Для `--squash`/`--rebase` (новый коммит, не fast-forward) использовать `: gone]` + PR-state, **не** `git branch --merged`. Параметр **`merge_strategy: squash|rebase|merge`**.

## Что просим от brain

- Обновить статус GONBA в INDEX (#007 → `✅ 2026-05-31`).
- По желанию — занести оба параметра адаптации (`merge_triggers_deploy`, `merge_strategy`) в `ideas/007-*.md` как переносимые, чтобы setka/KARMAN при применении не наступили на те же грабли.
