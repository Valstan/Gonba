import configPromise from '@payload-config'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import { getPayload } from 'payload'
import type { ProjectsSelect } from '@/payload-types'

export type { ProjectSectionKey, ProjectRecord } from './shared'
export { DEFAULT_PROJECT_SECTIONS } from './shared'

import type { ProjectRecord } from './shared'

const getSelect = (): ProjectsSelect => ({
  title: true,
  slug: true,
  shortLabel: true,
  summary: true,
  description: true,
  heroImage: true,
  gallery: true,
  location: true,
  contacts: true,
  accentColor: true,
  logo: true,
  enabledSections: true,
  sortOrder: true,
})

export const queryProjectBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'projects',
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    depth: 1,
    select: getSelect(),
  })

  const doc = result.docs?.[0]
  return (doc as ProjectRecord | undefined) || null
})

export const queryProjects = async (opts?: { includeInactive?: boolean }) => {
  const payload = await getPayload({ config: configPromise })
  const filter = opts?.includeInactive ? undefined : { isActive: { equals: true } }

  const result = await payload.find({
    collection: 'projects',
    depth: 1,
    limit: 100,
    sort: 'sortOrder,-updatedAt',
    overrideAccess: false,
    ...(filter ? { where: filter } : {}),
    select: getSelect(),
  })

  return result.docs as ProjectRecord[]
}
