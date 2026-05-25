import Link from 'next/link'
import React from 'react'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'

type MediaDoc = { id?: string | number; url?: string | null; alt?: string | null }

function imageUrl(media: unknown): { url: string; alt?: string } | null {
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const doc = media as MediaDoc
  if (!doc.url) return null
  return { url: String(doc.url), alt: (doc.alt as string) || undefined }
}

interface EthnoFeaturedChapterProps {
  project?: ProjectRecord | null
  chapter?: 'I' | 'II' | 'III' | 'IV' | 'V'
  chapterLabel?: string
}

/**
 * Featured-секция «Глава I — село и храм» (или другая по chapterRoman проекта).
 * Двухколоночная: photo (в frame с paper-deep) слева, заголовок+excerpt+CTA справа.
 *
 * Источник: docs/design/handoff-2026-05-23/gonba-home.html строки 397-460 + 872-887.
 */
export const EthnoFeaturedChapter: React.FC<EthnoFeaturedChapterProps> = ({
  project,
  chapter,
  chapterLabel,
}) => {
  if (!project) return null

  const photo = imageUrl(project.heroImage) || imageUrl(project.logo)
  const roman = chapter ?? (project.chapterRoman as 'I' | 'II' | 'III' | 'IV' | 'V' | undefined) ?? 'I'
  const label = chapterLabel || 'село и храм'
  const titleMain = project.title || 'Покровская церковь'
  const titleEm = 'стоит с 1808 года'
  const summary =
    project.excerpt ||
    project.summary ||
    'Каменный пятиглавый храм, заложенный купцом Юшковым. Восстанавливают силами села.'

  return (
    <section className="ethno-featured">
      <div className="container">
        <div className="ethno-featured__grid">
          <div className="ethno-featured__photo">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt={photo.alt ?? titleMain}
                className="ethno-featured__photo-img"
                loading="lazy"
              />
            ) : (
              <div className="ethno-featured__photo-fallback">
                {(photo as { alt?: string } | null)?.alt ?? 'Фото проекта'}
              </div>
            )}
          </div>
          <div>
            <div className="ethno-chapter">
              <span className="ethno-chapter__num">{roman}</span>
              <span>{label}</span>
            </div>
            <h2>
              {titleMain}
              <em>{titleEm}</em>
            </h2>
            <p>{summary}</p>
            <Link className="ethno-btn ethno-btn--ghost" href={`/projects/${project.slug}`}>
              Читать главу
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
