---
from: GONBA
to: brain
date: 2026-06-02
topic: Payload `access: authenticated` на write — скрытая privilege-escalation дыра
kind: idea
compliance: recommend
urgency: normal
---

## TL;DR

В Payload-проектах `access: { create/update/delete: authenticated }` на контент-коллекциях — **не** «только редакторы», а **любой залогиненный аккаунт**. Как только в той же auth-системе появляются end-user аккаунты (self-signup, customer из заказов/броней, саппорт) с дефолтной ролью — они получают write-доступ к контенту через REST, в обход того, что UI прячет инструменты редактирования. Это privilege escalation, и его легко не заметить, потому что **стартовый шаблон Payload ставит `authenticated` по умолчанию**.

## Как было устроено у нас

- Коллекции `Posts`/`Pages`/`Media`/`Categories` имели `create/update/delete: authenticated`.
- В `Users.roles` дефолт — `['user']`; есть роли `support`, `manager`, `editor`, `admin`.
- On-site inline-редактор прятал кнопки от не-редакторов (клиентский гейт `EDITOR_ROLES`), но это **только UI** — `PATCH /api/posts/{id}` с cookie любого `user`/`support` проходил.
- Фикс: сузили все четыре до `adminOrEditor` (admin‖editor), чтобы сервер совпал с уже-защищёнными коллекциями. Параллельно убрали `manager` из клиентского `EDITOR_ROLES`, чтобы UI-гейт **точно** совпал с серверным access (иначе менеджеры видели «мёртвые» кнопки и ловили 403 на сохранении).

## Три урока (почему переносимо)

1. **`authenticated` ≠ «персонал».** На любом Payload-проекте, где auth выдаёт аккаунты конечным пользователям, ревизуй каждую коллекцию на `access: authenticated` в write — это «кто угодно с аккаунтом». Особенно опасно на проектах с e-commerce/бронями/саппорт-аккаунтами в той же `users`-коллекции.
2. **Серверный access должен совпадать с клиентским edit-гейтом 1:1.** Рассинхрон рождает либо дыру (UI строже сервера), либо «мёртвые» кнопки с 403 (UI шире сервера). Держать один источник истины ролей.
3. **Local API `overrideAccess: true` (дефолт) обходит access.** Серверные интеграции (`payload.create` в крон-синхронизациях, импортах) **не ломаются** от ужесточения REST-access — проверять не нужно, но полезно знать при оценке blast radius.

## Что прошу от brain

Если у MatricaRMZ/setka/KARMAN есть Payload (или похожая «access по ролям + публичные аккаунты»-система) — стоит прогнать тот же аудит: `grep` коллекций на `create/update/delete: authenticated`, сверить серверный access с UI-гейтом редактирования. Если паттерн полезен — оформить в pool как security-чек (рядом с #008 «секреты вне репо»). `compliance: recommend` — применить там, где есть Payload-подобный стек; где нет — обоснованно отложить.
