import type { Payload } from 'payload'

const VK_API_VERSION = '5.199'

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
}

type SyncResult = {
  success: boolean
  message: string
  postId?: number
  newPostId?: number
}

/**
 * Получает посты из VK сообщества
 */
async function fetchVkPosts(groupId: number, accessToken: string, count: number = 5): Promise<VkWallPost[]> {
  const url = 'https://api.vk.com/method/wall.get'
  const params = new URLSearchParams({
    owner_id: `-${groupId}`,
    count: String(count),
    access_token: accessToken,
    v: VK_API_VERSION,
    filter: 'owner',
    extended: '0',
  })

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`VK API HTTP error: ${response.status}`)
  }

  const data = (await response.json()) as VkApiResponse

  if (data.error) {
    throw new Error(`VK API error: ${data.error.error_msg} (${data.error.error_code})`)
  }

  return data.response.items
}

/**
 * Скачивает изображение из VK и создаёт Media запись
 */
async function downloadAndCreateMedia(
  payload: Payload,
  imageUrl: string,
  filename: string,
): Promise<number | null> {
  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return null

    const blob = await imageResponse.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    const mediaDoc = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: {
        alt: filename,
        caption: '',
      },
      file: {
        data: buffer,
        name: filename,
        mimetype: 'image/jpeg',
        size: buffer.length,
      },
    })

    return typeof mediaDoc.id === 'number' ? mediaDoc.id : Number(mediaDoc.id)
  } catch {
    return null
  }
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
 * Создаёт Rich Text из обычного текста
 */
function richTextFromText(text: string) {
  if (!text || !text.trim()) {
    return {
      root: {
        type: 'root',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    }
  }

  const paragraphs = text.split('\n').filter((line) => line.trim())

  return {
    root: {
      type: 'root',
      children: paragraphs.map((paragraph) => ({
        type: 'paragraph',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: paragraph.trim(),
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/**
 * Основная функция синхронизации одного источника VK
 */
export async function syncVkSource(
  payload: Payload,
  sourceId: number | string,
): Promise<SyncResult> {
  const logEntry = (status: SyncResult['success'] extends true ? 'success' : 'error' | 'no-new-posts' | 'skipped', message: string, postId?: number) => ({
    timestamp: new Date().toISOString(),
    status,
    message,
    postId: postId ?? null,
  })

  try {
    // Получаем конфигурацию источника
    const sourceDoc = await payload.findByID({
      collection: 'vkAutoSync',
      id: sourceId,
      overrideAccess: true,
    })

    if (!sourceDoc) {
      return { success: false, message: 'Источник не найден' }
    }

    if (!sourceDoc.isEnabled) {
      return { success: false, message: 'Источник отключён' }
    }

    const { groupId, accessToken, sectionSlug, projectSlug, postType, lastSyncedPostId, syncIntervalHours } = sourceDoc

    // Проверяем, прошло ли достаточно времени с последней синхронизации
    if (sourceDoc.lastSyncAt) {
      const lastSync = new Date(sourceDoc.lastSyncAt).getTime()
      const now = Date.now()
      const intervalMs = (syncIntervalHours || 3) * 60 * 60 * 1000
      if (now - lastSync < intervalMs) {
        return { success: false, message: `Ещё не прошло ${syncIntervalHours}ч с последней проверки` }
      }
    }

    // Получаем посты из VK
    const posts = await fetchVkPosts(groupId, accessToken, 5)

    if (!posts || posts.length === 0) {
      await payload.update({
        collection: 'vkAutoSync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'no-new-posts',
          lastSyncAt: new Date().toISOString(),
          syncLog: [logEntry('no-new-posts', 'Нет постов в сообществе'), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: true, message: 'Нет новых постов' }
    }

    // Находим первый пост, который ещё не был импортирован
    const lastId = lastSyncedPostId || 0
    const newPost = posts.find((p) => p.id > lastId && p.text && p.text.trim().length > 0)

    if (!newPost) {
      await payload.update({
        collection: 'vkAutoSync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'no-new-posts',
          lastSyncAt: new Date().toISOString(),
          syncLog: [logEntry('no-new-posts', 'Все посты уже импортированы'), ...(sourceDoc.syncLog || [])].slice(0, 50),
        },
      })
      return { success: true, message: 'Все посты уже импортированы' }
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

    // Скачиваем первое изображение (если есть)
    let heroImageId: number | undefined
    if (newPost.attachments && newPost.attachments.length > 0) {
      const photoAttachment = newPost.attachments.find((a) => a.type === 'photo')
      if (photoAttachment?.photo?.sizes) {
        const largestSize = photoAttachment.photo.sizes.reduce((prev, curr) =>
          curr.width > prev.width ? curr : prev,
        )
        heroImageId = await downloadAndCreateMedia(
          payload,
          largestSize.url,
          `vk-${newPost.id}-${Date.now()}.jpg`,
        )
      }
    }

    // Формируем заголовок из первых 60 символов текста
    const title = newPost.text.length > 60 ? newPost.text.substring(0, 60).trim() + '...' : newPost.text
    const slugBase = generateSlug(title)
    const slug = `${slugBase}-${newPost.id}`

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
        content: richTextFromText(newPost.text),
        ...(heroImageId ? { heroImage: heroImageId } : {}),
        meta: {
          title,
          description: newPost.text.substring(0, 150),
          ...(heroImageId ? { image: heroImageId } : {}),
        },
        _status: 'published',
      },
      context: {
        disableRevalidate: true,
      },
    })

    const createdPostId = typeof postDoc.id === 'number' ? postDoc.id : Number(postDoc.id)

    // Обновляем источник
    const newTotal = (sourceDoc.totalImported || 0) + 1
    await payload.update({
      collection: 'vkAutoSync',
      id: sourceId,
      overrideAccess: true,
      data: {
        lastSyncedPostId: newPost.id,
        lastSyncStatus: 'success',
        lastSyncAt: new Date().toISOString(),
        totalImported: newTotal,
        syncLog: [logEntry('success', `Импортирован пост #${newPost.id}`, createdPostId), ...(sourceDoc.syncLog || [])].slice(0, 50),
      },
    })

    return {
      success: true,
      message: `Импортирован пост #${newPost.id} → пост CMS #${createdPostId}`,
      postId: newPost.id,
      newPostId: createdPostId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    try {
      await payload.update({
        collection: 'vkAutoSync',
        id: sourceId,
        overrideAccess: true,
        data: {
          lastSyncStatus: 'error',
          lastSyncAt: new Date().toISOString(),
          lastError: errorMessage,
          syncLog: [{
            timestamp: new Date().toISOString(),
            status: 'error',
            message: errorMessage,
            postId: null,
          }, ...(await payload.findByID({ collection: 'vkAutoSync', id: sourceId, overrideAccess: true })).syncLog || []].slice(0, 50),
        },
      })
    } catch {
      // ignore
    }

    return { success: false, message: errorMessage }
  }
}

/**
 * Запускает синхронизацию всех активных источников
 */
export async function syncAllVkSources(payload: Payload): Promise<SyncResult[]> {
  const sources = await payload.find({
    collection: 'vkAutoSync',
    overrideAccess: true,
    limit: 100,
    where: {
      isEnabled: { equals: true },
    },
  })

  const results: SyncResult[] = []

  for (const source of sources.docs) {
    const result = await syncVkSource(payload, source.id)
    results.push(result)
  }

  return results
}
