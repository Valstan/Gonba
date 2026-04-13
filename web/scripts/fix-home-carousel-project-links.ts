import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const normalizeLink = (value?: string | null): string | undefined => {
  if (!value) return undefined

  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^www/, '')
    .replace(/^\/?deer$/i, 'projects/gonba')
    .replace(/^\/?sections\//i, 'projects/')
    .replace(/^\/?projects?\//i, 'projects/')
    .replace(/\/+/g, '/')
    .replace(/#.*$/u, '')
    .replace(/^/i, '/')
    .replace(/\/$/, '')
}

type GlobalCarouselItem = {
  id?: string | number
  title?: string | null
  link?: string | null
}

type GlobalCarousel = {
  id?: string | number
  items?: GlobalCarouselItem[] | null
  center?: {
    link?: string | null
  } | null
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const globalData = (await payload.findGlobal({ slug: 'homeCarousel', depth: 1 })) as GlobalCarousel

  const items = Array.isArray(globalData.items)
    ? globalData.items.map((item) => ({
        title: item?.title ?? undefined,
        link: normalizeLink(typeof item?.link === 'string' ? item.link : undefined),
      }))
    : []

  const center = globalData.center
    ? {
        ...globalData.center,
        link: normalizeLink(globalData.center.link || ''),
      }
    : undefined

  const linksChanged =
    JSON.stringify(items) !== JSON.stringify(globalData.items || []) || JSON.stringify(center || {}) !== JSON.stringify(globalData.center || {})

  if (!linksChanged) {
    console.log('Ссылки карусели уже в актуальном формате.')
    return
  }

  await payload.updateGlobal({
    slug: 'homeCarousel',
    data: {
      items,
      ...(center ? { center } : {}),
    },
    overrideAccess: true,
    context: {
      disableRevalidate: true,
    },
  })

  console.log('Ссылки карусели обновлены на формат /projects/*')
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
