'use client'

import Image from 'next/image'
import React from 'react'

import type { ProjectRecord } from './shared'

/**
 * Карточка-плашка проекта.
 *
 * Один и тот же компонент используется:
 *  - в EditableProjectsGrid (просмотр + edit-mode на /projects)
 *  - в EditProjectDialog как live-preview редактируемых полей (фаза C)
 *
 * Принимает любой Partial<ProjectRecord> + slug+title — этого достаточно
 * чтобы плашка отрисовалась (отсутствующие поля красиво деградируют:
 * нет картинки → буква, нет accentColor → fallback-палитра по hash slug'а).
 */

export const DEFAULT_SHORT_LABEL = 'Проект'

const FALLBACK_PALETTE = [
  '#2d7a4f',
  '#b85c2a',
  '#3b6ea8',
  '#7a4ca0',
  '#c08a3e',
  '#4a7c6e',
  '#a23e4a',
  '#5c7a3a',
]

export type CardSize = 'hero' | 'normal'

function hashSlug(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function resolveAccent(p: Pick<ProjectRecord, 'accentColor' | 'slug' | 'title'>): string {
  const explicit = p.accentColor?.trim()
  if (explicit && /^#?[0-9a-f]{3,8}$/i.test(explicit)) {
    return explicit.startsWith('#') ? explicit : `#${explicit}`
  }
  const idx = hashSlug(p.slug || p.title || 'x') % FALLBACK_PALETTE.length
  return FALLBACK_PALETTE[idx] || '#2d7a4f'
}

export function imageSrc(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const doc = media as { url?: string | null }
  if (!doc.url) return null
  const url = doc.url
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) return url
  return `/media/${url}`
}

export function pickImage(p: Pick<ProjectRecord, 'logo' | 'heroImage' | 'gallery'>): string | null {
  const fromLogo = imageSrc(p.logo)
  if (fromLogo) return fromLogo
  const fromHero = imageSrc(p.heroImage)
  if (fromHero) return fromHero
  if (Array.isArray(p.gallery) && p.gallery.length > 0) {
    for (const item of p.gallery) {
      const src = imageSrc((item as { image?: unknown })?.image)
      if (src) return src
    }
  }
  return null
}

export function projectLabel(p: Pick<ProjectRecord, 'shortLabel' | 'title'>): string {
  return p.shortLabel && p.shortLabel !== DEFAULT_SHORT_LABEL ? p.shortLabel : p.title
}

export function projectHref(p: Pick<ProjectRecord, 'homeLink' | 'slug'>): string {
  const custom = p.homeLink?.trim()
  if (custom) return custom
  return `/projects/${p.slug}`
}

export function Plate({ project, size }: { project: ProjectRecord; size: CardSize }) {
  const accent = resolveAccent(project)
  const src = pickImage(project)
  const label = projectLabel(project)
  const isHero = size === 'hero'

  const bgStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, #000 40%) 100%)`,
    backgroundColor: accent,
  }

  return (
    <div className="relative h-full w-full text-white" style={bgStyle}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-white/10" />
      <div
        className={[
          'relative z-10 flex h-full w-full',
          isHero ? 'flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7' : 'flex-row items-stretch gap-3 p-4',
        ].join(' ')}
      >
        <div
          className={[
            'relative flex-none overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20',
            isHero
              ? 'aspect-[4/3] w-full sm:aspect-square sm:w-[40%] sm:max-w-[260px]'
              : 'aspect-square w-24 self-center sm:w-28',
          ].join(' ')}
        >
          {src ? (
            <Image
              src={src}
              alt={label}
              fill
              sizes={isHero ? '(min-width: 1024px) 260px, 80vw' : '120px'}
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-4 select-none text-[10rem] font-black leading-none opacity-[0.18]"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {(label || 'П').trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className={['flex min-w-0 flex-1 flex-col', isHero ? 'gap-3' : 'gap-1.5'].join(' ')}>
          <div className="flex items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm',
                isHero ? '' : 'hidden sm:inline-flex',
              ].join(' ')}
            >
              {isHero ? 'Главный проект' : 'Проект'}
            </span>
          </div>
          <h3
            className={[
              'font-semibold leading-tight tracking-tight',
              isHero ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-lg sm:text-xl',
            ].join(' ')}
          >
            {label}
          </h3>
          {project.summary ? (
            <p
              className={[
                'text-white/85',
                isHero ? 'line-clamp-3 text-sm sm:text-base md:line-clamp-4' : 'line-clamp-2 text-sm',
              ].join(' ')}
            >
              {project.summary}
            </p>
          ) : null}
          <span
            className={[
              'mt-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm',
              isHero ? 'w-fit text-sm sm:text-base' : 'w-fit text-xs',
            ].join(' ')}
          >
            Войти в проект
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.65)' }} />
    </div>
  )
}
