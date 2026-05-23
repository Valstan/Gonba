# Handoff Claude Design — этно-модерн для главной (2026-05-23)

Архив-выгрузка из Claude Design (claude.ai/design). Пользователь набросал в нём редизайн главной страницы Гоньбы в трёх направлениях, выгрузил bundle, передал нам для реальной реализации.

**Решение по итогам обсуждения:** берём **направление B (Этно-модерн)** — оно решает 6 проблем аудита и ложится на нашу палитру (forest/ochre/oxblood/paper). См. [ADR-0004](../../adr/0004-frontpage-ethno-modern-redesign.md) и [план PR1-4](../../plans/etno-modern-redesign.md).

## Что есть в этой папке

| Файл | Что внутри |
|---|---|
| [`README.md`](README.md) | Оригинальный README handoff'а от Claude Design — «coding agents read this first» |
| [`gonba-home.html`](gonba-home.html) | **Главный артефакт** — production-ready HTML главной (направление B, ~1100 строк). Все секции: hero, 4 groups, featured, people, crafts, shop banner, events, quote, footer. Чистый HTML+CSS+15 строк JS. |
| [`audit.jsx`](audit.jsx) | Анализ 6 ключевых проблем текущего сайта Гоньбы (плоский список 10+ ссылок, слаги в меню, фото не герой, …). Это **обоснование** редизайна. |
| [`direction-ethno.jsx`](direction-ethno.jsx) | Прототип B (Этно-модерн) — то, из чего вырос `gonba-home.html` |
| [`direction-journal.jsx`](direction-journal.jsx) | Прототип A (Журнал) — альтернатива, см. ADR-0004 §Alternatives considered |
| [`direction-story.jsx`](direction-story.jsx) | Прототип C (Сторителлинг) — альтернатива, см. ADR-0004 §Alternatives considered |
| [`proto-tokens.css`](proto-tokens.css) | Дизайн-токены направления B — палитра + шрифты. Сюда смотрим, когда заводим CSS-vars в `web/src/app/(frontend)/globals.css`. |

## Почему файлы лежат в репо, а не в `~/Downloads/`

1. **Видны с любой машины** (handoff пригодится несколько сессий, между разными компьютерами разработки).
2. **Видны в PR** — рецензент сразу видит источник правды для каждой секции.
3. **Помечают тайминг** — `handoff-2026-05-23` фиксирует «версия дизайна на эту дату». Если придёт следующий handoff — будет `handoff-YYYY-MM-DD/` рядом.

## Как пользоваться при реализации

1. Сначала прочитай [`plans/etno-modern-redesign.md`](../../plans/etno-modern-redesign.md) — там разложены PR1-4 на конкретные файлы.
2. При работе над секцией — открывай `gonba-home.html` и ищи нужный блок (там есть рубрики `═══ HEADER · NAV ═══` и т.д.). Внутри блока — HTML + CSS, переноси визуально 1-в-1 в React-компоненты `web/src/`.
3. **Не копируй структуру HTML дословно** — это прототип, не production-код. Цель — совпадение визуального результата.
4. CSS-vars + шрифты идут в `web/src/app/(frontend)/globals.css`, а в `(payload)/site-theme.css` подцепляем только те, что нужны админке.
5. Когда секция готова — сравнивай рендер у себя с разделом в `gonba-home.html`. Можно открыть HTML в браузере отдельно и сравнить side-by-side.
