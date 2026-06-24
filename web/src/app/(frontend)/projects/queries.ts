import configPromise from '@payload-config'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import { getPayload } from 'payload'
import type { ProjectsSelect } from '@/payload-types'
import { withRetry } from '@/utilities/withRetry'

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
  homeLink: true,
  logo: true,
  enabledSections: true,
  sortOrder: true,
  galleryYandexFolder: true,
  chat: true,
  // Этно-модерн поля (миграция 20260525_080000). Cast — пока локальный
  // payload-types.ts не пересгенерирован; CI на сборке регенерирует.
  ...({
    kind: true,
    homepageGroup: true,
    isHeroOfHomepage: true,
    isFeatured: true,
    showInOrbit: true,
    excerpt: true,
    chapterRoman: true,
    decorMotif: true,
  } as unknown as Partial<ProjectsSelect>),
})

export const queryProjectBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай против транзиентного сбоя БД. Бросает после ретраев →
  // ISR/layout не кэширует ложный 404 на проекте; null (0 docs) = реально нет.
  // Высокий рычаг: этот хелпер оборачивает layout всех вкладок проекта + главную.
  const result = await withRetry(() =>
    payload.find({
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
    }),
  )

  const doc = result.docs?.[0]
  return (doc as ProjectRecord | undefined) || null
})

export const queryProjects = async (opts?: { includeInactive?: boolean }) => {
  const payload = await getPayload({ config: configPromise })
  const filter = opts?.includeInactive ? undefined : { isActive: { equals: true } }

  // pool #040: ретрай против транзиентного сбоя БД. Бросает после ретраев (не
  // глотает в []) → рендер прерывается и НЕ кэшируется пустым; покрывает главную
  // (force-dynamic), /usadba и /projects, которые зовут этот хелпер.
  const result = await withRetry(() =>
    payload.find({
      collection: 'projects',
      depth: 1,
      limit: 100,
      sort: 'sortOrder,-updatedAt',
      overrideAccess: false,
      ...(filter ? { where: filter } : {}),
      select: getSelect(),
    }),
  )

  return result.docs as ProjectRecord[]
}
