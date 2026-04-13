import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { File } from 'payload'

const VK_API_VERSION = process.env.VK_API_VERSION || '5.199'

type PostType = 'news' | 'blog' | 'announcement' | 'story'
type ProjectType = 'deerFarm' | 'ecoHotel' | 'craftStudio' | 'travelClub' | 'productLine' | 'other'
type SectionSlug = string
type DestinationType = 'posts' | 'events' | 'services' | 'products' | 'pages'

type DestinationDecision = {
  destination: DestinationType
  score: number
  reasons: string[]
}

type QueueStatus = 'queued' | 'published' | 'discarded'

type GroupConfig = {
  id: number
  tokenEnv: string
  fallbackType: 'posts' | 'services' | 'events' | 'products'
  projectType: ProjectType
  postType?: PostType
  sectionSlugs?: SectionSlug[]
  importAsPost?: boolean
}

const sectionTopicMap = {
  'konnyy-klub-gmalyzh': 'Конный клуб г.Малмыж',
  'sadovaya-feya-gulfiya-kharisovna': 'Садовая фея Гульфия Харисовна',
} as const

type SectionProfile = {
  slug: SectionSlug
  title: string
  keywords: string[]
  projectType: ProjectType
  projectSummary?: string
}

const sectionProfiles: SectionProfile[] = [
  {
    slug: 'konnyy-klub-gmalyzh',
    title: 'Конный клуб г.Малмыж',
    projectType: 'travelClub',
    keywords: [
      'конный',
      'лошад',
      'малмыж',
      'выездка',
      'проездка',
      'троп',
      'манеж',
      'езда',
      'horse',
      'travel',
      'тревел',
    ],
  },
  {
    slug: 'sadovaya-feya-gulfiya-kharisovna',
    title: 'Садовая фея Гульфия Харисовна',
    projectType: 'craftStudio',
    keywords: [
      'сад',
      'садовый',
      'фея',
      'гульфия',
      'цвет',
      'растени',
      'ландшафт',
      'огород',
      'садов',
      'garden',
      'flower',
    ],
  },
]

const sectionProfileBySlug = new Map(sectionProfiles.map((profile) => [profile.slug, profile]))

const detectSectionsFromText = (text: string, fallbackSlugs: string[] = []) => {
  const haystack = cleanText(text).toLowerCase()
  const scoreBySlug = new Map<string, number>()

  for (const profile of sectionProfiles) {
    let score = 0
    for (const keyword of profile.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        score += 1
      }
    }
    if (score > 0) {
      scoreBySlug.set(profile.slug, score)
    }
  }

  const scored = Array.from(scoreBySlug.entries()).sort((a, b) => b[1] - a[1])
  const detected = scored.map(([slug]) => slug)

  if (!detected.length && fallbackSlugs.length > 0) {
    return fallbackSlugs.filter((slug) => slug)
  }

  return detected
}

const hasAny = (haystack: string, tokens: string[]) => {
  return tokens.some((token) => haystack.includes(token))
}

const contentTypeSignals: Record<DestinationType, string[]> = {
  posts: [
    'новост',
    'вакан',
    'расска',
    'сегодня',
    'вчера',
    'история',
    'публикац',
    'объявлен',
    'замет',
  ],
  events: [
    'мероприятие',
    'событие',
    'экскур',
    'тур',
    'мастер-класс',
    'мастер',
    'выступл',
    'праздн',
    'концерт',
    'фестиваль',
    'животновод',
    'лошади',
    'поездк',
    'вылет',
    'прогулк',
    'маршрут',
    'рекорд',
  ],
  services: [
    'услуга',
    'бронир',
    'запис',
    'заказ',
    'организ',
    'достав',
    'прожив',
    'ночев',
    'аренд',
    'пакет',
    'трансфер',
    'тренер',
    'консультац',
    'бронь',
  ],
  products: [
    'цена',
    'рубл',
    'товар',
    'прода',
    'заказыва',
    'покуп',
    'скид',
    'каталог',
    'набор',
    'слад',
    'магазин',
    'акция',
  ],
  pages: [
    'о нас',
    'что такое',
    'правила',
    'инструкция',
    'расписание',
    'контакты',
    'описание',
    'история',
    'проекте',
    'справка',
    'маршрутка',
    'сборы',
  ],
}

const detectContentDestination = (
  title: string,
  fullText: string,
  fallbackType: GroupConfig['fallbackType'],
): DestinationDecision => {
  const haystack = `${title} ${fullText}`.toLowerCase()
  const scores: Record<DestinationType, number> = {
    posts: 0,
    events: 0,
    services: 0,
    products: 0,
    pages: 0,
  }
  const reasons: string[] = []

  for (const destination of Object.keys(contentTypeSignals) as DestinationType[]) {
    const tokens = contentTypeSignals[destination]
    const hits = tokens.filter((token) => haystack.includes(token)).length
    if (hits > 0) {
      scores[destination] += Math.min(4, hits)
      reasons.push(`${destination}: ${hits}`)
    }
  }

  if (hasAny(haystack, ['сегодня', 'завтра', 'в следующ', 'дата', 'какое-то', 'начина'])) {
    scores.events += 2
    reasons.push('events:date_or_schedule_hint')
  }

  if (hasAny(haystack, ['цена', 'стоим', 'рубл', '₽'])) {
    scores.products += 1
    reasons.push('products:pricing_hint')
  }

  if (hasAny(haystack, ['бронир', 'заказ', 'запис', 'свяжитесь', 'пожалуйста', 'смотреть расписание'])) {
    scores.services += 1
    reasons.push('services:request_hint')
  }

  if (fallbackType === 'posts') scores.posts += 4
  if (fallbackType === 'events') scores.events += 3.5
  if (fallbackType === 'services') scores.services += 3.5
  if (fallbackType === 'products') scores.products += 3.5

  const ordered: Array<DestinationType> = ['pages', 'events', 'services', 'products', 'posts']
  const destination = ordered.reduce<DestinationType>((best, current) => {
    return scores[current] > scores[best] ? current : best
  }, ordered[0] as DestinationType)

  const max = scores[destination] ?? 0

  if (max === 0) {
    return {
      destination: fallbackType === 'events'
        ? 'events'
        : fallbackType === 'services'
          ? 'services'
          : fallbackType === 'products'
            ? 'products'
            : 'posts',
      score: 0,
      reasons: ['fallback'],
    }
  }

  return { destination, score: max, reasons }
}

type VkPhotoSize = {
  url: string
  width: number
  height: number
  type: string
}

type VkAttachment = {
  type: string
  photo?: {
    sizes?: VkPhotoSize[]
  }
}

type VkPost = {
  id: number
  date: number
  text: string
  attachments?: VkAttachment[]
}

const groupConfigs: GroupConfig[] = [
  {
    id: 218688001,
    tokenEnv: 'VK_TOKEN_218688001',
    fallbackType: 'posts' as const,
    projectType: 'deerFarm',
    postType: 'news',
    sectionSlugs: ['about-project'],
    importAsPost: true,
  },
  {
    id: 235385532,
    tokenEnv: 'VK_TOKEN_235385532',
    fallbackType: 'services' as const,
    projectType: 'ecoHotel',
    sectionSlugs: ['eco-hotel-booking'],
    importAsPost: true,
  },
  {
    id: 226176537,
    tokenEnv: 'VK_TOKEN_226176537',
    fallbackType: 'events' as const,
    projectType: 'travelClub',
    sectionSlugs: ['konnyy-klub-gmalyzh', 'district-excursions'],
    importAsPost: true,
  },
  {
    id: 229392127,
    tokenEnv: 'VK_TOKEN_229392127',
    fallbackType: 'events' as const,
    projectType: 'craftStudio',
    sectionSlugs: ['sadovaya-feya-gulfiya-kharisovna', 'craft-workshops-gonba'],
    importAsPost: true,
  },
  {
    id: 229001043,
    tokenEnv: 'VK_TOKEN_229001043',
    fallbackType: 'products' as const,
    projectType: 'productLine',
    sectionSlugs: ['vyatskiy-sbor'],
    importAsPost: true,
  },
]

const makeDynamicGroupConfig = (
  envIdKey: string,
  tokenEnv: string,
  fallbackType: GroupConfig['fallbackType'],
  projectType: ProjectType,
  postType?: PostType,
  sectionSlugs?: GroupConfig['sectionSlugs'],
) => {
  const rawId = process.env[envIdKey]
  const id = rawId ? Number(rawId) : NaN
  if (!Number.isFinite(id) || id <= 0) return null

  return {
    id,
    tokenEnv,
    fallbackType,
    projectType,
    postType,
    sectionSlugs,
    importAsPost: true,
  }
}

const envGroupConfigs = [
  makeDynamicGroupConfig(
    'VK_GROUP_ID_KONNYY_MALMYZH',
    'VK_TOKEN_KONNYY_MALMYZH',
    'posts',
    'travelClub',
    'news',
    ['konnyy-klub-gmalyzh'],
  ),
  makeDynamicGroupConfig(
    'VK_GROUP_ID_SADOVAYA_FEYA',
    'VK_TOKEN_SADOVAYA_FEYA',
    'posts',
    'craftStudio',
    'story',
    ['sadovaya-feya-gulfiya-kharisovna'],
  ),
].filter((config) => config !== null) as GroupConfig[]

const parseBooleanFlag = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback
  const normalized = value.toLowerCase().trim()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const postsPerGroup = Math.max(1, Number(process.env.VK_GROUP_POST_LIMIT || '50'))
const requestDelayMs = Math.max(150, Number(process.env.VK_IMPORT_DELAY_MS || '350'))
const isDryRun = process.env.VK_IMPORT_DRY_RUN === '1' || process.env.VK_IMPORT_DRY_RUN === 'true'
const isQueueOnlyMode = parseBooleanFlag(process.env.VK_IMPORT_QUEUE_ONLY, true)
const keepAutoPublishMode = parseBooleanFlag(process.env.VK_IMPORT_AUTO_PUBLISH, false)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const toSlug = (text: string) => {
  const base = text
    .toLowerCase()
    .split('')
    .map((char) => translitMap[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `vk-${Date.now()}`
}

const richTextFromText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

const buildSourceUrl = (groupId: number, postId: number) => `https://vk.com/wall-${groupId}_${postId}`

const normalizeSuggestionSections = (sections: string[]) =>
  Array.from(new Set(sections.filter(Boolean).map((section) => section.trim()).filter(Boolean)))

const findExistingContentBySlug = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string,
) => {
  const [posts, events, services, products, pages] = await Promise.all([
    payload.find({
      collection: 'posts',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
    payload.find({
      collection: 'events',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
    payload.find({
      collection: 'services',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
    payload.find({
      collection: 'products',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
    payload.find({
      collection: 'pages',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
  ])

  if (posts.docs.length) return 'posts'
  if (events.docs.length) return 'events'
  if (services.docs.length) return 'services'
  if (products.docs.length) return 'products'
  if (pages.docs.length) return 'pages'

  return null
}

const upsertVkImportQueueItem = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  entry: {
    sourceGroupId: number
    sourcePostId: number
    title: string
    text: string
    previewText: string
    heroImageId?: number
    suggestedSections: string[]
    suggestedDestination: DestinationType
    destinationDecision: DestinationDecision
    detectedDate?: number
    sourceMeta?: Record<string, unknown>
  },
) => {
  const existing = await payload.find({
    collection: 'vkImportQueue',
    where: {
      sourceGroupId: { equals: entry.sourceGroupId },
      sourcePostId: { equals: entry.sourcePostId },
    },
    overrideAccess: true,
    limit: 1,
  })

  if (existing.docs[0]?.id) {
    const current = existing.docs[0] as { id: number; status: QueueStatus }
    if (current.status !== 'queued') {
      return current.id
    }

    await payload.update({
      collection: 'vkImportQueue',
      id: current.id,
      overrideAccess: true,
      data: {
        title: entry.title,
        text: entry.text,
        previewText: entry.previewText,
        sourceUrl: buildSourceUrl(entry.sourceGroupId, entry.sourcePostId),
        heroImage: entry.heroImageId,
        suggestedSections: normalizeSuggestionSections(entry.suggestedSections).map((slug) => ({ slug })),
        suggestedDestination: entry.suggestedDestination,
        suggestedDestinationScore: entry.destinationDecision.score,
        suggestedDestinationHints: entry.destinationDecision.reasons.map((reason) => ({ item: reason })),
        detectedDate: entry.detectedDate ? new Date(entry.detectedDate * 1000).toISOString() : null,
        queuedAt: new Date().toISOString(),
        status: 'queued',
        sourceMeta: entry.sourceMeta,
      },
    })

    return current.id
  }

  await payload.create({
    collection: 'vkImportQueue',
    overrideAccess: true,
    data: {
      status: 'queued',
      sourceGroupId: entry.sourceGroupId,
      sourcePostId: entry.sourcePostId,
      sourceUrl: buildSourceUrl(entry.sourceGroupId, entry.sourcePostId),
      title: entry.title,
      text: entry.text,
      previewText: entry.previewText,
      heroImage: entry.heroImageId,
      suggestedSections: normalizeSuggestionSections(entry.suggestedSections).map((slug) => ({ slug })),
      suggestedDestination: entry.suggestedDestination,
      suggestedDestinationScore: entry.destinationDecision.score,
      suggestedDestinationHints: entry.destinationDecision.reasons.map((reason) => ({ item: reason })),
      detectedDate: entry.detectedDate ? new Date(entry.detectedDate * 1000).toISOString() : null,
      queuedAt: new Date().toISOString(),
      sourceMeta: entry.sourceMeta,
    },
  })

  return undefined
}

const fetchGroupPosts = async (groupId: number, token: string) => {
  const params = new URLSearchParams({
    owner_id: `-${groupId}`,
    count: String(postsPerGroup),
    access_token: token,
    v: VK_API_VERSION,
  })

  const res = await fetch(`https://api.vk.com/method/wall.get?${params.toString()}`)
  const data = (await res.json()) as any

  if (data.error) {
    throw new Error(`VK API error ${data.error.error_code}: ${data.error.error_msg}`)
  }

  return (data.response?.items || []) as VkPost[]
}

const cleanText = (text: string) => text.replace(/#[^\s]+/g, '').replace(/\s+/g, ' ').trim()

const getTitleAndSummary = (text: string) => {
  const clean = cleanText(text)
  const firstLine = clean.split(/\n+/)[0] || clean
  const title = firstLine.slice(0, 80) || 'Пост VK'
  const summary = clean.slice(0, 180)
  return { title, summary, fullText: clean }
}

const getBestPhotoUrl = (attachments?: VkAttachment[]) => {
  if (!attachments) return null
  for (const attachment of attachments) {
    if (attachment.type !== 'photo' || !attachment.photo?.sizes?.length) continue
    const sorted = [...attachment.photo.sizes].sort((a, b) => b.width * b.height - a.width * a.height)
    return sorted[0]?.url ?? null
  }
  return null
}

const fetchFileByURL = async (url: string): Promise<File> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }
  const data = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const nameFromUrl = url.split('/').pop() || `vk-${Date.now()}.jpg`

  return {
    name: nameFromUrl.split('?')[0] || `vk-${Date.now()}.jpg`,
    data: Buffer.from(data),
    mimetype: contentType,
    size: data.byteLength,
  }
}

const tokenPool = [
  process.env.VK_TOKEN_VALSTAN,
  process.env.VK_TOKEN_VITA,
  process.env.VK_TOKEN,
].filter(Boolean) as string[]

let tokenIndex = 0

const getTokenForGroup = (groupId: number, tokenEnv: string) => {
  const direct =
    process.env[tokenEnv] ||
    process.env[`VK_TOKEN_${groupId}`] ||
    process.env[`VK_TOKEN_GROUP_${groupId}`]

  if (direct) return direct
  if (tokenPool.length === 0) return ''

  const token = tokenPool[tokenIndex % tokenPool.length]
  tokenIndex += 1
  return token
}

const categoryCache = new Map<string, number>()

const getCategoryForSection = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  sectionSlug: string,
) => {
  if (categoryCache.has(sectionSlug)) {
    return categoryCache.get(sectionSlug)
  }

  const existing = await payload.find({
    collection: 'categories',
    overrideAccess: true,
    limit: 1,
    where: { slug: { equals: sectionSlug } },
  })

  if (existing.docs[0]?.id) {
    const id = Number(existing.docs[0].id)
    if (Number.isFinite(id)) {
      categoryCache.set(sectionSlug, id)
      return id
    }
  }

  const created = await payload.create({
    collection: 'categories',
    overrideAccess: true,
    data: {
      slug: sectionSlug,
      title: sectionTopicMap[sectionSlug as keyof typeof sectionTopicMap] || sectionSlug,
    },
  })

  const createdId = Number(created.id)
  if (Number.isFinite(createdId)) {
    categoryCache.set(sectionSlug, createdId)
    return createdId
  }

  return undefined
}

const getCategoriesBySections = async (payload: Awaited<ReturnType<typeof getPayload>>, sections: string[]) => {
  const ids = await Promise.all(sections.map((sectionSlug) => getCategoryForSection(payload, sectionSlug)))
  return ids.filter((id): id is number => Number.isFinite(id))
}

const projectCache = new Map<string, number>()

const makeProjectShortLabel = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return 'Проект'
  return normalized.length > 40 ? `${normalized.slice(0, 37)}...` : normalized
}

const upsertProjectForSection = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  sectionSlug: string,
  projectType: ProjectType,
  content: { title: string; summary: string; fullText: string; heroImageId?: number },
) => {
  if (projectCache.has(sectionSlug)) {
    return projectCache.get(sectionSlug)
  }

  const profile = sectionProfileBySlug.get(sectionSlug as SectionSlug)
  const title = profile?.title || sectionSlug
  const existingProject = await payload.find({
    collection: 'projects',
    overrideAccess: true,
    limit: 1,
    where: { slug: { equals: sectionSlug } },
  })

  const heroImage = content.heroImageId || undefined
  const data = {
    title,
    shortLabel: makeProjectShortLabel(title),
    slug: sectionSlug,
    projectType,
    summary: content.summary,
    description: richTextFromText(content.fullText),
    ...(heroImage ? { heroImage } : {}),
    isActive: true,
  }

  if (existingProject.docs.length) {
    const id = existingProject.docs[0]!.id
    await payload.update({
      collection: 'projects',
      id,
      overrideAccess: true,
      data,
      context: {
        disableRevalidate: true,
      },
    })
    projectCache.set(sectionSlug, Number(id))
    return Number(id)
  }

  const createdProject = await payload.create({
    collection: 'projects',
    overrideAccess: true,
    data,
    context: {
      disableRevalidate: true,
    },
  })
  const createdProjectId = Number(createdProject.id)
  if (Number.isFinite(createdProjectId)) {
    projectCache.set(sectionSlug, createdProjectId)
    return createdProjectId
  }

  return undefined
}

const pageProjectCache = new Map<string, number>()

const upsertVkImportedPage = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  title: string,
  slug: string,
  summary: string,
  fullText: string,
  heroImageId?: number,
) => {
  const cachedPageId = pageProjectCache.get(slug)
  if (cachedPageId) {
    return cachedPageId
  }

  const existing = await payload.find({
    collection: 'pages',
    overrideAccess: true,
    limit: 1,
    where: { slug: { equals: slug } },
  })

  if (existing.docs.length) {
    const existingId = Number(existing.docs[0]!.id)
    if (Number.isFinite(existingId)) {
      pageProjectCache.set(slug, existingId)
      return existingId
    }
  }

  const pageData = {
    title,
    slug,
    hero: {
      type: 'none' as const,
      richText: richTextFromText(fullText),
    },
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextFromText(fullText),
          },
        ],
      },
    ],
    meta: {
      title: title,
      description: summary,
      ...(heroImageId ? { image: heroImageId } : {}),
    },
    _status: 'published' as const,
  }

  const page = await payload.create({
    collection: 'pages',
    overrideAccess: true,
      data: pageData as any,
    context: {
      disableRevalidate: true,
    },
  })

  const createdId = Number(page.id)
  if (Number.isFinite(createdId)) {
    pageProjectCache.set(slug, createdId)
    return createdId
  }

  return undefined
}

const main = async () => {
  const payload = await getPayload({ config: configPromise })
  const mediaCache = new Map<string, number>()
  const postProjectIds = new Map<string, number>()

  const projectDocs = await payload.find({
    collection: 'projects',
    overrideAccess: true,
    limit: 100,
  })
  const fallbackProjectByType = new Map<string, number>(
    projectDocs.docs
      .filter((doc) => doc.projectType && typeof doc.id === 'number')
      .map((doc) => [doc.projectType, Number(doc.id)]),
  )

  const effectiveGroupConfigs = [...groupConfigs, ...envGroupConfigs]

  for (const group of effectiveGroupConfigs) {
    const token = getTokenForGroup(group.id, group.tokenEnv)
    if (!token) {
      payload.logger.warn(`VK token missing for group ${group.id}`)
      continue
    }

    payload.logger.info(`Fetching VK posts for ${group.id}`)
    const items = await fetchGroupPosts(group.id, token)

    const fallbackProjectId = fallbackProjectByType.get(group.projectType)

    for (const post of items) {
      if (!post.text) continue
      const { title, summary, fullText } = getTitleAndSummary(post.text)
      const slug = toSlug(`${group.id}-${post.id}-${title}`)
      const photoUrl = getBestPhotoUrl(post.attachments)
      const detectedSections = detectSectionsFromText(`${title} ${fullText}`, group.sectionSlugs || [])
      const uniqueSectionSlugs = normalizeSuggestionSections(detectedSections)
      const primarySectionSlug = uniqueSectionSlugs[0]
      const sectionProfile = primarySectionSlug ? sectionProfileBySlug.get(primarySectionSlug) : undefined
      const resolvedProjectType = sectionProfile?.projectType || group.projectType
      const destinationDecision = detectContentDestination(title, fullText, group.fallbackType)
      let heroImageId: number | undefined

      if (photoUrl) {
        const cached = mediaCache.get(photoUrl)
        if (cached) {
          heroImageId = cached
        } else {
          try {
            const file = await fetchFileByURL(photoUrl)
            const media = await payload.create({
              collection: 'media',
              overrideAccess: true,
              data: {
                alt: title,
              },
              file,
            })
            heroImageId = media.id as number
            mediaCache.set(photoUrl, heroImageId)
          } catch (error) {
            payload.logger.warn(`Failed to fetch VK image for post ${post.id}: ${(error as Error).message}`)
          }
        }
      }

      const destination = destinationDecision.destination

      const existingContentCollection = await findExistingContentBySlug(payload, slug)
      if (existingContentCollection) {
        payload.logger.info(
          `VK import duplicate skipped: group=${group.id}, post=${post.id}, slug=${slug}, collection=${existingContentCollection}`,
        )
        continue
      }

      payload.logger.info(
        `VK import classification: group=${group.id}, post=${post.id}, destination=${destination}, score=${destinationDecision.score}, reasons=[${destinationDecision.reasons.join(
          '; ',
        )}]`,
      )

      const sourceMeta = {
        sectionProfileSlug: primarySectionSlug,
        detectedSections: uniqueSectionSlugs,
        projectType: resolvedProjectType,
        postDate: post.date,
        sourceGroupId: group.id,
      }

      if (isDryRun) {
        continue
      }

      await upsertVkImportQueueItem(payload, {
        sourceGroupId: group.id,
        sourcePostId: post.id,
        title,
        text: fullText,
        previewText: summary,
        heroImageId,
        suggestedSections: uniqueSectionSlugs,
        suggestedDestination: destination,
        destinationDecision,
        detectedDate: post.date,
        sourceMeta,
      })

      if (isQueueOnlyMode && !keepAutoPublishMode) {
        continue
      }

      const sectionCategoryIds = uniqueSectionSlugs.length ? await getCategoriesBySections(payload, uniqueSectionSlugs) : []
      let topicProjectId = primarySectionSlug ? postProjectIds.get(primarySectionSlug) : undefined

      if (primarySectionSlug && !topicProjectId && sectionProfileBySlug.has(primarySectionSlug)) {
        topicProjectId = await upsertProjectForSection(
          payload,
          primarySectionSlug,
          resolvedProjectType,
          {
            title: sectionProfile?.title || title,
            summary,
            fullText,
            heroImageId,
          },
        )
        if (topicProjectId) {
          postProjectIds.set(primarySectionSlug, topicProjectId)
        }
      }

      const projectId = topicProjectId || fallbackProjectId

      if (destination === 'pages') {
        await upsertVkImportedPage(
          payload,
          sectionProfile?.title || title,
          slug,
          summary,
          fullText,
          heroImageId,
        )
      }

      if (destination === 'posts') {
        const exists = await payload.find({
          collection: 'posts',
          overrideAccess: true,
          limit: 1,
          where: { slug: { equals: slug } },
        })
        if (exists.docs.length) continue

        await payload.create({
          collection: 'posts',
          overrideAccess: true,
          data: {
            title,
            slug,
            postType: group.postType ?? 'news',
            project: projectId,
            categories: sectionCategoryIds.length ? sectionCategoryIds : undefined,
            content: richTextFromText(fullText),
            heroImage: heroImageId,
            meta: heroImageId
              ? {
                  title,
                  description: summary,
                  image: heroImageId,
                }
              : undefined,
            _status: 'published',
          },
          context: {
            disableRevalidate: true,
          },
        })
      }

      if (destination === 'events') {
        const exists = await payload.find({
          collection: 'events',
          overrideAccess: true,
          limit: 1,
          where: { slug: { equals: slug } },
        })
        if (exists.docs.length) continue

        await payload.create({
          collection: 'events',
          overrideAccess: true,
          data: {
            title,
            slug,
            summary,
            project: projectId,
            startDate: new Date(post.date * 1000).toISOString(),
            content: richTextFromText(fullText),
            heroImage: heroImageId,
            eventStatus: 'active',
            _status: 'published',
          },
          context: {
            disableRevalidate: true,
          },
        })
      }

      if (destination === 'services') {
        const exists = await payload.find({
          collection: 'services',
          overrideAccess: true,
          limit: 1,
          where: { slug: { equals: slug } },
        })
        if (exists.docs.length) continue

        await payload.create({
          collection: 'services',
          overrideAccess: true,
          data: {
            title,
            slug,
            summary,
            project: projectId,
            description: richTextFromText(fullText),
            heroImage: heroImageId,
            serviceStatus: 'active',
            _status: 'published',
          },
          context: {
            disableRevalidate: true,
          },
        })
      }

      if (destination === 'products') {
        const exists = await payload.find({
          collection: 'products',
          overrideAccess: true,
          limit: 1,
          where: { slug: { equals: slug } },
        })
        if (exists.docs.length) continue

        await payload.create({
          collection: 'products',
          overrideAccess: true,
          data: {
            title,
            slug,
            summary,
            description: richTextFromText(fullText),
            price: 0,
            currency: 'RUB',
            inStock: true,
            images: heroImageId
              ? [
                  {
                    image: heroImageId,
                    caption: title,
                  },
                ]
              : [],
          },
          context: {
            disableRevalidate: true,
          },
        })
      }

      await sleep(requestDelayMs)
    }

    await sleep(requestDelayMs)
  }

  payload.logger.info('VK import completed')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
