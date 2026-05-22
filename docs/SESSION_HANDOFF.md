# Session Handoff

**Status:** ACTIVE
**Updated:** 2026-05-22
**Branch:** main
**Last released version:** —

---

## Текущая нитка

Доводим ADR-0001 до конца: коллекция `Media` должна хранить файлы на Яндекс.Диске (единственный источник правды), локальный VPS — только кэш для быстрой выдачи. Прямо сейчас этап **планирования / proof-of-concept** — ещё не делали.

## Следующий шаг

1. Открыть `docs/PENDING_FOLLOWUPS.md → 🟢 Архитектура / Media` — там полный scope и три подхода (A / B / C).
2. С пользователем выбрать подход — рекомендую **A** (Payload Cloud Storage plugin с кастомным adapter'ом для Я.Диска) — самый идиоматичный, но 3-5 дней работы.
3. Сделать proof-of-concept на одном тестовом документе Media: загрузка → файл уезжает на Я.Диск → запрос `/media/<id>` возвращает контент.
4. Если PoC работает — план миграции существующих записей (сколько их? `SELECT count(*) FROM media` на проде через `/sql`).

## Контекст

- **План:** ещё нет файла в `docs/plans/` — создать `docs/plans/media-to-yadisk.md` когда выберем подход.
- **Связанные коммиты сессии 2026-05-22:** [801ecc7](https://github.com/Valstan/Gonba/commit/801ecc7) (deploy-key изоляция), [548a1b8](https://github.com/Valstan/Gonba/commit/548a1b8) (AdminQuickLinks), [d0d1072](https://github.com/Valstan/Gonba/commit/d0d1072) (yadisk → Custom View). Эта нитка про Media — пока без коммитов.
- **Прод:** жив, на новом изолированном SSH deploy-ключе, последний deploy ~08:15 UTC.
- **Открытые вопросы для пользователя:**
  - Подход A / B / C для миграции Media (см. PENDING_FOLLOWUPS)?
  - Стратегия кэша на VPS: TTL? LRU? Размер?
  - Что делать с уже залитыми в Payload Media файлами на disk?

## Не забыть (low-priority)

- 🟡 В `authorized_keys` GONBA-сервера два «чужих» ключа от matricarmz/setka — разобрать в их сессиях.
- 🟢 В MatricaRMZ применить идею 001+002 (изолированный deploy-key + ротация).
- 🟢 В setka применить идею 002 (ключ изолирован, нужна формальная ротация — спросить период).
- 🟢 Расширить `AdminQuickLinks` ссылками на `/admin/yadisk`, `/api/health`, GitHub Actions — когда появится потребность.

---

> Этот файл — короткий **sticky note**, что было следующим шагом, чтобы следующая сессия (или ты с другого компа) могла продолжить без пересказа контекста. **Перезаписывается целиком** в конце каждой значимой сессии через `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`. Подробнее — `cross-project-ideas/ideas/003-session-handoff.md`.
