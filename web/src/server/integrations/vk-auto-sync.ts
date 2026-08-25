import crypto from 'crypto'

import type { Payload } from 'payload'
import type { Post } from '@/payload-types'

import { parseVkCommunityIdentifier } from './vk-auto-sync-resolve'
import { classifyVkPost } from './vk-classifier'
import { gatewayCall, isGatewayConfigured } from './vk-gateway'

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
  /** 'post' | 'copy' | 'reply' | 'postpone' | 'suggest' | 'post_ads' по схеме VK. */
  post_type?: string
  /**
   * Пометка «рекламная запись», которую ставит САМО сообщество. По схеме VK это
   * base_bool_int (0/1), но проверяем на истинность, а не `=== 1`: если шлюз
   * когда-нибудь пойдёт на другой версии API и поле приедет boolean — фильтр
   * обязан продолжить работать, а не молча пропустить рекламу.
   */
  marked_as_ads?: 0 | 1
  /** Непустой массив = это репост чужой записи, а не собственный текст сообщества. */
  copy_history?: unknown[]
  is_deleted?: boolean
  attachments?: Array<{
    type: string
    photo?: {
      sizes: Array<{ type: string; url: string; width: number; height: number }>
    }
  }>
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
  count: number = 10,
): Promise<VkWallPost[]> {
  if (!isGatewayConfigured()) {
    throw new Error('SARAFAN_GATEWAY_KEY не задан: прямой доступ через VK_TOKEN_* запрещён')
  }

  const response = await gatewayCall<{ count: number; items: VkWallPost[] }>('wall.get', {
    owner_id: ownerId,
    count: Math.min(count, 10),
    filter: 'owner',
    extended: 0,
  })
  return response.items ?? []
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

export type VkPostRejection = { id: number; reason: string }

export type VkPostSelection = {
  /** Первый годный пост, либо undefined. */
  post?: VkWallPost
  /**
   * Посты, отклонённые ПО СОДЕРЖАНИЮ. Сюда НЕ попадают рутинные пропуски
   * («уже импортирован», «пустой текст») — только то, о чём стоит сказать в
   * журнале, иначе отфильтрованная реклама неотличима от тишины в сообществе.
   */
  rejected: VkPostRejection[]
}

/**
 * Почему пост не годится для публикации на сайте. `null` = годится.
 *
 * Проверки идут от самых надёжных к менее надёжным:
 * `marked_as_ads` и `copy_history` прямо описаны в схеме VK, а `post_type`
 * сверяется только когда он реально пришёл — если шлюз ходит на версии API,
 * где поля нет, строгое `post_type !== 'post'` отбросило бы вообще всё и
 * остановило импорт молча, под видом «в сообществе тишина».
 */
export function vkPostRejectionReason(post: VkWallPost): string | null {
  if (post.marked_as_ads) return 'реклама, помеченная сообществом'
  if (Array.isArray(post.copy_history) && post.copy_history.length > 0) {
    // Репост опаснее рекламы: в тело, заголовок и SEO-описание попадёт ТОЛЬКО
    // текст комментария, а сама пересказанная запись и её фото потеряются.
    // На публичном сайте это и бессмысленная новость, и присвоение чужого.
    return 'репост чужой записи'
  }
  if (post.is_deleted === true) return 'запись удалена в VK'
  if (post.post_type && post.post_type !== 'post') return `служебный тип записи (${post.post_type})`
  return null
}

/**
 * Выбирает самый старый ещё не импортированный текстовый пост из окна wall.get.
 * VK возвращает стену от новых записей к старым; выбор первого элемента раньше
 * перескакивал через накопившийся хвост и мог навсегда оставить посты позади.
 *
 * Отклонённый пост НЕ двигает курсор — и это правильно: он останется в окне и
 * будет отклоняться снова, пока не появится годный, после чего курсор
 * перешагнёт обоих. Запереть источник это не может, потому что отсев идёт на
 * выборе, а не после создания записи.
 */
export function selectNextVkPost(posts: VkWallPost[], lastSyncedPostId: number): VkPostSelection {
  const candidates = posts
    .filter((post) => post.id > lastSyncedPostId && post.text?.trim().length > 0)
    .sort((a, b) => a.id - b.id)

  const rejected: VkPostRejection[] = []
  for (const post of candidates) {
    const reason = vkPostRejectionReason(post)
    if (!reason) return { post, rejected }
    rejected.push({ id: post.id, reason })
  }
  return { rejected }
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

    // Получаем посты только через шлюз SARAFAN: отзыв gateway key обязан
    // действительно отзывать доступ GONBA к VK.
    const posts = await fetchVkPosts(ownerId, 10)

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

    // Разбираем доступный хвост от старых записей к новым, не перескакивая очередь.
    const lastId = lastSyncedPostId || 0
    const { post: newPost, rejected } = selectNextVkPost(posts, lastId)

    // Не молчать про отсев: без этой строки первая же отфильтрованная реклама
    // выглядит ровно как «в сообществе ничего нового», и мы никогда не узнаем,
    // работает фильтр или просто тишина.
    for (const skip of rejected) {
      payload.logger.info(`[vk-auto-sync] источник ${sourceId}: пост ${skip.id} отклонён — ${skip.reason}`)
    }

    if (!newPost) {
      // Различаем «нечего брать» и «взять было что, но всё отсеяли»: иначе
      // владелец не отличит тишину в сообществе от работы фильтра.
      const detail = rejected.length
        ? `Годных постов нет: отклонено ${rejected.length} (${rejected.map((r) => r.reason).join(', ')})`
        : 'Все посты уже импортированы'
      await payload.update({
        collection: 'vk-auto-sync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'no-new-posts',
          lastSyncAt: new Date().toISOString(),
          syncLog: [logEntry('no-new-posts', detail), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: true, status: 'no-new-posts', message: detail }
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

    const [activeProjects, categories] = await Promise.all([
      payload.find({
        collection: 'projects',
        overrideAccess: true,
        limit: 100,
        depth: 0,
        where: { isActive: { equals: true }, _status: { equals: 'published' } },
      }),
      payload.find({ collection: 'categories', overrideAccess: true, limit: 100, depth: 0 }),
    ])

    // Заголовок используется и для slug, и для классификации. Ограничиваем
    // входной текст ниже в классификаторе, чтобы большой VK-пост не раздувал
    // запрос к провайдеру.
    const cleanTitleSrc = stripVkMarkup(newPost.text)
    const title = cleanTitleSrc.length > 80 ? cleanTitleSrc.substring(0, 80).trim() + '...' : cleanTitleSrc
    const classifier = await classifyVkPost({
      title,
      text: stripVkMarkup(newPost.text),
      sourceProjectSlug: String(project.slug),
      projects: activeProjects.docs.map((candidate) => ({
        slug: String(candidate.slug),
        title: String(candidate.title),
        summary: candidate.summary,
      })),
      categories: categories.docs.map((category) => String(category.slug)),
    })

    const projectBySlug = new Map(activeProjects.docs.map((candidate) => [String(candidate.slug), candidate]))
    const selectedProjects = classifier.projectSlugs
      .map((slug) => projectBySlug.get(slug))
      .filter((candidate): candidate is (typeof activeProjects.docs)[number] => Boolean(candidate))
    const primaryProject = selectedProjects[0] || project
    const relatedProjectIds = selectedProjects
      .slice(1)
      .map((candidate) => Number(candidate.id))
      .filter((id) => Number.isFinite(id))

    if (classifier.usedFallback) {
      payload.logger.warn(`[vk-auto-sync] classifier fallback for ${groupId}/${newPost.id}: ${classifier.rationale}`)
    }

    // Находим или создаём категорию для секции
    const categoryIds: number[] = []
    if (sectionSlug) {
      const sourceCategory = categories.docs.find((category) => category.slug === sectionSlug)
      if (sourceCategory) {
        categoryIds.push(Number(sourceCategory.id))
      } else {
        const catDoc = await payload.create({
          collection: 'categories',
          overrideAccess: true,
          data: {
            title: sectionSlug,
            slug: sectionSlug,
          },
        })
        categoryIds.push(typeof catDoc.id === 'number' ? catDoc.id : Number(catDoc.id))
      }
    }

    const categoryBySlug = new Map(categories.docs.map((category) => [String(category.slug), category]))
    for (const slug of classifier.categorySlugs) {
      const categoryId = categoryBySlug.get(slug)?.id
      if (categoryId != null) categoryIds.push(Number(categoryId))
    }
    const uniqueCategoryIds = [...new Set(categoryIds.filter((id) => Number.isFinite(id)))]

    // Скачиваем ВСЕ фото поста с дедупом по содержимому (не плодим дубли в облаке).
    const photoUrls = extractVkPhotoUrls(newPost)
    const runCache = new Map<string, number>()
    const photoMediaIds: number[] = []
    for (let pi = 0; pi < photoUrls.length; pi++) {
      const id = await downloadDedupMedia(payload, photoUrls[pi], `vk-${groupId}-${newPost.id}-${pi}.jpg`, runCache)
      if (id != null) photoMediaIds.push(id)
    }
    const heroImageId: number | undefined = photoMediaIds[0]

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
        project: Number(primaryProject.id),
        relatedProjects: relatedProjectIds,
        categories: uniqueCategoryIds,
        content: buildVkPostContent(newPost.text, photoMediaIds, vkPostUrl(ownerId, newPost.id)),
        ...(heroImageId ? { heroImage: heroImageId } : {}),
        meta: {
          title,
          description: stripVkMarkup(newPost.text).substring(0, 150),
          ...(heroImageId ? { image: heroImageId } : {}),
        },
        vkClassification: {
          provider: classifier.provider,
          model: classifier.model,
          projectSlugs: classifier.projectSlugs,
          categorySlugs: classifier.categorySlugs,
          rationale: classifier.rationale,
          sourceProjectSlug: String(project.slug),
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
      for (const galleryProject of selectedProjects.length > 0 ? selectedProjects : [project]) {
        try {
          await addPhotosToProjectGallery(payload, galleryProject.id, photoMediaIds)
        } catch (e) {
          payload.logger.warn(
            `[vk-auto-sync] Не удалось добавить фото в галерею проекта ${galleryProject.id}: ${String(e)}`,
          )
        }
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
        `опрошенных VK-источников не отработал успешно (все в ошибке). Проверь SARAFAN_GATEWAY_KEY, ` +
        `доступность шлюза и last_error источников. ` +
        `Ошибки: ${errored.map((r) => r.message).join(' || ').slice(0, 300)}`,
    )
  }

  return results
}
