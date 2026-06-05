# План: индивидуальное визуальное оформление страниц проектов + ревизия данных

**Нитка:** «ревизия проектов» (продолжение). Запрос владельца 2026-06-05: каждый проект должен
визуально отличаться — фоновый цвет + ненавязчивый арт-декор (цветы / завитушки / линии),
«красивый минимализм», заметно но не пестрит. Плюс красивые описания. Плюс новый проект
«Клуб малмыжских путешественников».

## Стадии

### Stage 1 — Этно-разметка 11 проектов (прод-данные, Payload API) ✅ согласовано
`homepage_group` + `kind` по таблице (одобрена владельцем 2026-06-05):
| id | slug | group | kind |
|----|------|-------|------|
| 1 | gonba | — | project |
| 7 | eco-hotel-booking | stay | project |
| 8 | konnyy-klub-gmalyzh | do | project |
| 12 | craft-workshops-gonba | do | workshop |
| 3 | vyatskaya-lepota | do | studio |
| 9 | sadovaya-feya-gulfiya-kharisovna | do | person |
| 13 | district-excursions | see | project |
| 10 | village-and-temple | see | project |
| 14 | village-events | see | event |
| 5 | vyatskiy-sbor | shop | shop |
| 6 | about-project | — | project (уезжает в Pages позже) |

### Stage 2 — Дизайн-фича (код, branch → PR → reliz) ← ЭТА ВЕТКА
- Поле `decorMotif` (select) в `Projects`: floral / vines / lines / geometric / waves / none.
- Миграция `20260605_120000` (.ts + .sql): `decor_motif` в `projects` + `version_decor_motif` в `_projects_v` (varchar, idempotent).
- Компонент `ProjectDecor` — SVG-слой арт-декора по мотиву + accent-цвету, фон-смывка.
- Детерминированный фолбэк: если `accentColor`/`decorMotif` не заданы — выбираются из палитры/набора по slug, чтобы проекты различались даже без ручной разметки.
- Вписать в `projects/[slug]/layout.tsx` (там уже `--project-accent`).
- `queries.ts` select + `shared.ts` тип.
- Минимализм: opacity ~0.06–0.08, pointer-events:none, за контентом, respects prefers-reduced-motion.

### Stage 3 — Богатые описания (прод-данные, Payload API)
RichText `description` для 11 проектов. Драфты → ревью владельца → применить через Payload API (НЕ сырой SQL — versioned-доки).

### Stage 4 — Новый проект «Клуб малмыжских путешественников» (прод-данные)
- Создать проект (slug `klub-malmyzhskikh-puteshestvennikov`, projectType `travelClub`, group `see`).
- VK-источник #4 (club226176537) переключить с проекта 13 → новый.
- 5 постов клуба (id 155,157,158,187,194) перепривязать с 13 → новый.
- Наполнить галерею картинками из постов клуба.
- Бэкап прод-данных перед операцией.

## Прод-операции с данными
- Versioned-доки (projects) — только Payload Local API (`payload.update({data:{_status:'published'}})`), НЕ сырой SQL (урок Failed approaches).
- tsx-скрипт на проде, env из `/etc/gonba/gonba.env`, бэкап до правок.
- После — `search:reindex` + проверка.
