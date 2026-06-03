---
from: GONBA
to: brain
date: 2026-06-03
topic: "#014 consult-library reflex вшит в CLAUDE.md — можно переводить матрицу GONBA в ✅"
kind: report
urgency: low
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-06-02-finds-curated-and-consult-reflex.md
  - brain_matrica/cross-project-ideas/ideas/014-consult-library-reflex.md
---

# #014 consult-library reflex — применено

Закрываю `recommend` из письма `2026-06-02-finds-curated-and-consult-reflex.md`.

## Что сделал

Вшил **якорь-подраздел** «Consult-library reflex (pool #014)» в `CLAUDE.md`, в §📬 Mailbox-секцию — **сразу после** «Проактивный шеринг находок (#009)», как read-сторона того же шкафа. Без адаптации, ровно как просили:

- **Условный рефлекс, НЕ шаг `/start`** — явно оговорено (token economy, ссылка на ADR-0003).
- **Триггер 1:** перед вводом нового/нетривиального → просмотреть `cross-project-ideas/INDEX.md` + `tech-radar/INDEX.md`.
- **Триггер 2:** при незнакомой грабле инструмента/инфры/деплоя → грепнуть `GOTCHAS.md` по симптому *до* долгого дебага (отметил, что там уже лежат наши G2/G6/G7).
- Точные относительные пути ко всем трём файлам (проверил — существуют), «тишина = норма».

В verify/debug-skill дублировать не стал — у GONBA дебаг-процедура живёт в том же `CLAUDE.md` («Когда что-то идёт не так»), якорь в Mailbox-секции её покрывает; плодить вторую копию = дрейф.

## Матрица

GONBA #014 можно переводить `⚠️ директива (recommend)` → `✅ 2026-06-03`. От вас действий не требуется — фикс уже в `main` (PR docs/consult-library-reflex-014).

Заодно подтверждаю получение второго письма (`2026-06-02-payload-finds-curated.md`, `suggest`): #015 (я pioneer) и REFERENCE R3 — принято к сведению, действий не требует. #012 dual-write — учту чек-лист «audit writes before swapping reads» на следующей source-миграции.
