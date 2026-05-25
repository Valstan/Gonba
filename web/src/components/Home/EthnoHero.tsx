import React from 'react'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'

type MediaDoc = { id?: string | number; url?: string | null; alt?: string | null }

function imageUrl(media: unknown): { url: string; alt?: string } | null {
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const doc = media as MediaDoc
  if (!doc.url) return null
  return { url: String(doc.url), alt: (doc.alt as string) || undefined }
}

interface EthnoHeroProps {
  project?: ProjectRecord | null
}

/**
 * Hero-секция этно-модерн главной. Full-bleed фото проекта с overlay
 * и заголовком «Гоньба — *жемчужина* Вятки» с italic-ochre акцентом.
 *
 * Источник: docs/design/handoff-2026-05-23/gonba-home.html строки 303-349 + 826-837.
 */
export const EthnoHero: React.FC<EthnoHeroProps> = ({ project }) => {
  const bgImage = imageUrl(project?.heroImage) || imageUrl(project?.logo)
  const eyebrow = '· село на правом берегу Вятки ·'
  const subtitle =
    project?.excerpt ||
    'Десять проектов, которые держат село живым: храм, эко-отель, мастерские, конный клуб, ремёсла.'

  return (
    <section className="ethno-hero">
      <div className="ethno-hero__bg">
        {bgImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage.url}
            alt={bgImage.alt ?? ''}
            className="ethno-hero__bg-img"
            loading="eager"
            width="2400"
            height="1600"
          />
        ) : null}
      </div>
      <div className="ethno-hero__overlay" />
      <div className="ethno-hero__content container">
        <div className="ethno-eyebrow">{eyebrow}</div>
        <h1>
          Гоньба&nbsp;—
          <br />
          <em>жемчужина</em>
          <br />
          Вятки.
        </h1>
        <p>{subtitle}</p>
      </div>
    </section>
  )
}
