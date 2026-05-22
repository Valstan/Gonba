# 0001. Yandex.Disk как хранилище медиа вместо S3

- **Status:** Implemented (2026-05-22)
- **Date:** 2026-04 (зафиксировано задним числом 2026-05-21)
- **Implementation:** [`docs/plans/media-to-yadisk.md`](../plans/media-to-yadisk.md) — фазы 1-5, PR #24 + #26 + #27 + #28
- **Deciders:** Valstan

## Context

Проекту GONBA нужно хранилище для медиа: фотогалереи проектов (десятки фото на каждый), логотипы, hero-изображения, превью лавки. Аудитория — российская, бюджет — минимальный (нет статьи на инфраструктуру). Админы (роли `admin`/`manager`) должны иметь возможность управлять файлами и через UI Payload, и при необходимости — напрямую через знакомый «Яндекс.Диск» в браузере.

Дополнительно: существуют публичные галереи на Яндекс.Диске, которые автору проекта удобно вести как обычные папки в облаке, а на сайте только показывать.

## Decision

Используем **Yandex.Disk через REST API** (`https://cloud-api.yandex.net/v1/disk`) как основное хранилище медиа:

- Серверная интеграция: `web/src/server/integrations/yandex-disk.ts`
- Внутренний proxy `/yadisk-api/*` для безопасной выдачи приватных ссылок и обхода 403
- Кастомная страница `/admin/yadisk` — UI менеджер Яндекс-облака внутри Payload-админки
- Авто-подгрузка галерей по пути на диске (поле `Projects.galleryYandexFolder`)

## Alternatives considered

- **AWS S3 / MinIO** — стандарт индустрии, но требует AWS-аккаунта (для российского пользователя — головная боль с оплатой и санкциями), CDN для дешёвой раздачи, и админ не зайдёт в файлы через знакомый интерфейс.
- **Uploads на локальный диск VPS** — простейший вариант, но: VPS-диск ограничен (~25 ГБ), бэкапа нет, при переезде на другой сервер вся медиа теряется.
- **Cloudinary / Imgix** — отлично по DX, но платно за каждый GB трафика. Для проекта с растущей галереей бюджет быстро выйдет за рамки бесплатного тира.
- **Только Payload `payload-cloud`** — vendor lock-in на инфраструктуру Payload, нет лёгкого доступа к файлам.

## Consequences

### Положительные

- **Бесплатно** для текущих объёмов (10 ГБ в стандартном Яндекс-диске, легко расширяется через Яндекс.360).
- **Знакомый интерфейс** — автор может зайти на disk.yandex.ru с телефона и положить фотки в папку проекта.
- **Авто-галерея проектов** — папка на диске = галерея на сайте, без ручного загрузки в админку.
- **Trash retention** — Яндекс-корзина даёт восстановление случайно удалённых файлов 30 дней.

### Отрицательные

- **Rate limits VK-стиля** — Yandex API ограничивает запросы; для активной галереи нужен кэш и/или batched API.
- **Приватные ссылки дают 403** при прямом обращении из браузера → пришлось делать proxy `/yadisk-api/preview`.
- **Нет CDN** — каждый посетитель тянет файл с серверов Яндекса напрямую; для холодных файлов первая загрузка медленная.
- **Авторизация через OAuth-токен** в env (`YANDEX_DISK_TOKEN`) — токен периодически нужно ротировать.

### Нейтральные

- Нужно знать специфику Yandex Disk API (ETag-like `resource_id` вместо классических ETag, особенности trash, public-links). Документация — на русском, что для команды плюс, для иностранного контрибьютора минус.

## References

- `web/src/server/integrations/yandex-disk.ts` — основная интеграция
- `web/src/server/integrations/yandex-disk-gallery.ts` — авто-галерея
- `web/src/components/Gallery/YandexGallerySection.tsx` — frontend
- `web/src/app/api/media/file/[id]/route.ts` — proxy endpoint (PR #24)
- `web/src/collections/Media.ts` — afterRead → endpoint, afterChange удаляет локал (PR #24, #26)
- `web/scripts/clean-media-cache.ts` + `deploy/systemd/gonba-media-cache.{service,timer}` — TTL-чистка кэша (PR #27)
- `web/scripts/migrate-media-to-yandex.ts` — защитная сетка для orphan-записей (PR #28)
- [Yandex Disk REST API docs](https://yandex.ru/dev/disk/rest/)

## Implementation notes

После реализации (нитка plan'а `docs/plans/media-to-yadisk.md`, 2026-05-22) фактическая раскладка:

- **Я.Диск — единственный долгосрочный источник** медиа. Все 333 записи Media на проде имеют `yandexPath`.
- **Локальный VPS — TTL-кэш** в `MEDIA_CACHE_DIR` (default `web/public/media-cache`). Лениво заполняется на cache-miss через `/api/media/file/[id]`. Чистится ежедневно systemd-таймером `gonba-media-cache.timer` для файлов с `max(atime, mtime)` > 30 дней.
- **Раздача файлов** идёт через proxy `/api/media/file/[id]`, не через прямые публичные ссылки Я.Диска — это обходит ротацию public links и даёт стабильный CDN-friendly URL с правильным `Cache-Control: immutable`.
- **Legacy `public/media`** при первом proxy-запросе работает как fallback-кэш (HIT-LEGACY) — постепенно теряет файлы (новые записи сразу удаляются по phase-3), но не критично — TTL-cron подметает оставшиеся.
