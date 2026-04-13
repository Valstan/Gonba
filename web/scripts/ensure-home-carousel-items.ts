import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const NORMALIZE_LINK = (value: string) =>
  value
    .trim()
    .replace(/^(\s*)\/?sections\/(.*)\/?$/i, '/projects/$2')
    .replace(/^(\s*)\/?projects\/(.*)\/?$/i, '/projects/$2')
    .replace(/\/+$/, '')

type GlobalCarouselItem = {
  title?: string | null
  link?: string | null
  image?: number | { id?: string | number | null } | null
}

type GlobalCarousel = {
  id?: number
  items?: Array<GlobalCarouselItem> | null
  center?: {
    title?: string | null
    link?: string | null
    image?: number | { id?: string | number | null } | null
  } | null
}

const REQUIRED_ITEMS: Array<{ title: string; link: string }> = [
  { title: 'Конный клуб', link: '/projects/konnyy-klub-gmalyzh' },
  { title: 'Садовая фея', link: '/projects/sadovaya-feya-gulfiya-kharisovna' },
]

const normalizeImage = (image: GlobalCarouselItem['image']) => {
  if (typeof image === 'number' && Number.isFinite(image)) return image
  if (typeof image === 'object' && image !== null) {
    const maybeId = Number(image.id)
    return Number.isFinite(maybeId) ? maybeId : null
  }
  return null
}

const normalizeItems = (items: GlobalCarousel['items']) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title.trim() : '',
          link: typeof item.link === 'string' ? NORMALIZE_LINK(item.link) : '',
          image: normalizeImage(item.image),
        }))
        .filter((item) => item.title.length > 0 && item.link.length > 0)
    : []

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const globalData = (await payload.findGlobal({ slug: 'homeCarousel', depth: 1 })) as GlobalCarousel
  const existingItems = normalizeItems(globalData.items)

  const existingLinks = new Set(existingItems.map((item) => item.link.toLowerCase()))
  const existingByTitle = new Set(existingItems.map((item) => item.title.toLowerCase()))

  const missingItems = REQUIRED_ITEMS.filter(
    ({ title, link }) => !existingLinks.has(NORMALIZE_LINK(link).toLowerCase()) && !existingByTitle.has(title.toLowerCase()),
  )

  if (missingItems.length === 0) {
    console.log('Меню-карусель: все необходимые пункты уже есть.')
    return
  }

  const itemsToSave = [...existingItems, ...missingItems.map((item) => ({ ...item, image: null }))]

  await payload.updateGlobal({
    slug: 'homeCarousel',
    data: {
      items: itemsToSave,
    },
    overrideAccess: true,
    context: {
      disableRevalidate: true,
    },
  })

  console.log(`Добавлены пункты меню-карусели: ${missingItems.map((item) => item.title).join(', ')}`)
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
  console.error(error)
  process.exit(1)
  })
