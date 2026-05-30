import type { Metadata } from 'next'
import React from 'react'

import { EthnoFeaturedChapter } from '@/components/Home/EthnoFeaturedChapter'
import { EthnoGroupCards } from '@/components/Home/EthnoGroupCards'
import { EthnoHero } from '@/components/Home/EthnoHero'
import { EthnoQuoteSection } from '@/components/Home/EthnoQuoteSection'
import type { ProjectRecord } from '../projects/shared'
import { queryProjects } from '../projects/queries'

export const metadata: Metadata = {
  title: 'Усадьба · Гоньба',
  description:
    'Этно-усадьба, эко-отель, ремесленные мастерские и магазин вятских сборов в селе Гоньба на правом берегу Вятки.',
}

export const revalidate = 600

const HERO_FALLBACK_SLUG = 'village-and-temple'

export default async function UsadbaPage() {
  const projects = await queryProjects()

  const heroProject =
    projects.find((p: ProjectRecord) => p.isHeroOfHomepage === true) ??
    projects.find((p: ProjectRecord) => p.slug === HERO_FALLBACK_SLUG) ??
    projects[0] ??
    null

  const featuredProject =
    projects.find(
      (p: ProjectRecord) => p.isFeatured === true && (p.chapterRoman === 'I' || !p.chapterRoman),
    ) ?? heroProject

  return (
    <>
      <EthnoHero project={heroProject} />
      <EthnoGroupCards projects={projects} />
      <EthnoFeaturedChapter project={featuredProject} chapter="I" chapterLabel="село и храм" />
      <EthnoQuoteSection />
    </>
  )
}
