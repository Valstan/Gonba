import type { Metadata } from 'next'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { HomeCarouselMenuClient } from './HomeCarouselMenuClient'
import { queryProjects } from './projects/queries'

export const metadata: Metadata = {
  title: 'Жемчужина Вятки — главная',
  description: 'Главное меню проектов Жемчужины Вятки в формате интерактивной карты.',
}

export const revalidate = 600

type MediaDoc = { id?: string | number; url?: string | null; alt?: string | null }
type HomeCarouselGlobal = {
  center?: { link?: string | null; image?: unknown } | null
  items?: Array<{ link?: string | null; image?: unknown }> | null
}

function toOrbitImage(media: unknown) {
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const doc = media as MediaDoc
  if (!doc.url) return null
  return { id: String(doc.id ?? ''), url: String(doc.url), alt: (doc.alt as string) || undefined }
}

const normalizeLinkKey = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase()

const CENTER_SLUG = 'gonba'
const DEFAULT_SHORT_LABEL = 'Проект'

const projectLabel = (p: { shortLabel?: string | null; title: string }) =>
  p.shortLabel && p.shortLabel !== DEFAULT_SHORT_LABEL ? p.shortLabel : p.title

export default async function HomePage() {
  const projects = await queryProjects()
  const payload = await getPayload({ config: configPromise })

  let legacyCarousel: HomeCarouselGlobal | null = null
  try {
    legacyCarousel = (await payload.findGlobal({ slug: 'homeCarousel', depth: 1 })) as HomeCarouselGlobal
  } catch {
    legacyCarousel = null
  }

  const legacyImageByLink = new Map<string, ReturnType<typeof toOrbitImage>>()
  for (const item of legacyCarousel?.items || []) {
    const link = typeof item?.link === 'string' ? item.link : ''
    if (!link) continue
    const key = normalizeLinkKey(link)
    if (!legacyImageByLink.has(key)) {
      legacyImageByLink.set(key, toOrbitImage(item.image))
    }
  }

  const centerProject = projects.find((p) => p.slug === CENTER_SLUG) ?? projects[0]
  const orbitProjects = projects.filter((p) => p.slug !== centerProject?.slug).slice(0, 12)
  const centerLink = centerProject ? `/projects/${centerProject.slug}` : '/projects/gonba'
  const centerKey = normalizeLinkKey(centerLink)
  const legacyCenterImage = toOrbitImage(legacyCarousel?.center?.image)

  const centerItem = centerProject
    ? {
        title: projectLabel(centerProject),
        link: centerLink,
        image:
          toOrbitImage(centerProject.logo) ||
          toOrbitImage(centerProject.heroImage) ||
          legacyCenterImage ||
          legacyImageByLink.get(centerKey) ||
          null,
      }
    : { title: 'Вятские олени', link: '/projects/gonba', image: null }

  const orbitItems = orbitProjects.map((p) => ({
    id: String(p.id),
    title: projectLabel(p),
    link: `/projects/${p.slug}`,
    image:
      toOrbitImage(p.logo) ||
      toOrbitImage(p.heroImage) ||
      legacyImageByLink.get(normalizeLinkKey(`/projects/${p.slug}`)) ||
      null,
  }))

  return (
    <main className="homeOrbitPage pb-20 pt-20">
      <section className="container">
        <div className="homeOrbitPage__intro">
          <h1 className="homeOrbitPage__title">Жемчужина Вятки</h1>
          <p className="homeOrbitPage__subtitle">
            Выберите направление проекта. В центре — главный проект экопортала.
          </p>
        </div>

        <HomeCarouselMenuClient centerItem={centerItem} items={orbitItems} />
      </section>
    </main>
  )
}
