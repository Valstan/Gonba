import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { gatewayCall } from '../src/server/integrations/vk-gateway'

const APPLY = process.argv.includes('--apply')
let activePayload: Awaited<ReturnType<typeof getPayload>> | undefined

const PHONE_OWNER = '8 999 914 22 27'
const PHONE_LEPOTA = '8 982 390 85 56'

type ProjectDoc = { id: number; slug?: string | null; title?: string | null }
type CategoryDoc = { id: number; slug?: string | null }

const projectUpdates: Record<string, Record<string, unknown>> = {
  gonba: {
    title: 'Гоньба — история села, храм и события',
    shortLabel: 'Гоньба',
    projectType: 'other',
    summary: 'История села, храм, события, фотографии, сельские активности и мероприятия на берегу Вятки.',
    contacts: { phone: PHONE_OWNER },
    isActive: true,
  },
  'eco-hotel-booking': {
    title: 'Гостевые домики в селе Гоньба',
    shortLabel: 'Гостевые домики',
    summary: 'Гостевые домики, бассейн, баня и чан. Гости уже принимаются.',
    contacts: { phone: PHONE_OWNER },
    isActive: true,
  },
  'vyatskaya-lepota': {
    title: 'Вятская Лепота (Малмыж)',
    shortLabel: 'Вятская Лепота',
    contacts: { phone: PHONE_LEPOTA },
    isActive: true,
  },
  'district-excursions': {
    title: 'Сельский туризм Малмыжского района',
    shortLabel: 'Сельский туризм',
    projectType: 'other',
    summary: 'Экскурсии, рыбалка и прокат для путешествий по Малмыжскому району.',
    isActive: true,
  },
  'konnyy-klub-gmalyzh': {
    isActive: false,
    showInOrbit: false,
  },
}

const serviceSeeds = [
  {
    slug: 'deer-farm-tour',
    title: 'Экскурсия на оленью ферму',
    summary: 'Рассказ об оленях и ферме, знакомство с животными и сувенирной лавкой.',
    projectSlug: 'deer-farm',
    serviceStatus: 'active',
  },
  {
    slug: 'banya-rental',
    title: 'Баня и чан в гостевых домиках',
    summary: 'Баня, бассейн и чан для гостей села Гоньба.',
    projectSlug: 'eco-hotel-booking',
    serviceStatus: 'active',
  },
  {
    slug: 'medovaya-tropa',
    title: 'Экскурсия на пасеку «Медовая тропа»',
    summary: 'Знакомство с пасекой и сельским трудом.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'molochnye-reki-staryy-iryuk',
    title: '«Молочные реки» (Старый Ирюк)',
    summary: 'Экскурсия о сельском хозяйстве и местной жизни.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'sibirsky-trakt-gonba',
    title: 'Путешествие по Сибирскому тракту',
    summary: 'Маршрут Малмыж — Гоньба — Малмыж, также «Гоньба почтовая».',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'po-shchuchemu-veleniyu',
    title: '«По щучьему велению»',
    summary: 'Организация рыбалки под ключ.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'konek-gorbunok',
    title: '«Конёк‑Горбунок»',
    summary: 'Конная экскурсия; проект в разработке.',
    projectSlug: 'district-excursions',
    serviceStatus: 'paused',
  },
  {
    slug: 'prokat-karet',
    title: 'Прокат карет',
    summary: 'Прогулки и мероприятия с прокатом карет.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'prokat-baydarok',
    title: 'Прокат байдарок',
    summary: 'Прокат байдарок для водных маршрутов.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
  {
    slug: 'prokat-sapov',
    title: 'Прокат SUP-досок',
    summary: 'Прокат SUP-досок для прогулок по воде.',
    projectSlug: 'district-excursions',
    serviceStatus: 'active',
  },
] as const

const sourceSeeds = [
  { groupId: 235385532, communityUrl: 'https://vk.com/club235385532', projectSlug: 'eco-hotel-booking', sectionSlug: 'eco-hotel-booking' },
  { groupId: 229001043, communityUrl: 'https://vk.com/club229001043', projectSlug: 'vyatskiy-sbor', sectionSlug: 'vyatskiy-sbor' },
] as const

async function latestCursor(groupId: number): Promise<number> {
  const override = process.env[`VK_INITIAL_CURSOR_${groupId}`]
  if (override && Number.isFinite(Number(override))) return Number(override)
  const response = await gatewayCall<{ items?: Array<{ id?: number }> }>('wall.get', {
    owner_id: -groupId,
    count: 1,
    filter: 'owner',
    extended: 0,
  })
  const id = response.items?.[0]?.id
  if (!id) throw new Error(`Не удалось получить последний VK post ID для ${groupId}`)
  return id
}

async function main(): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  activePayload = payload
  const projectCache = new Map<string, ProjectDoc>()
  const categoryCache = new Map<string, CategoryDoc>()

  const project = async (slug: string): Promise<ProjectDoc> => {
    const cached = projectCache.get(slug)
    if (cached) return cached
    const result = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
    if (!result.docs[0]) throw new Error(`Проект не найден: ${slug}`)
    const doc = result.docs[0] as ProjectDoc
    projectCache.set(slug, doc)
    return doc
  }

  const category = async (slug: string): Promise<CategoryDoc> => {
    const cached = categoryCache.get(slug)
    if (cached) return cached
    const result = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
    if (!result.docs[0]) throw new Error(`Категория не найдена: ${slug}`)
    const doc = result.docs[0] as CategoryDoc
    categoryCache.set(slug, doc)
    return doc
  }

  const deerResult = await payload.find({ collection: 'projects', where: { slug: { equals: 'deer-farm' } }, limit: 1, depth: 0, overrideAccess: true })
  const deer = (deerResult.docs[0] as ProjectDoc | undefined) ?? (APPLY
    ? ((await payload.create({
        collection: 'projects',
        overrideAccess: true,
        data: {
          title: 'Оленья ферма',
          shortLabel: 'Оленья ферма',
          slug: 'deer-farm',
          projectType: 'deerFarm',
          summary: 'Олени, ферма, сувенирная лавка и зимние каникулы у оленей.',
          contacts: { phone: PHONE_OWNER },
          isActive: true,
          _status: 'published',
        },
      })) as ProjectDoc)
    : ({ id: -1, slug: 'deer-farm' } as ProjectDoc))
  projectCache.set('deer-farm', deer)

  for (const [slug, data] of Object.entries(projectUpdates)) {
    const doc = await project(slug)
    console.log(`${APPLY ? 'UPDATE' : 'WOULD UPDATE'} project ${slug}`, data)
    if (APPLY) await payload.update({ collection: 'projects', id: doc.id, overrideAccess: true, data: data as never })
  }

  for (const seed of serviceSeeds) {
    const owner = await project(seed.projectSlug)
    const existing = await payload.find({ collection: 'services', where: { slug: { equals: seed.slug } }, limit: 1, depth: 0, overrideAccess: true })
    const data = {
      title: seed.title,
      summary: seed.summary,
      project: owner.id,
      serviceStatus: seed.serviceStatus,
      bookingEnabled: true,
      _status: 'published' as const,
    }
    console.log(`${APPLY ? 'UPSERT' : 'WOULD UPSERT'} service ${seed.slug}`, data)
    if (APPLY) {
      if (existing.docs[0]) await payload.update({ collection: 'services', id: existing.docs[0].id, overrideAccess: true, data })
      else await payload.create({ collection: 'services', overrideAccess: true, data: { ...data, slug: seed.slug } })
    }
  }

  const staleServices = await payload.find({ collection: 'services', where: { slug: { like: '235385532-' } }, limit: 100, depth: 0, overrideAccess: true })
  const guestHouseOwner = await project('eco-hotel-booking')
  for (const stale of staleServices.docs) {
    console.log(`${APPLY ? 'RELINK' : 'WOULD RELINK'} VK service ${stale.id} ${stale.slug} -> eco-hotel-booking`)
    if (APPLY) {
      await payload.update({
        collection: 'services',
        id: stale.id,
        overrideAccess: true,
        data: { project: guestHouseOwner.id, serviceStatus: 'active', _status: 'published' },
      })
    }
  }

  const circusServices = await payload.find({ collection: 'services', where: { slug: { like: '226176537-' } }, limit: 100, depth: 0, overrideAccess: true })
  const travelersOwner = await project('klub-malmyzhskikh-puteshestvennikov')
  for (const circus of circusServices.docs) {
    console.log(`${APPLY ? 'RELINK' : 'WOULD RELINK'} VK service ${circus.id} ${circus.slug} -> klub-malmyzhskikh-puteshestvennikov`)
    if (APPLY) {
      await payload.update({
        collection: 'services',
        id: circus.id,
        overrideAccess: true,
        data: { project: travelersOwner.id, serviceStatus: 'active', _status: 'published' },
      })
    }
  }

  for (const seed of sourceSeeds) {
    const owner = await project(seed.projectSlug)
    const section = await category(seed.sectionSlug)
    const existing = await payload.find({ collection: 'vk-auto-sync', where: { groupId: { equals: seed.groupId } }, limit: 1, depth: 0, overrideAccess: true })
    const cursor = await latestCursor(seed.groupId)
    const data = {
      communityUrl: seed.communityUrl,
      communityName: seed.projectSlug,
      groupId: seed.groupId,
      project: owner.id,
      category: section.id,
      projectSlug: seed.projectSlug,
      sectionSlug: seed.sectionSlug,
      isEnabled: true,
      syncIntervalHours: 3,
      postType: 'news' as const,
      lastSyncedPostId: existing.docs[0]?.lastSyncedPostId ?? cursor,
    }
    console.log(`${APPLY ? 'UPSERT' : 'WOULD UPSERT'} VK source ${seed.groupId}`, data)
    if (APPLY) {
      if (existing.docs[0]) await payload.update({ collection: 'vk-auto-sync', id: existing.docs[0].id, overrideAccess: true, data })
      else await payload.create({ collection: 'vk-auto-sync', overrideAccess: true, data })
    }
  }

  console.log(APPLY ? 'Content plan applied.' : 'Dry run only. Re-run with --apply to mutate Payload.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}).finally(async () => {
  await activePayload?.db.destroy?.()
})
