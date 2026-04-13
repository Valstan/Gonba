import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Media as PayloadMedia } from '@/payload-types'
import { sections, type SectionDefinition } from './data'

type VisualMedia = PayloadMedia

const toWords = (value?: string | null) => (value || '').toLowerCase()

const scoreByKeywords = (item: VisualMedia, keywords: string[]) => {
  const haystack = `${toWords(item.alt)} ${toWords(item.filename)} ${toWords(item.url)}`
  return keywords.reduce((score, keyword) => (haystack.includes(keyword.toLowerCase()) ? score + 1 : score), 0)
}

const loadMediaPool = cache(async (): Promise<VisualMedia[]> => {
  const payload = await getPayload({ config: configPromise })

  const [mediaResult, projectsResult] = await Promise.all([
    payload.find({
      collection: 'media',
      overrideAccess: false,
      depth: 0,
      limit: 140,
      sort: '-updatedAt',
    }),
    payload.find({
      collection: 'projects',
      overrideAccess: false,
      depth: 1,
      limit: 30,
      sort: '-updatedAt',
    }),
  ])

  const mediaDocs = mediaResult.docs.filter(
    (doc): doc is PayloadMedia => typeof doc.id === 'number' && typeof doc.url === 'string' && doc.url.length > 0,
  )

  const projectImages = projectsResult.docs
    .map((project) => project.heroImage)
    .filter((hero): hero is PayloadMedia =>
      Boolean(hero && typeof hero === 'object' && typeof hero.id === 'number' && typeof hero.url === 'string'),
    )

  const merged = [...mediaDocs, ...projectImages]
  const deduped = new Map<number, VisualMedia>()
  for (const item of merged) {
    if (!deduped.has(item.id)) deduped.set(item.id, item)
  }

  return [...deduped.values()]
})

const pickByKeywords = (pool: VisualMedia[], keywords: string[], usedIds: Set<number>) => {
  const scored = pool
    .filter((item) => !usedIds.has(item.id))
    .map((item) => ({ item, score: scoreByKeywords(item, keywords) }))
    .sort((a, b) => b.score - a.score)

  const best = scored.find((candidate) => candidate.score > 0)?.item ?? scored[0]?.item ?? null
  if (best) usedIds.add(best.id)
  return best
}

export const getSectionVisualMap = cache(async (customSections: SectionDefinition[] = sections) => {
  const pool = await loadMediaPool()
  const usedIds = new Set<number>()
  const visualMap = new Map<string, VisualMedia | null>()

  for (const section of customSections) {
    visualMap.set(section.slug, pickByKeywords(pool, section.imageKeywords, usedIds))
  }

  return visualMap
})

export const getDeerCenterVisual = cache(async () => {
  const pool = await loadMediaPool()
  const used = new Set<number>()
  return pickByKeywords(pool, ['олень', 'deer', 'ферма'], used)
})

export const getDeerGalleryVisuals = cache(async () => {
  const pool = await loadMediaPool()
  const scored = pool
    .map((item) => ({ item, score: scoreByKeywords(item, ['олень', 'deer', 'ферма', 'gonba']) }))
    .sort((a, b) => b.score - a.score)

  const best = scored.filter((entry) => entry.score > 0).slice(0, 12).map((entry) => entry.item)
  if (best.length >= 6) return best

  return pool.slice(0, 12)
})
