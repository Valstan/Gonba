'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import type { ProjectRecord } from './projects/shared'

type Props = {
  projects: ProjectRecord[]
  centerSlug?: string
}

const FALLBACK_ACCENT = '#2d7a4f'

function imageSrc(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const doc = media as { url?: string | null }
  if (!doc.url) return null
  const url = doc.url
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) return url
  return `/media/${url}`
}

const projectLabel = (p: ProjectRecord) => (p.shortLabel && p.shortLabel !== 'Проект' ? p.shortLabel : p.title)

export const HomeProjectGridMobile: React.FC<Props> = ({ projects, centerSlug = 'gonba' }) => {
  // Центральный проект — первой карточкой.
  const center = projects.find((p) => p.slug === centerSlug)
  const others = projects.filter((p) => p.slug !== centerSlug)
  const ordered = center ? [center, ...others] : others

  return (
    <div className="md:hidden">
      <ul
        role="list"
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [-webkit-overflow-scrolling:touch]"
      >
        {ordered.map((project) => {
          const accent = project.accentColor?.trim() || FALLBACK_ACCENT
          const src = imageSrc(project.logo) || imageSrc(project.heroImage)
          return (
            <li
              key={project.id}
              className="min-w-[78vw] max-w-[78vw] snap-start"
              style={{ '--card-accent': accent } as React.CSSProperties}
            >
              <Link
                href={`/projects/${project.slug}`}
                prefetch={false}
                className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-transform active:scale-[0.98]"
                style={{ borderColor: 'var(--card-accent)' }}
              >
                <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted/40">
                  {src ? (
                    <Image
                      src={src}
                      alt={projectLabel(project)}
                      fill
                      sizes="80vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      {projectLabel(project)}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="text-lg font-semibold leading-tight" style={{ color: 'var(--card-accent)' }}>
                    {projectLabel(project)}
                  </h3>
                  {project.summary ? <p className="line-clamp-3 text-sm text-muted-foreground">{project.summary}</p> : null}
                  <span
                    className="mt-auto inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--card-accent)' }}
                  >
                    Войти в проект →
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="px-3 text-center text-xs text-muted-foreground">↔ листайте, чтобы увидеть все проекты</p>
    </div>
  )
}
