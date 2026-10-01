# Аудит серверного write-authz — 2026-10-02 (#015, срок 16.10)

Инвентаризация всех write-путей и разбор находок. Формат: путь → чек прав → вердикт. Находки с номерами — внизу; по каждой либо тот же PR (закрыты), либо дата в `docs/followups/tech-debt.md`.

## 1) Кастомные HTTP-роуты

| Путь | Чек прав | Авторизация | Вердикт |
|---|---|---|---|
| `/api/yadisk`, `/api/yadisk/upload`, `/yadisk-api/*` | `requireAdmin` (admin/manager) | Да | OK |
| `/api/health` | Нет (Local API `overrideAccess: true`, только probe) | Нет | read-only |
| `POST /api/bookings` | Валидация ввода, коллекция `create: anyone`, **rate-limit нет** | Нет | ⚠️ см. F5 |
| `/api/analytics-*` (config/informer/stats) | Нет, read-only конфиг/картинки | Нет | OK |
| `/api/admin/edit-target` | `requireAdmin` | Да | OK |
| `/api/media/usage` | `req.user` + роль admin/editor/manager | Да | OK |
| `/api/media/replace`, `/api/media/force-delete` | `req.user` + роль admin/editor | Да | OK |
| `/api/media/file/[id]` | Нет, rate-limit 240/мин/IP | Нет | OK (файлы публичные по смыслу) |
| `/api/projects/[slug]/chat` GET | Нет (фильтр `isModerated != true`) | Нет | OK |
| `POST /api/projects/[slug]/chat` | Нет, rate-limit 10/мин/slug/IP + анти-дубликат | Нет | OK |
| `/api/home-carousel*` GET | Нет (published) | Нет | OK; POST — `requireAdmin` |
| `POST /api/ugc/sign-upload` | Rate-limit 30/10мин/IP, выдаёт presigned PUT | Нет | ⚠️ anon-выдача подписи — наблюдать |
| `POST /api/ugc/unlike` | Rate-limit + owner-token/`ownerVisitor` match | Нет | OK |
| `POST /api/ugc/edit-comment`, `delete-comment`, `delete-submission` | Rate-limit + `isStaffRequest` ИЛИ `isOwnerOf` | Нет | OK |
| `/api/vk-import/queue*` | `requireAdmin` + `ensureAdminOnly` | Да | OK |
| `POST /api/vk-auto-sync/trigger` | **Было:** обход при пустом `CRON_SECRET`, cookie-проверка без роли → **F1, исправлено в этом PR** | Зависело | ✅ исправлено |
| `GET /api/vk-auto-sync/trigger` | Нет (мета-информация) | Нет | OK |
| `/api/test/e2e-user` | `ENABLE_E2E_HELPERS==='true'` + `x-e2e-secret` (дефолт `'local-e2e-secret'`) | Зависит от env | ⚠️ см. F7 |
| `/next/seed` | **Было:** любой залогиненный → **F2, исправлено** (admin-only) | Да, было слишком широко | ✅ исправлено |
| `/next/preview` | `PREVIEW_SECRET` + любой залогиненный | Да | ОК по смыслу |
| `/next/exit-preview` | Сброс draft-mode | Нет | OK |

## 2) Payload access по коллекциям/глобалам

| Сущность | create | read | update | delete |
|---|---|---|---|---|
| Users | `adminOnly` | `adminOrSelf` | `adminOrSelf` | `adminOnly` |
| Pages / Posts | `adminOrEditor` | `authenticatedOrPublished` | `adminOrEditor` | `adminOrEditor` |
| Projects / Events / Services / Products / Categories / Media | `adminOrEditor` | `anyone` | `adminOrEditor` | `adminOrEditor` |
| Messages | `adminOrEditor` | `messagesPublicRead` | `adminOrEditor` | `adminOrEditor` |
| VkImportQueue | `adminOnly` | `adminOnly` | `adminOnly` | `adminOnly` |
| VkAutoSync | `adminOrEditor` | `adminOrEditor` | `adminOrEditor` | `adminOrEditor` |
| Submissions / SubmissionComments | `anyone` | `publicVisibleOrStaff` | `adminOrEditor` | `adminOrEditor` |
| SubmissionReactions / SubmissionViews / ContentReports | `anyone` | `adminOrEditor` | `adminOrEditor` | `adminOrEditor` |
| Bookings / Orders | `anyone` | `adminOrManager` | `adminOrManager` | `adminOrManager` |
| Header / Footer | — | `() => true` | `adminOrEditor` | — |
| HomeCarousel | — | `() => true` | `adminOrManager` | — |
| VkAutoSyncSettings | — | `() => true` | `adminOrEditor` | — |
| VkEditorialRules | — | `adminOrEditor` | `adminOrEditor` | — |

Field-level: служебные поля UGC (`status`, `likeCount`, `ipHash`, `ownerHash`, `ownerVisitor`, `userAgent`, `hiddenReason`, `reportCount`) закрыты staff-доступом; `VkAutoSync.accessToken` — `create/read/update: () => false`.

**`Users.roles` — поле-level access НЕ был задан → F4 (priv-esc), исправлено в этом PR.**

`authenticatedOrPublished` для Pages/Posts: любой залогиненный (включая роль `user`) видит черновики. Публичной регистрации нет, аккаунты выдаёт admin — допустимо, фиксируем как осознанное.

## 3) `jobs.access.run` (payload.config.ts)

**Было:** `if (req.user) return true` — любой залогиненный мог дёрнуть `/api/jobs/run` (в задачах — `vkAutoSync`). **Исправлено в этом PR:** запуск пускаем только ролям `admin|editor|manager`, остальные — через `Bearer CRON_SECRET`.

Кастомных `endpoints:` в коллекциях/глобалах нет — внешние маршруты в `web/src/app/api/**` (раздел 1).

## 4) Local API с `overrideAccess: true`

Список мест: `health`, `admin/edit-target`, `media/*`, `home-carousel/disk-images`, `vk-import/queue*`, `vk-auto-sync/trigger`, `test/e2e-user`, `ugc/*`, `projects/[slug]/chat`, `yadisk-api/sync`, `server/endpoints/yadisk/list-actions.ts`, `integrations/vk-auto-sync.ts`, `collections/VkAutoSync`, `collections/Media.ts`, `server/media-usage/*`, `server/ugc/hooks/*`, страницы `lenta`, `vk-import`, `projects/[slug]/chat`. Все перечисленные маршруты имеют ручной чек до вызова (раздел 1) — `overrideAccess` используется как «персонаж операции — система», а не как обход.

## 5) Публичные мутации без логина (по смыслу продукта)

`POST /api/submissions`, `/api/submission-comments`, `/api/submission-reactions`, `/api/submission-views`, `/api/content-reports`, `/api/bookings`, `/api/orders` (`create: anyone`), `POST /api/projects/:slug/chat`, `POST /api/ugc/sign-upload`, `POST /api/ugc/unlike`, `POST /api/ugc/edit-comment|delete-comment|delete-submission` (staff-или-owner). У всех UGC-путей есть rate-limit на уровне роута/хука; **`Bookings`/`Orders` — rate-limit нет (F5)**.

## Находки и резолюции

| # | Находка | Серьёзность | Резолюция |
|---|---|---|---|
| F1 | `/api/vk-auto-sync/trigger` POST: auth bypass при пустом `CRON_SECRET`; cookie `payload-token` проверялся без валидации роли | Высокая | ✅ Исправлено в этом PR: `Bearer CRON_SECRET` ИЛИ staff-роль через `payload.auth` |
| F2 | `/next/seed` POST: любой залогиненный мог запустить seed | Высокая | ✅ Исправлено: admin-only |
| F3 | `jobs.access.run`: любой залогиненный мог запускать jobs (`vkAutoSync`) | Средняя | ✅ Исправлено: admin/editor/manager ИЛИ `CRON_SECRET` |
| F4 | `Users.roles` без field-level access: `PATCH /api/users/:id` позволял юзверю поднять себе `admin` | Критическая | ✅ Исправлено: field `access.create/update` = admin-only |
| F5 | `Bookings`/`Orders` — `create: anyone`, rate-limit нет | Низкая | Открыто: `docs/followups/tech-debt.md`, дата — следующий security-пасс (#057, 30.11) |
| F6 | `authenticatedOrPublished`: любой залогиненный видит черновики Pages/Posts | Низкая | Принято осознанно (нет публичной регистрации), задокументировано тут |
| F7 | `/api/test/e2e-user`: дефолтный секрет `'local-e2e-secret'` | Низкая | Открыто: вынести в обязательно env без дефолта, дата — #057 |
| F8 | `/next/preview`: любой залогиненный + `PREVIEW_SECRET` | Низкая | Принято осознанно |

## Вывод

Серьёзных открытых дыр после этого PR нет: четыре пункта (F1–F4) закрыты кодом, F5–F8 зафиксированы с датами/осознанностью. Следующий аудит того же класса — состязательный, #057 (30.11).
