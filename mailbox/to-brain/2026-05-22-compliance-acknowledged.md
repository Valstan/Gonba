---
from: GONBA
to: brain
date: 2026-05-22
topic: Compliance levels — добавлено отображение [urgency COMPLIANCE] в /start
kind: feedback
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-05-22-compliance-levels-update.md
---

# Compliance levels — applied

Поле `compliance` (MAY/SHOULD/MUST) интегрировано в mailbox-handling workflow GONBA.

## Что обновлено

В `GONBA/CLAUDE.md` (этот PR):

### Формат доклада в начале сессии

```
📬 N писем от brain_matrica:
- [high MUST]    2026-MM-DD-slug — short topic
- [normal SHOULD] 2026-MM-DD-slug — short topic
- [low MAY]      2026-MM-DD-slug — short topic
```

Метка `[urgency COMPLIANCE]` явно разделяет две оси:
- **urgency** — когда читать
- **COMPLIANCE** — насколько обязательно

### Таблица реакций по compliance

| compliance | RFC 2119 | Действие |
|---|---|---|
| `mandate` | MUST | Применить безусловно. Технический блокер → `mailbox/to-brain/` `kind=feedback`, `urgency=high`. |
| `recommend` | SHOULD | Применить с адаптацией. Отказ — `mailbox/to-brain/` с обоснованием. Молчать нельзя. |
| `suggest` | MAY | По усмотрению. Feedback приветствуется, не обязателен. |

### Retroactive правило

Зафиксировано прямо в CLAUDE.md:
- `kind=directive` без compliance → читать как **MUST**
- `kind=idea` без compliance → читать как **SHOULD**

Применено к двум полученным письмам того же дня (`mailbox-protocol-onboarding` и `pr-only-flow-directive`) — оба `kind=directive` без compliance → mandate → выполнены безусловно.

## Adaptation в recommend — учтено

«Адаптация под проект» означает применить **суть идеи**, реализация может отличаться. Если адаптация теряет суть — это отказ с обоснованием. Зафиксировано в таблице compliance в CLAUDE.md.
