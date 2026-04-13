import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { sections } from '../src/app/(frontend)/sections/data'
import { DEFAULT_PROJECT_SECTIONS, type ProjectSectionKey } from '../src/app/(frontend)/projects/queries'

const TARGET_PROJECT_COUNT = 13
const TARGET_ORBIT_COUNT = 12
const CENTER_PROJECT_SLUG = 'gonba'

type ProjectType = 'deerFarm' | 'ecoHotel' | 'craftStudio' | 'travelClub' | 'productLine' | 'other'

type ProjectDoc = {
  id: number | string
  title: string
  slug: string
  shortLabel?: string | null
  summary?: string | null
  projectType?: ProjectType | null
  isActive?: boolean | null
  enabledSections?: ProjectSectionKey[] | null
  sortOrder?: number | null
}

type GlobalCarouselItem = {
  title?: string | null
  link?: string | null
  image?: number | { id?: string | number | null } | null
}

type GlobalCarousel = {
  items?: Array<GlobalCarouselItem> | null
  center?: {
    title?: string | null
    link?: string | null
    image?: number | { id?: string | number | null } | null
  } | null
}

type ProjectBlueprint = {
  slug: string
  title: string
  shortLabel: string
  summary: string
  projectType: ProjectType
}

const EXTRA_BLUEPRINTS: ProjectBlueprint[] = [
  {
    slug: 'gonba',
    title: 'Гоньба — жемчужина Вятки',
    shortLabel: 'Вятские олени',
    summary: 'Главный проект экопортала: олени, природа, экскурсии и семейный отдых.',
    projectType: 'deerFarm',
  },
  {
    slug: 'eco-hotel-vyatka',
    title: 'ЭКО-отель «Жемчужина Вятки»',
    shortLabel: 'ЭКО-отель',
    summary: 'Размещение, ретриты, восстановление и отдых на природе.',
    projectType: 'ecoHotel',
  },
  {
    slug: 'vyatskaya-lepota',
    title: 'Студия «Вятская Лепота»',
    shortLabel: 'Вятская Лепота',
    summary: 'Ремесла, мастер-классы, авторские занятия и творчество.',
    projectType: 'craftStudio',
  },
]

const normalizeImage = (value: GlobalCarouselItem['image']) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'object' && value !== null) {
    const imageId = Number(value.id)
    return Number.isFinite(imageId) ? imageId : null
  }
  return null
}

const normalizeProjectLink = (value?: string | null) => {
  if (!value) return null
  const cleaned = value.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '')
  const sectionsMatch = cleaned.match(/^\/sections\/([^/]+)$/i)
  if (sectionsMatch?.[1]) return sectionsMatch[1]
  const projectsMatch = cleaned.match(/^\/projects\/([^/]+)$/i)
  if (projectsMatch?.[1]) return projectsMatch[1]
  return null
}

const withDefaults = (blueprint: ProjectBlueprint): ProjectBlueprint => ({
  ...blueprint,
  shortLabel: blueprint.shortLabel.trim() || blueprint.title,
  summary: blueprint.summary.trim() || blueprint.title,
})

const buildBlueprints = (): ProjectBlueprint[] => {
  const fromSections: ProjectBlueprint[] = sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    shortLabel: section.shortLabel,
    summary: section.description,
    projectType: 'other',
  }))

  const unique: ProjectBlueprint[] = []
  const seen = new Set<string>()

  for (const blueprint of [...fromSections, ...EXTRA_BLUEPRINTS]) {
    if (seen.has(blueprint.slug)) continue
    seen.add(blueprint.slug)
    unique.push(withDefaults(blueprint))
  }

  return unique.slice(0, TARGET_PROJECT_COUNT)
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const blueprints = buildBlueprints()
  const requiredSlugs = new Set(blueprints.map((item) => item.slug))

  const before = (await payload.find({
    collection: 'projects',
    limit: 300,
    pagination: false,
    overrideAccess: true,
    sort: 'sortOrder',
    where: {},
  })) as { docs: ProjectDoc[] }

  const projectsBySlug = new Map(before.docs.map((doc) => [doc.slug, doc]))

  let createdCount = 0
  let updatedCount = 0
  let deactivatedCount = 0

  for (const [index, blueprint] of blueprints.entries()) {
    const existing = projectsBySlug.get(blueprint.slug)
    const desiredSortOrder = index + 10

    if (!existing) {
      await payload.create({
        collection: 'projects',
        data: {
          title: blueprint.title,
          shortLabel: blueprint.shortLabel,
          slug: blueprint.slug,
          summary: blueprint.summary,
          projectType: blueprint.projectType,
          isActive: true,
          enabledSections: DEFAULT_PROJECT_SECTIONS,
          sortOrder: desiredSortOrder,
        },
        overrideAccess: true,
      })
      createdCount += 1
      continue
    }

    const updateData: Record<string, unknown> = {}

    if (!existing.isActive) updateData.isActive = true
    if (!Array.isArray(existing.enabledSections) || existing.enabledSections.length === 0) {
      updateData.enabledSections = DEFAULT_PROJECT_SECTIONS
    }
    if (typeof existing.sortOrder !== 'number') updateData.sortOrder = desiredSortOrder
    if (!existing.shortLabel) updateData.shortLabel = blueprint.shortLabel
    if (!existing.summary) updateData.summary = blueprint.summary
    if (!existing.projectType) updateData.projectType = blueprint.projectType

    if (Object.keys(updateData).length > 0) {
      await payload.update({
        collection: 'projects',
        id: existing.id,
        data: updateData,
        overrideAccess: true,
      })
      updatedCount += 1
    }
  }

  const afterEnsure = (await payload.find({
    collection: 'projects',
    limit: 300,
    pagination: false,
    overrideAccess: true,
    sort: 'sortOrder',
    where: {},
  })) as { docs: ProjectDoc[] }

  for (const doc of afterEnsure.docs) {
    if (requiredSlugs.has(doc.slug)) continue
    if (!doc.isActive) continue

    await payload.update({
      collection: 'projects',
      id: doc.id,
      data: {
        isActive: false,
      },
      overrideAccess: true,
    })
    deactivatedCount += 1
  }

  const finalProjects = (await payload.find({
    collection: 'projects',
    limit: 300,
    pagination: false,
    overrideAccess: true,
    sort: 'sortOrder',
    where: {},
  })) as { docs: ProjectDoc[] }

  const projectBySlug = new Map(finalProjects.docs.map((doc) => [doc.slug, doc]))
  const activeProjects = finalProjects.docs.filter((doc) => Boolean(doc.isActive))
  const inactiveProjects = finalProjects.docs.filter((doc) => !doc.isActive)

  const globalData = (await payload.findGlobal({
    slug: 'homeCarousel',
    depth: 1,
  })) as GlobalCarousel

  const currentItems = Array.isArray(globalData.items) ? globalData.items : []
  const currentItemsBySlug = new Map<string, GlobalCarouselItem>()
  for (const item of currentItems) {
    const slug = normalizeProjectLink(item.link)
    if (slug) currentItemsBySlug.set(slug, item)
  }

  const orbitSlugs = blueprints
    .map((item) => item.slug)
    .filter((slug) => slug !== CENTER_PROJECT_SLUG)
    .slice(0, TARGET_ORBIT_COUNT)

  const orbitItems = orbitSlugs.map((slug) => {
    const doc = projectBySlug.get(slug)
    const existingItem = currentItemsBySlug.get(slug)

    return {
      title: existingItem?.title?.trim() || doc?.shortLabel || doc?.title || slug,
      link: `/projects/${slug}`,
      image: normalizeImage(existingItem?.image),
    }
  })

  const centerDoc = projectBySlug.get(CENTER_PROJECT_SLUG)
  const centerItem = {
    title: globalData.center?.title?.trim() || centerDoc?.shortLabel || centerDoc?.title || 'Вятские олени',
    link: `/projects/${CENTER_PROJECT_SLUG}`,
    image: normalizeImage(globalData.center?.image ?? null),
  }

  await payload.updateGlobal({
    slug: 'homeCarousel',
    data: {
      items: orbitItems,
      center: centerItem,
    },
    overrideAccess: true,
    context: {
      disableRevalidate: true,
    },
  })

  const carouselAfter = (await payload.findGlobal({
    slug: 'homeCarousel',
    depth: 1,
  })) as GlobalCarousel

  const finalItems = Array.isArray(carouselAfter.items) ? carouselAfter.items : []
  const summary = {
    createdProjects: createdCount,
    updatedProjects: updatedCount,
    deactivatedProjects: deactivatedCount,
    totalProjects: finalProjects.docs.length,
    activeProjects: activeProjects.length,
    activeProjectSlugs: activeProjects.map((project) => project.slug),
    inactiveProjects: inactiveProjects.length,
    inactiveProjectSlugs: inactiveProjects.map((project) => project.slug),
    carouselItems: finalItems.length,
    carouselLinks: finalItems.map((item) => item.link),
    carouselCenterLink: carouselAfter.center?.link || null,
  }

  console.log(JSON.stringify(summary, null, 2))
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
