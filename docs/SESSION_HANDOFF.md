# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-22
**Branch:** main
**Last released version:** —

---

## Текущая нитка

Доводим ADR-0001 до конца: коллекция `Media` должна хранить файлы на Яндекс.Диске (единственный источник правды), локальный VPS — только кэш TTL 30 дней. Подход и план **выбраны** 2026-05-22: см. [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md). Этап — **Фаза 0 (Замеры)**, к коду ещё не приступали.

## Следующий шаг

1. **Фаза 0** — запустить `/sql` для бейзлайн-метрик (`count(*)`, `count(yandex_path)`, `count(yandex_error)`, `sum(filesize)` из `media`) + `du -sh public/media` на проде. Заполнить таблицу Baseline в плане.
2. **Фаза 1** — реализовать `web/src/app/(frontend)/api/media/file/[id]/route.ts` (proxy endpoint с кэшем), детали в плане.
3. Дальше — по этапам плана (фазы 2-7).

Подробности по каждой фазе, разрезы по PR'ам, подводные камни — в [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md).

## Контекст

- **План:** [`docs/plans/media-to-yadisk.md`](plans/media-to-yadisk.md) — создан 2026-05-22, подход **B** (доработать гибрид: `afterRead` → собственный `/api/media/file/[id]` proxy с TTL-кэшем 30 дней).
- **Ключевая находка при чтении кода 2026-05-22:** ~80% инфраструктуры уже в `web/src/collections/Media.ts` (yandex-поля, `afterChange`/`afterDelete`/`afterRead`-хуки, error handling) + полный wrapper `yandex-disk.ts`. Подход A (Cloud Storage plugin) переоценён в сторону B, т.к. фактически означал бы переписывание готового.
- **Связанные коммиты сессии 2026-05-22:**
  - [`801ecc7`](https://github.com/Valstan/Gonba/commit/801ecc7) — изоляция SSH deploy-key + cross-project ideas pool (PR #20)
  - [`548a1b8`](https://github.com/Valstan/Gonba/commit/548a1b8) — AdminQuickLinks (dropdown «Меню» в шапке) (PR #21)
  - [`d0d1072`](https://github.com/Valstan/Gonba/commit/d0d1072) — `/admin/yadisk` теперь Payload Custom View с меню админки (PR #22)
  - [`7343f5f`](https://github.com/Valstan/Gonba/commit/7343f5f) — SESSION_HANDOFF + `/close_session` (cross-project pool idea 003) (PR #23)
- **Прод:** жив, на новом изолированном SSH deploy-ключе (`id_ed25519_gonba_deploy`). `/api/health` 200. Следующая ротация ключа не позднее **2026-08-20**.
- **Открытые вопросы для пользователя:**
  - Подход A / B / C для миграции Media (см. PENDING_FOLLOWUPS)?
  - Стратегия кэша на VPS: TTL? LRU? Размер?
  - Что делать с уже залитыми в Payload Media файлами на disk?

## Не забыть (low-priority)

- 🟡 В `authorized_keys` GONBA-сервера два «чужих» ключа от matricarmz/setka — разобрать в их сессиях.
- 🟢 В **MatricaRMZ** применить идеи 001+002 (изолированный deploy-key + ротация) из cross-project pool.
- 🟢 В **setka** применить идею 002 (ключ изолирован, нужна формальная ротация — спросить период).
- 🟢 В **setka** применить идею 003 (SESSION_HANDOFF + `/close_session`) — у него тоже бывают многоэтапные рефакторинги.
- 🟢 Расширить `AdminQuickLinks` ссылками на `/admin/yadisk`, `/api/health`, GitHub Actions — когда появится потребность.

---

> Этот файл — короткий **sticky note**, что было следующим шагом, чтобы следующая сессия (или ты с другого компа) могла продолжить без пересказа контекста. **Перезаписывается целиком** в конце каждой значимой сессии через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`. Подробнее — `cross-project-ideas/ideas/003-session-handoff.md`.
