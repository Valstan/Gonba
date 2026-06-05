---
description: Восстановление после обрыва связи — самопроверка целостности работы и продолжение
---
<!--
Команда /obriv (pool-идея #021, pioneer — SabantuyMalmyzh; кросс-проектный мандат brain
2026-06-04). Адаптирован ТОЛЬКО блок гейтов (шаг 5) под стек GONBA + ссылка на проектный
docs/SESSION_HANDOFF.md. Всё остальное перенесено 1:1 из шаблона brain_matrica.
-->

Был **обрыв интернета/сессии**. Не паникуй и **не переделывай вслепую то, что уже сделано** — сначала восстанови картину из «земли» (git/файлы/PR), потом продолжи прерванную нить. Принцип — **идемпотентность**.

## 1. Реконструируй состояние из ground truth

```bash
git branch --show-current
git status --short
git log --oneline -6
git stash list
```
- Дерево чистое? Незакоммиченные правки — **завершённые или оборванные на полпути**?
- Последний коммит — это работа перед обрывом, или она не успела закоммититься?

## 2. Сверь с PR и фоновыми задачами

```bash
gh pr view --json number,state,title,headRefName -q '.number,.state,.title' 2>/dev/null || gh pr list --head "$(git branch --show-current)"
```
- PR существует/открыт/смержён? **Не задвоить** создание.
- Фоновые задачи (dev-сервер, build)? Проверь их `*.output`; не плодить дубли на портах.

## 3. Проверь целостность недавно записанных файлов (грабля харнесса, [G21](../../../brain_matrica/cross-project-ideas/GOTCHAS.md))

Обрыв может совпасть с **битой записью**: лишний `NUL`-байт / UTF-16 / BOM → git показывает файл как **`Bin`**, хотя сборка может «проглотить».
```bash
git add -A && git diff --cached --stat   # любой исходник как "Bin" → подозрение
```
Код-файл показан бинарным → вычистить NUL, пересохранить UTF-8:
```bash
node -e "const fs=require('fs');const f=process.argv[1];const b=fs.readFileSync(f);const n=[...b].filter(x=>x===0).length;console.log(f,'NUL',n);if(n)fs.writeFileSync(f,Buffer.from([...b].filter(x=>x!==0)))" '<путь>'
```

## 4. Реконсиляция последнего действия

Сопоставь **последнее, что намеревался сделать** (из контекста диалога), с фактом: правка легла? Не уверен — **перечитай** участок файла (Read), не доверяй памяти.

## 5. Если трогался код — перепроверь гейты

Стек GONBA — pnpm-монорепо (Next 15 / Payload 3.75), скрипты живут в `web/`:
```bash
corepack pnpm -C web run typecheck    # tsc --noEmit
corepack pnpm -C web run lint          # next lint
```
Если правка существенная и нужен прод-билд — собирать **`build:raw`** (НЕ `pnpm run build` — он под watchdog и умирает по idle-timeout на молчании Next 15; см. CLAUDE.md):
```bash
corepack pnpm -C web run build:raw     # next build && next-sitemap (генератор встроен, не на post-хуке)
```
> ⚠️ Грабля [G18](../../../brain_matrica/cross-project-ideas/GOTCHAS.md): `pre*`/`post*`-хуки npm привязаны к **имени** скрипта, не к факту сборки — обёртка с другим именем (`build:raw`) хук молча пропускает. Поэтому `next-sitemap` встроен прямо в `build:raw`, а не висит на `postbuild`. Если добавляешь шаг к сборке — встраивай в сам скрипт, не на хук.

(+ smoke по образцу `docs/SESSION_HANDOFF.md` → раздел «Прод-проверка»: health через `curl http://127.0.0.1:3000/api/health`, публичный домен — punycode `https://xn--80abf4be9f.xn--p1ai` с `--ssl-no-revoke --compressed`, кириллицу в query слать percent-encoded.)

## 6. Доложи и продолжи

Кратко: `После обрыва: ветка <X>, последний коммит <Y>, дерево <чисто/N правок>, PR #<N> <состояние>. Потеряно: <ничего/…>. Продолжаю: <следующий шаг>.` — и **продолжай прерванную работу** с места остановки.

Не начинай новую работу, пока не подтвердил, что прерванная нить цела.
