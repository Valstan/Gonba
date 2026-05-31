# Architectural Decision Records (ADR)

В этой папке — короткие документы, фиксирующие **архитектурные решения** проекта GONBA: что было выбрано, какие альтернативы рассматривались, почему выбрали именно так.

Цель — не дать одному и тому же вопросу появляться в каждой новой сессии разработки. ADR — это «протокол собрания» для будущего себя или другого разработчика.

---

## Когда писать новый ADR

- Решение **трудно изменить** позднее (формат хранения данных, выбор СУБД, ключевой паттерн фреймворка).
- Решение **неочевидно** для нового разработчика (почему НЕ использовали популярный вариант).
- Решение **повторно всплывает** в обсуждениях (если уже два раза кто-то спросил «а почему мы так?»).

Если решение крошечное или очевидное (например «использовать TypeScript»), ADR не нужен.

---

## Формат

Берём адаптированный [Michael Nygard ADR](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md):

- **Title** — короткое описание (5-7 слов)
- **Status** — `Accepted` / `Superseded by NNNN` / `Deprecated`
- **Context** — что произошло, почему вообще встал этот выбор
- **Decision** — что решили
- **Consequences** — что это означает на практике (положительные, отрицательные, нейтральные)

Шаблон — [`_template.md`](_template.md). Имена файлов — `NNNN-короткое-название.md` (4-значный номер по порядку).

---

## Текущий индекс

| № | Title | Status |
|---|---|---|
| [0001](0001-yandex-disk-as-media-storage.md) | Yandex.Disk как хранилище медиа вместо S3 | Accepted |
| [0002](0002-push-true-dev-migrations-prod.md) | Гибридная стратегия миграций: `push:true` на dev, миграции на проде | Accepted |
| [0003](0003-build-via-systemd-run-on-prod.md) | Build на проде через `systemd-run` вместо прямого SSH | Accepted |
| [0004](0004-frontpage-ethno-modern-redesign.md) | Редизайн главной в стиле «этно-модерн» (направление B) | Superseded in part by 0006 |
| [0005](0005-secrets-outside-repo-tree.md) | Прод-секреты вне дерева репо (`/etc/gonba/gonba.env`) | Accepted |
| [0006](0006-homepage-orbit-usadba.md) | Главная — орбит-карусель; этно-лендинг → `/usadba` | Accepted |
| [0007](0007-archive-development-log.md) | Упразднение `DEVELOPMENT_LOG.md` (минималистичный AI-docs) | Accepted |

---

## Как добавить новый ADR

1. Скопируй `_template.md` → `NNNN-короткое-название.md` (следующий номер по порядку).
2. Заполни поля.
3. Добавь строку в таблицу индекса выше.
4. Если ADR заменяет старый — поменяй статус старого на `Superseded by NNNN`.
