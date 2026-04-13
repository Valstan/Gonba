import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { sections } from '../src/app/(frontend)/sections/data'
import { DEFAULT_PROJECT_SECTIONS } from '../src/app/(frontend)/projects/queries'

type ProjectDoc = {
  id: number
  title: string
  slug: string
  shortLabel?: string | null
  summary?: string | null
  description?: unknown
  projectType?: string | null
  isActive?: boolean | null
  enabledSections?: string[] | null
  sortOrder?: number | null
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  const operations = sections.map(async (section, index) => {
    const existing = (await payload.find({
      collection: 'projects',
      where: {
        slug: {
          equals: section.slug,
        },
      },
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })) as { docs: ProjectDoc[] }

    const existingProject = existing.docs?.[0]
    if (existingProject) {
      const patch: Partial<ProjectDoc> = {
        isActive: true,
        projectType: existingProject.projectType || 'other',
        shortLabel: existingProject.shortLabel || section.shortLabel,
        summary: existingProject.summary || section.description,
      }

      const needsSections =
        !Array.isArray(existingProject.enabledSections) || existingProject.enabledSections.length === 0
          ? true
          : false
      const hasSortOrder = typeof existingProject.sortOrder === 'number'

      const data: Record<string, unknown> = {
        title: section.title,
      }

      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        data[key] = value
      })

      if (needsSections) data.enabledSections = DEFAULT_PROJECT_SECTIONS
      if (!hasSortOrder) data.sortOrder = index + 10
      if (Object.keys(data).length > 1) {
        await payload.update({
          collection: 'projects',
          id: existingProject.id,
          data,
          overrideAccess: true,
        })
      }
      return
    }

    await payload.create({
      collection: 'projects',
      data: {
        title: section.title,
        shortLabel: section.shortLabel,
        slug: section.slug,
        summary: section.description,
        projectType: 'other',
        isActive: section.status === 'ready',
        enabledSections: DEFAULT_PROJECT_SECTIONS,
        sortOrder: index + 10,
      },
      overrideAccess: true,
    })
  })

  await Promise.all(operations)
}

run()
  .then(() => {
    console.log('Миграция секций в проекты завершена.')
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
