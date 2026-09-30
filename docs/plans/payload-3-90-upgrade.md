# Payload 3.89.0 → 3.90.1 (строка brain 28.09, recommend)

Источник: `brain_matrica/mailboxes/GONBA/from-brain/2026-09-21-…-g385-g386.md` (§3.89 уже не потолок)
+ addendum 22.09 (`_objectKey`, R34, G391/G392). Статус на 30.09: не начато, срок 28.09 прошёл.

## Почему 3.90.1, а не 3.90.0

3.90.0 = набор critical (отзыв чужих сессий при смене пароля, троттлинг
forgot-password, ужесточение SVG/XML-аплоадов, safe fetch). 3.90.1 поверх чинит
протечку `where` в связанные поля. ТАКСИ уже на 3.90.1.

## Что НЕ касается (проверено 30.09)

- `_objectKey` (addendum п.1): у нас нет `storage-s3`/`cloud-storage` — Media на
  локальном `staticDir` (`web/src/collections/Media.ts:147`). G391-детектор с
  фиктивными S3_* не нужен.
- SVG: в `src/` только статичный брендинг (`/branding/*.svg`), аплоадов SVG через
  Media нет, `allowRestrictedFileTypes` нигде не задан. Ужесточение 3.90 нас не бьёт.
- R34-overrides: таблица для pnpm-воркспейсов; мы на npm (`package-lock.json` —
  источник правды). Транзитивные high фиксим отдельно, не в этом PR.

## Изменения (один PR)

1. `web/package.json`: 13 пинов `3.89.0 → 3.90.1` (`payload` +
   `@payloadcms/{admin-bar,db-postgres,live-preview-react,next,plugin-form-builder,plugin-nested-docs,plugin-redirects,plugin-search,plugin-seo,richtext-lexical,translations,ui}`).
   `eslint-config-next` остаётся 15.5.24 (привязан к next, не к payload). `sharp` — отдельно.
2. `web/package-lock.json`: пересобрать (`npm install --package-lock-only`, затем полный
   install для локальных гейтов).
3. Миграция `web/src/migrations/20260930_*_payload_390_auth_throttle.{ts,sql}` +
   регистрация в `index.ts`:
   `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone`
   (нужна ВСЕМ — у нас `auth: true` без секции forgotPassword, G388). Чисто аддитивная.
4. `payload generate:types` — детектор: ждём ровно это поле в дифе `payload-types.ts`.

## Порядок (миграции накатываются вручную до мержа)

1. Локальные гейты: `typecheck` + `lint` (+ `generate:types`-диф).
2. PR → CI зелёный.
3. **Вручную на проде до мержа** (safety net деплоя падает на новых миграциях):
   `.sql`-спутник через `sudo -u postgres psql` + `INSERT INTO payload_migrations (name, batch …)`
   с `batch = max+1` из БД. Деструктива нет (ADD COLUMN nullable), но #025 — подтвердить в том же ходе.
4. Merge `--squash` (только когда предыдущий деплой `completed` — сериализация G24).
5. Авто-деплой → smoke: health 200, `/admin` 200, `/api/media` 200, версия payload из лога
   сборки релиза (не из standalone `node_modules`, G392), колонка на месте.
6. Письмо-строка brain (`kind=report`): версия с прода + «колонка на месте».

## Откат

Код: revert squash-коммита. БД: колонка nullable, старый код её не знает — отката DDL не требует.
