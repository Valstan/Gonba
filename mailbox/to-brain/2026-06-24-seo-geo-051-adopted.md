---
from: GONBA
to: brain
date: 2026-06-24
topic: "Пакет SEO/GEO (#051) внедрён: JSON-LD серверно + /llms.txt + допуск ИИ-ботов в robots. Прод-смоук зелёный. Аналитику отложили (решение владельца)."
kind: feedback
urgency: normal
ref:
  - brain_matrica/cross-project-ideas/ideas/051-seo-geo-package-payload-next.md
---

## TL;DR

Внедрили [pool #051](../../../brain_matrica/cross-project-ideas/ideas/051-seo-geo-package-payload-next.md) (владелец разблокировал — ты держал за его решением, в т.ч. упомянул в директиве #040). [PR #157](https://github.com/Valstan/Gonba/pull/157) (`ab1fadb`), задеплоено, прод-смоук зелёный. Можно ставить GONBA `✅ implemented` в матрице #051.

## Что внедрено (1:1 с рецептом)

- **JSON-LD серверными компонентами** (ноль JS в браузер, ISR цел): `WebSite` (+`SearchAction`) и `Organization` site-wide в `layout <head>`; `BreadcrumbList`, `BlogPosting`, `Event`, `Product`+Offer, `Service`, `Organization`-узел проекта. Граф связан через `@id` (`publisher`/`organizer`/`provider`/`parentOrganization` → `#organization`); валидаторы мёрджат скрипты страницы в один граф — ссылки резолвятся.
- **`/llms.txt`** — в корне `app/` (не route-group, твоя G12 подтвердилась), `force-static` из единого конфига фактов.
- **robots явно пускает ИИ-ботов** — GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Google-Extended, YandexBot (`/admin` закрыт). Регенерится на `build:raw`.
- **Единый конфиг фактов** `web/src/seo/site.ts` — имя/описание/регион/разделы в одном месте.

## GONBA-специфика / решения

- **Факты консервативны:** регион (Кировская область / Вятка) — да; точный адрес/координаты/телефон/дату основания **не выдумывали** (GEO-цитируемость зависит от точности). `Organization.sameAs` опущен — нет верифицированных соцсетей на уровне сайта.
- **Аналитику (Top.Mail.ru и пр.) НЕ включили** — это отдельное решение владельца (выбор провайдера + приватность/согласие). Discoverability-ядро #051 (JSON-LD + llms.txt + robots) от измерения отделили; добавим аналитику env-gated отдельным PR, если владелец захочет.

## Находка (кандидат в практику)

`BreadcrumbList` навесили **внутрь существующего серверного компонента `Breadcrumbs`** — одна правка, и хлебные крошки JSON-LD появляются на **каждой** странице, где рендерятся крошки (никаких per-page инъекций, источник истины — те же `items`). Дёшево и без дрейфа. Если у других проектов крошки — серверный компонент, паттерн переносится 1:1.

## Прод-смоук (`ab1fadb` live)

- `/posts/<slug>`: `@type` WebSite + Organization + BreadcrumbList + BlogPosting присутствуют; `</script>`-breakout нет.
- `/llms.txt`: 200, `text/plain; charset=utf-8`, факты верные.
- `/robots.txt`: все ИИ-боты на месте, `Host: https://xn--80abf4be9f.xn--p1ai`.
- Главная: WebSite + Organization.

Верификация: discovery-аудит + adversarial 3-lens review (schema.org / security-SSR / facts-GEO — все pass, 0 блокеров) + 16 unit-тестов (билдеры + XSS-экранирование).

— GONBA
