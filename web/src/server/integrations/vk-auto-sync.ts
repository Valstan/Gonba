import crypto from 'crypto'

import type { Payload } from 'payload'
import type { Post } from '@/payload-types'

import { parseVkCommunityIdentifier } from './vk-auto-sync-resolve'
import { gatewayCall, isGatewayConfigured } from './vk-gateway'

const VK_API_VERSION = '5.199'

/**
 * Задержка между запросами к VK API (мс)
 * VK limit: 3 запроса/сек для user tokens, 20 для service
 * Ставим 1000мс — безопасно, 1 запрос в секунду
 */
const VK_API_DELAY_MS = Number(process.env.VK_IMPORT_DELAY_MS || 1000)


type VkWallPost = {
  id: number
  date: number
  text: string
  owner_id: number
  from_id: number
  post_type?: string
  attachments?: Array<{
    type: string
    photo?: {
      sizes: Array<{ type: string; url: string; width: number; height: number }>
    }
  }>
}

type VkApiResponse = {
  response: {
    count: number
    items: VkWallPost[]
  }
  error?: {
    error_code: number
    error_msg: string
  }
}

type SyncStatus = 'success' | 'error' | 'no-new-posts' | 'skipped' | 'pending'

type SyncResult = {
  success: boolean
  message: string
  /**
   * Машиночитаемый исход прогона одного источника. Нужен для health-мониторинга
   * в syncAllVkSources: `success`/`no-new-posts` = источник реально опрошен и жив,
   * `error` = упал (часто — протухший VK-токен), `skipped` = не опрашивался
   * (отключён / не прошёл интервал), `pending` = нет groupId (ждёт токен).
   */
  status: SyncStatus
  postId?: number
  newPostId?: number
}

/**
 * Получает доступные VK-токены из окружения
 * Возвращает пул токенов для ротации
 */
function getVkTokenPool(): string[] {
  const tokens: string[] = []

  // Основные токены
  const valstan = process.env.VK_TOKEN_VALSTAN
  const vita = process.env.VK_TOKEN_VITA
  const generic = process.env.VK_TOKEN

  if (valstan) tokens.push(valstan)
  if (vita) tokens.push(vita)
  if (generic && !tokens.includes(generic)) tokens.push(generic)

  // Токены для конкретных групп: VK_TOKEN_{groupId}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VK_TOKEN_') && !['VK_TOKEN_VALSTAN', 'VK_TOKEN_VITA', 'VK_TOKEN'].includes(key)) {
      if (value && !tokens.includes(value)) {
        tokens.push(value)
      }
    }
  }

  return tokens.length > 0 ? tokens : ['']
}

/**
 * Безопасная задержка между запросами
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Получает посты со стены VK с обработкой ошибок и retry.
 *
 * @param ownerId знаковый `owner_id` для wall.get: сообщество — отрицательный
 *   (`-groupId`), личная страница — положительный (`+userId`). Считается в
 *   syncVkSource из типа источника (parseVkCommunityIdentifier).
 */
async function fetchVkPosts(
  ownerId: number,
  preferredToken: string,
  count: number = 3,
  retries: number = 2,
): Promise<VkWallPost[]> {
  // Приоритет — шлюз SARAFAN (если задан ключ): он исполняет wall.get своим токеном
  // со своего IP, обходя IP-binding/баны наших локальных токенов. Токен/версию API
  // подставляет сам шлюз. Ошибка шлюза пробрасывается (прогон пометится error) —
  // на локальные токены НЕ откатываемся (они и так протухли, это лишний шум/бан-риск).
  if (isGatewayConfigured()) {
    const response = await gatewayCall<{ count: number; items: VkWallPost[] }>('wall.get', {
      owner_id: ownerId,
      count: Math.min(count, 10),
      filter: 'owner',
      extended: 0,
    })
    return response.items ?? []
  }

  const tokenPool = getVkTokenPool()

  // Если preferredToken заблокирован, пробуем другие
  const tokensToTry = preferredToken && tokenPool.includes(preferredToken)
    ? [preferredToken, ...tokenPool.filter((t) => t !== preferredToken)]
    : tokenPool

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (let i = 0; i < tokensToTry.length; i++) {
      const token = tokensToTry[(attempt + i) % tokensToTry.length]
      if (!token) continue

      // Задержка между попытками
      if (attempt > 0 || i > 0) {
        await sleep(VK_API_DELAY_MS * (attempt + 1))
      }

      try {
        const url = 'https://api.vk.com/method/wall.get'
        const params = new URLSearchParams({
          owner_id: String(ownerId),
          count: String(Math.min(count, 10)), // макс 10 за раз
          access_token: token,
          v: VK_API_VERSION,
          filter: 'owner',
          extended: '0',
        })

        const response = await fetch(`${url}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          if (attempt < retries) continue
          throw new Error(`VK API HTTP error: ${response.status}`)
        }

        const data = (await response.json()) as VkApiResponse

        if (data.error) {
          // Error 5: User authorization failed — токен недействителен
          // Error 8: Application is blocked — приложение заблокировано
          // Error 14: Captcha needed — слишком много запросов
          const { error_code, error_msg } = data.error
          if (error_code === 5 || error_code === 8 || error_code === 14) {
            continue // пробуем следующий токен
          }
          if (attempt < retries) continue
          throw new Error(`VK API error: ${error_msg} (${error_code})`)
        }

        return data.response.items
      } catch (err) {
        // Если последний токен и все попытки исчерпаны — пробрасываем ошибку
        if (i === tokensToTry.length - 1 && attempt >= retries) {
          throw err
        }
        // Иначе пробуем следующий токен
      }
    }
  }

  throw new Error('Все VK-токены исчерпаны или заблокированы')
}

/**
 * Генерирует slug из текста (транслитерация)
 */
function generateSlug(text: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
  }

  return text
    .toLowerCase()
    .split('')
    .map((char) => translit[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

/**
 * Убирает VK-разметку упоминаний из текста: `[club226176537|Название]`,
 * `[id123|Имя]`, `[public..|..]`, `[https://..|текст]` → остаётся только
 * человекочитаемая часть («Название»). Делает посты/заголовки опрятными.
 */
export function stripVkMarkup(text: string): string {
  if (!text) return text
  return text.replace(/\[[^\]|]+\|([^\]]+)\]/g, '$1')
}

/** URL поста VK по знаковому owner_id и id поста: vk.com/wall<owner>_<post>. */
export function vkPostUrl(ownerId: number, postId: number): string {
  return `https://vk.com/wall${ownerId}_${postId}`
}

/**
 * Идемпотентность VK-постов по СТАБИЛЬНОМУ ключу `vk-<groupId>-<postId>`, а не по
 * полному slug. Полный slug несёт text-suffix (`vk-123-41-privet`), который меняется
 * при правке текста / смене формата генерации → совпадение по полному slug пропускало
 * старый импорт и плодило дубль (как 19→25 мая). Якорный матч: slug РАВЕН stable либо
 * начинается со `stable + '-'` (разделитель суффикса). Хвостовой `-` обязателен —
 * иначе `vk-123-41` ложно совпал бы с `vk-123-417`. Чистая функция (юнит-тест без БД);
 * применяется поверх `like`-кандидатов (Payload `like` = contains, грубый отбор).
 */
export function matchesStableVkSlug(slug: string | null | undefined, slugStable: string): boolean {
  if (!slug) return false
  return slug === slugStable || slug.startsWith(`${slugStable}-`)
}

/** Все фото-вложения поста → массив URL самого крупного размера каждого фото. */
export function extractVkPhotoUrls(post: VkWallPost): string[] {
  if (!post.attachments) return []
  const urls: string[] = []
  for (const att of post.attachments) {
    if (att.type !== 'photo' || !att.photo?.sizes?.length) continue
    const largest = att.photo.sizes.reduce((prev, curr) => (curr.width > prev.width ? curr : prev))
    if (largest?.url) urls.push(largest.url)
  }
  return urls
}

/**
 * Скачивает фото и создаёт Media, НО дедуплицирует по содержимому: считает
 * sha256 байтов и переиспользует существующую запись Media с тем же
 * `yandexSha256` (= sha файла на Я.Диске) → не плодит дубли в облаке.
 * `runCache` (sha→id) защищает от дублей в рамках одного прогона (до того как
 * afterChange успел проставить yandexSha256).
 */
export async function downloadDedupMedia(
  payload: Payload,
  imageUrl: string,
  filename: string,
  runCache: Map<string, number>,
): Promise<number | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await (await res.blob()).arrayBuffer())
    const sha = crypto.createHash('sha256').update(buffer).digest('hex')

    if (runCache.has(sha)) return runCache.get(sha) as number

    const existing = await payload.find({
      collection: 'media',
      where: { yandexSha256: { equals: sha } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      const id = Number(existing.docs[0].id)
      runCache.set(sha, id)
      return id
    }

    const doc = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: filename },
      file: { data: buffer, name: filename, mimetype: 'image/jpeg', size: buffer.length },
    })
    const id = Number(doc.id)
    runCache.set(sha, id)
    return id
  } catch {
    return null
  }
}

function lexTextNode(text: string) {
  return { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }
}

/**
 * Строит content поста: абзацы текста (с очисткой VK-разметки) + все фото
 * (upload-узлы, видны лентой в теле) + ссылка-призыв «Почитать в ВК» в конце
 * (завлекаем подписчиков в VK). Требует UploadFeature/LinkFeature в defaultLexical.
 */
export function buildVkPostContent(text: string, photoMediaIds: number[], sourceUrl: string | null): Post['content'] {
  const cleaned = stripVkMarkup(text || '')
  const children: Record<string, unknown>[] = []

  for (const line of cleaned.split('\n')) {
    const t = line.trim()
    if (!t) continue
    children.push({
      type: 'paragraph',
      children: [lexTextNode(t)],
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      version: 1,
    })
  }

  for (const id of photoMediaIds) {
    children.push({ type: 'upload', version: 3, relationTo: 'media', value: id, fields: {}, format: '' })
  }

  if (sourceUrl) {
    children.push({
      type: 'paragraph',
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      version: 1,
      children: [
        {
          type: 'link',
          version: 3,
          direction: 'ltr',
          format: '',
          indent: 0,
          fields: { linkType: 'custom', url: sourceUrl, newTab: true },
          children: [lexTextNode('Почитать в ВК')],
        },
      ],
    })
  }

  return {
    root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 },
  } as Post['content']
}

/** Добавляет media в галерею проекта без дублей (по id). */
export async function addPhotosToProjectGallery(
  payload: Payload,
  projectId: number | string,
  mediaIds: number[],
): Promise<void> {
  if (mediaIds.length === 0) return
  const project = await payload.findByID({ collection: 'projects', id: projectId, depth: 0, overrideAccess: true })
  const current = Array.isArray((project as { gallery?: Array<{ image?: number | string }> }).gallery)
    ? (project as { gallery: Array<{ image?: number | string }> }).gallery
    : []
  const existingIds = new Set(current.map((g) => Number(typeof g.image === 'object' ? (g.image as { id?: number }).id : g.image)))
  const toAdd = mediaIds.filter((id) => !existingIds.has(id))
  if (toAdd.length === 0) return
  const gallery = [
    ...current.map((g) => ({ image: typeof g.image === 'object' ? (g.image as { id?: number }).id : g.image })),
    ...toAdd.map((id) => ({ image: id })),
  ]
  await payload.update({
    collection: 'projects',
    id: projectId,
    data: { gallery, _status: 'published' } as Record<string, unknown>,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
}

/**
 * Основная функция синхронизации одного источника VK
 */
export async function syncVkSource(
  payload: Payload,
  sourceId: number | string,
): Promise<SyncResult> {
  const logEntry = (status: 'success' | 'error' | 'no-new-posts' | 'skipped', message: string, postId?: number) => ({
    timestamp: new Date().toISOString(),
    status,
    message,
    postId: postId ?? null,
  })

  try {
    // Получаем конфигурацию источника
    const sourceDoc = await payload.findByID({
      collection: 'vk-auto-sync',
      id: sourceId,
      overrideAccess: true,
    })

    if (!sourceDoc) {
      return { success: false, status: 'error', message: 'Источник не найден' }
    }

    if (!sourceDoc.isEnabled) {
      return { success: false, status: 'skipped', message: 'Источник отключён' }
    }

    const { groupId, sectionSlug, projectSlug, postType, lastSyncedPostId, syncIntervalHours } = sourceDoc

    // groupId теперь опциональный — пока его не подтянули из VK API (например, токен не задан),
    // синхронизация постов невозможна. Не падаем — просто помечаем и ждём токен/новой записи.
    if (!groupId) {
      const message = 'Не указан ID группы VK. Добавьте токен и сохраните источник, чтобы система подтянула ID автоматически.'
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'pending',
          lastError: message,
          lastSyncAt: new Date().toISOString(),
          syncLog: [logEntry('skipped', message), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: false, status: 'pending', message }
    }

    // Проверяем, прошло ли достаточно времени с последней синхронизации
    if (sourceDoc.lastSyncAt) {
      const lastSync = new Date(sourceDoc.lastSyncAt).getTime()
      const now = Date.now()
      const intervalMs = (syncIntervalHours || 3) * 60 * 60 * 1000
      if (now - lastSync < intervalMs) {
        return { success: false, status: 'skipped', message: `Ещё не прошло ${syncIntervalHours}ч с последней проверки` }
      }
    }

    // Знак owner_id для wall.get выводим из URL источника: сообщество —
    // отрицательный (-groupId), личная страница (vk.com/idN) — положительный
    // (+userId). Тип не хранится отдельным полем, чтобы не плодить миграцию;
    // числовой id лежит в `groupId` (для user-страниц это userId).
    // Edge: личная страница, заведённая через короткое имя (vk.com/<name>, без
    // префикса id) определится как сообщество — для неё нужен URL вида vk.com/idN.
    const ident = parseVkCommunityIdentifier(sourceDoc.communityUrl)
    const ownerId = ident?.kind === 'user' ? Math.abs(groupId) : -Math.abs(groupId)

    // Получаем посты из VK с ротацией токенов
    // Используем accessToken из конфига как preferred, но fallback на пул
    const posts = await fetchVkPosts(ownerId, sourceDoc.accessToken || '', 3)

    if (!posts || posts.length === 0) {
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'no-new-posts',
          lastSyncAt: new Date().toISOString(),
          lastError: null, // здоровый прогон — чистим возможный stale-текст ошибки
          syncLog: [logEntry('no-new-posts', 'Нет постов в сообществе'), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: true, status: 'no-new-posts', message: 'Нет новых постов' }
    }

    // Находим первый пост, который ещё не был импортирован
    const lastId = lastSyncedPostId || 0
    const newPost = posts.find((p) => p.id > lastId && p.text && p.text.trim().length > 0)

    if (!newPost) {
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'no-new-posts',
          lastSyncAt: new Date().toISOString(),
          syncLog: [logEntry('no-new-posts', 'Все посты уже импортированы'), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: true, status: 'no-new-posts', message: 'Все посты уже импортированы' }
    }

    // Находим проект
    const projectRes = await payload.find({
      collection: 'projects',
      overrideAccess: true,
      limit: 1,
      where: {
        slug: { equals: projectSlug },
      },
    })

    const project = projectRes.docs[0]
    if (!project) {
      throw new Error(`Проект "${projectSlug}" не найден`)
    }

    // Находим или создаём категорию для секции
    let categoryId: number | undefined
    if (sectionSlug) {
      const catRes = await payload.find({
        collection: 'categories',
        overrideAccess: true,
        limit: 1,
        where: {
          slug: { equals: sectionSlug },
        },
      })

      if (catRes.docs[0]) {
        categoryId = typeof catRes.docs[0].id === 'number' ? catRes.docs[0].id : Number(catRes.docs[0].id)
      } else {
        const catDoc = await payload.create({
          collection: 'categories',
          overrideAccess: true,
          data: {
            title: sectionSlug,
            slug: sectionSlug,
          },
        })
        categoryId = typeof catDoc.id === 'number' ? catDoc.id : Number(catDoc.id)
      }
    }

    // Скачиваем ВСЕ фото поста с дедупом по содержимому (не плодим дубли в облаке).
    const photoUrls = extractVkPhotoUrls(newPost)
    const runCache = new Map<string, number>()
    const photoMediaIds: number[] = []
    for (let pi = 0; pi < photoUrls.length; pi++) {
      const id = await downloadDedupMedia(payload, photoUrls[pi], `vk-${groupId}-${newPost.id}-${pi}.jpg`, runCache)
      if (id != null) photoMediaIds.push(id)
    }
    const heroImageId: number | undefined = photoMediaIds[0]

    // Заголовок: очищаем VK-разметку [club..|Имя] → Имя, затем обрезаем до 80.
    const cleanTitleSrc = stripVkMarkup(newPost.text)
    const title = cleanTitleSrc.length > 80 ? cleanTitleSrc.substring(0, 80).trim() + '...' : cleanTitleSrc

    // Slug: стабильный префикс `vk-<groupId>-<postId>` гарантирует уникальность
    // между группами и между постами одной группы, даже если text-suffix пуст
    // (emoji-only / только пунктуация). Text-suffix добавляется для читаемости URL.
    const textSuffix = generateSlug(title)
    const slugStable = `vk-${groupId}-${newPost.id}`
    const slug = textSuffix
      ? `${slugStable}-${textSuffix}`.substring(0, 100).replace(/-+$/, '')
      : slugStable

    // Idempotency по СТАБИЛЬНОМУ ключу `vk-<groupId>-<postId>` (а НЕ по полному slug):
    // text-suffix или смена формата генерации не должны плодить дубль. Грубо берём
    // кандидатов через `like` (Payload `like` = contains), затем якорный отбор
    // matchesStableVkSlug — чтобы `vk-123-41` не совпал с `vk-123-417`. Найдён —
    // двигаем lastSyncedPostId, чтобы следующий запуск перешёл дальше.
    const candidates = await payload.find({
      collection: 'posts',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      select: { slug: true },
      where: { slug: { like: slugStable } },
    })
    const existingDoc = candidates.docs.find((d) =>
      matchesStableVkSlug((d as { slug?: string | null }).slug, slugStable),
    )
    if (existingDoc) {
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncedPostId: newPost.id,
          lastSyncStatus: 'success',
          lastSyncAt: new Date().toISOString(),
          lastError: null, // здоровый прогон — чистим возможный stale-текст ошибки
        },
      })
      return {
        success: true,
        status: 'success',
        message: `Пост vk_id=${newPost.id} уже импортирован ранее (slug=${(existingDoc as { slug?: string | null }).slug ?? slugStable})`,
        postId: newPost.id,
      }
    }

    // Создаём пост
    const postDoc = await payload.create({
      collection: 'posts',
      overrideAccess: true,
      data: {
        title,
        slug,
        postType: postType || 'news',
        project: typeof project.id === 'number' ? project.id : Number(project.id),
        categories: categoryId ? [categoryId] : [],
        content: buildVkPostContent(newPost.text, photoMediaIds, vkPostUrl(ownerId, newPost.id)),
        ...(heroImageId ? { heroImage: heroImageId } : {}),
        meta: {
          title,
          description: stripVkMarkup(newPost.text).substring(0, 150),
          ...(heroImageId ? { image: heroImageId } : {}),
        },
        _status: 'published',
      },
      context: {
        disableRevalidate: true,
      },
    })

    const createdPostId = typeof postDoc.id === 'number' ? postDoc.id : Number(postDoc.id)

    // Все фото поста → в галерею проекта (без дублей по media id).
    if (photoMediaIds.length > 0) {
      try {
        await addPhotosToProjectGallery(payload, project.id, photoMediaIds)
      } catch (e) {
        payload.logger.warn(`[vk-auto-sync] Не удалось добавить фото в галерею проекта ${project.id}: ${String(e)}`)
      }
    }

    // Обновляем источник (без syncLog — упрощаем)
    const newTotal = (sourceDoc.totalImported || 0) + 1
    await payload.update({
      collection: 'vk-auto-sync',
      id: sourceId,
      overrideAccess: true,
      data: {
        lastSyncedPostId: newPost.id,
        lastSyncStatus: 'success',
        lastSyncAt: new Date().toISOString(),
        totalImported: newTotal,
        lastError: null, // здоровый прогон — чистим возможный stale-текст ошибки
      },
    })

    return {
      success: true,
      status: 'success',
      message: `Импортирован пост #${newPost.id} → пост CMS #${createdPostId}`,
      postId: newPost.id,
      newPostId: createdPostId,
    }
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : String(error)

    // Payload ValidationError кладёт детальный per-field разбор в `error.data.errors`
    // (см. web/node_modules/payload/dist/errors/ValidationError.js). Без этого в
    // lastError остаётся только "Следующее поле недействительно: slug" без причины
    // (required / unique / minLength / ...).
    let details = ''
    const data = (error as { data?: { errors?: Array<{ path?: string; message?: string }> } })?.data
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      details = ' | ' + data.errors
        .map((e) => `${e.path ?? '?'}: ${e.message ?? '?'}`)
        .join('; ')
    }
    const errorMessage = (baseMessage + details).substring(0, 500)

    try {
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'error',
          lastSyncAt: new Date().toISOString(),
          lastError: errorMessage,
        },
      })
    } catch {
      // ignore
    }

    return { success: false, status: 'error', message: errorMessage }
  }
}

// ≈24ч при интервале синхронизации 3ч — как часто повторять алерт при ДЛИТЕЛЬНОМ
// сбое (heartbeat), чтобы долгий инцидент не «замолкал» после первого срабатывания.
const VK_SYNC_ALERT_HEARTBEAT_RUNS = 8

// Счётчик подряд идущих прогонов, где ВСЕ опрошенные источники упали. Живёт в
// памяти процесса gonba.service (внешний timer бьёт по одному long-running Next).
// Сбрасывается на первом здоровом прогоне и при рестарте сервиса.
let vkConsecutiveAllFailRuns = 0

/**
 * Решает, писать ли громкий `VK_SYNC_ALERT` на этом прогоне.
 *
 * Дедуп спама (раньше маркер писался на КАЖДОМ «все упали» прогоне, т.е. каждые
 * ~3ч): алертим на ВХОДЕ в состояние «все упали» (1-й провал — мгновенное
 * обнаружение, не задерживаем) и затем раз в `VK_SYNC_ALERT_HEARTBEAT_RUNS`
 * подряд-провалов (напоминание при долгом сбое), а на промежуточных — молчим.
 * Любой здоровый прогон сбрасывает счётчик.
 *
 * Чистая функция — состояние (`prevConsecutiveAllFail`) держит вызывающий, чтобы
 * логика тестировалась без модульного состояния и без БД.
 */
export function decideVkSyncAlert(input: {
  attempted: number
  errored: number
  prevConsecutiveAllFail: number
}): { allFailing: boolean; consecutiveAllFail: number; emit: boolean } {
  const allFailing = input.attempted > 0 && input.errored === input.attempted
  const consecutiveAllFail = allFailing ? input.prevConsecutiveAllFail + 1 : 0
  const emit =
    allFailing && (consecutiveAllFail === 1 || consecutiveAllFail % VK_SYNC_ALERT_HEARTBEAT_RUNS === 0)
  return { allFailing, consecutiveAllFail, emit }
}

/**
 * Запускает синхронизацию всех активных источников
 * С задержкой между источниками для защиты от rate limit
 */
export async function syncAllVkSources(payload: Payload): Promise<SyncResult[]> {
  const sources = await payload.find({
    collection: 'vk-auto-sync',
    overrideAccess: true,
    limit: 100,
    where: {
      isEnabled: { equals: true },
    },
  })

  const results: SyncResult[] = []

  for (let i = 0; i < sources.docs.length; i++) {
    const source = sources.docs[i]

    // Задержка между источниками (VK rate limit protection)
    if (i > 0) {
      await sleep(VK_API_DELAY_MS)
    }

    const result = await syncVkSource(payload, source.id)
    results.push(result)
  }

  // Health-мониторинг: майский инцидент — VK-токены протухли 27 мая, auto-sync
  // молча падал 2.5 дня (никто не смотрел last_sync_status=error). Здесь — громкий,
  // greppable маркер в лог при «ни один опрошенный источник не отработал».
  // `attempted` = источники, реально дошедшие до VK API (success / no-new-posts / error);
  // skipped (интервал/отключён) и pending (нет groupId) не считаем — они не пробовали.
  const attempted = results.filter(
    (r) => r.status === 'success' || r.status === 'no-new-posts' || r.status === 'error',
  )
  const errored = results.filter((r) => r.status === 'error')
  const decision = decideVkSyncAlert({
    attempted: attempted.length,
    errored: errored.length,
    prevConsecutiveAllFail: vkConsecutiveAllFailRuns,
  })
  vkConsecutiveAllFailRuns = decision.consecutiveAllFail
  if (decision.emit) {
    payload.logger.error(
      `[vk-auto-sync] VK_SYNC_ALERT (провал #${decision.consecutiveAllFail} подряд): ни один из ${attempted.length} ` +
        `опрошенных VK-источников не отработал успешно (все в ошибке). Вероятная причина — протухшие VK-токены ` +
        `(VK_TOKEN_VALSTAN / VK_TOKEN_VITA / VK_TOKEN_*). Проверь last_error источников. ` +
        `Ошибки: ${errored.map((r) => r.message).join(' || ').slice(0, 300)}`,
    )
  }

  return results
}
