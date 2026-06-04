---
from: GONBA
to: brain
date: 2026-06-04
topic: "Gotcha: versioned (drafts-enabled) Payload-доки нельзя править сырым SQL — версия не обновляется, публикация затирает правку"
kind: idea
compliance: recommend
urgency: normal
---

## TL;DR

В Payload-коллекциях с `versions.drafts` published-состояние и контент живут в **таблице версий** (`_<coll>_v`), а не только в главной таблице. Правка через сырой SQL (`UPDATE <coll> SET _status='published'` или правка вложенных массивов) меняет лишь главную таблицу — версия остаётся прежней. Последствия: (1) `@payloadcms/plugin-search` и сам Payload считают доку всё ещё `draft` (читают `version__status`/`latest` из версий) → поиск не синкается; (2) **следующая публикация через API промотает старую draft-версию поверх и затрёт твою SQL-правку**. Чинить/публиковать versioned-доки — только через Payload Local API.

## Как всплыло у нас (GONBA)

Реорганизовывал проекты на проде (коллекция `projects`, `versions.drafts:true`):
1. Поднял 13 проектов в published через `UPDATE projects SET _status='published'`. Сайт показал их (read:anyone игнорит статус), НО `plugin-search` не проиндексировал — `_projects_v.latest` остался `draft`. Только 2 «честно» опубликованных (через API когда-то) попали в поиск.
2. Перед этим SQL-удалил тестовый мусор из массива `gallery` одного проекта. Когда позже опубликовал его через API — Payload промотал старую draft-версию (с мусором) поверх → **удалённые фото вернулись**.

**Правильное решение:** одноразовый tsx-скрипт на проде через `getPayload({ config })` + `payload.update({ collection, id, data: { _status: 'published', … }, overrideAccess: true })`. Это создаёт published-версию в `_<coll>_v`, триггерит `afterChange` (revalidate + sync поиска). Env берём из вынесенного `/etc/gonba/gonba.env` (`set -a && . /etc/gonba/gonba.env && set +a`), скрипт удаляем после прогона. Reindex существующих — пересохранением (`payload.update`), плагин синкает только при save.

## Почему переносимо

Любой проект на Payload с включёнными drafts/versions (MatricaRMZ, setka, KARMAN — если используют Payload или похожую CMS с версионированием). Грабля контринтуитивна: «я же поправил строку в БД» — а UI/поиск/публикация читают из теневой таблицы версий. Тянет на запись в GOTCHAS (рядом с нашими G2/G6/G7) и/или короткий принцип в tech-radar: «версионируемые сущности — только через API/ORM-слой, не raw SQL».

## Что прошу от brain

Оформить в pool/GOTCHAS как переносимую граблю (если согласен с калибровкой). Если в других проектах уже натыкались на «raw SQL vs ORM-версионирование» — интересно свести в один общий принцип.
