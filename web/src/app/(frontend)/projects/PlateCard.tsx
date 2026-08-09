'use client'

import Image from 'next/image'
import React from 'react'

import type { ProjectRecord } from './shared'
import { projectCoverImage, projectMediaUrl } from '@/components/ProjectWorld/projectImage'

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
  return projectMediaUrl(media)
}

export function pickImage(
  p: Pick<ProjectRecord, 'logo' | 'heroImage' | 'gallery' | 'slug'>,
): string | null {
  return projectCoverImage(p)
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
  const logoSrc = project.slug === 'gonba' ? '/brand/gonba-mark.png' : imageSrc(project.logo)
  const label = projectLabel(project)
  const isHero = size === 'hero'

  const bgStyle: React.CSSProperties = { backgroundColor: accent }

  return (
    <div className="relative h-full w-full text-white" style={bgStyle}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={isHero ? '(min-width: 1024px) 1200px, 100vw' : '(min-width: 1024px) 33vw, 100vw'}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          unoptimized={src.startsWith('/api/')}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 80% 20%, white 0 2px, transparent 3px)',
            backgroundSize: '28px 28px',
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: `linear-gradient(110deg, ${accent}66 0%, transparent 55%)` }}
      />

      <div
        className={[
          'relative z-10 flex h-full flex-col justify-end',
          isHero ? 'min-h-[360px] p-6 sm:min-h-[430px] sm:p-9 lg:p-11' : 'min-h-[290px] p-5 sm:p-6',
        ].join(' ')}
      >
        <div className={['flex min-w-0 flex-col', isHero ? 'max-w-3xl gap-3' : 'gap-2'].join(' ')}>
          <div className="flex items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm',
                isHero ? '' : '',
              ].join(' ')}
            >
              {isHero ? 'Гоньба · Жемчужина Вятки' : 'Направление'}
            </span>
            {logoSrc ? (
              <span className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#fffaf0]/95 p-1.5 shadow-lg ring-1 ring-black/10">
                <Image
                  src={logoSrc}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                  unoptimized={logoSrc.startsWith('/api/')}
                />
              </span>
            ) : null}
          </div>
          <h3
            className={[
              'font-semibold leading-tight tracking-tight',
              isHero
                ? 'max-w-2xl font-serif text-3xl sm:text-5xl md:text-6xl'
                : 'font-serif text-2xl sm:text-3xl',
            ].join(' ')}
          >
            {label}
          </h3>
          {project.summary ? (
            <p
              className={[
                'text-white/85',
                isHero
                  ? 'line-clamp-3 max-w-2xl text-sm sm:text-lg md:line-clamp-4'
                  : 'line-clamp-2 text-sm sm:text-base',
              ].join(' ')}
            >
              {project.summary}
            </p>
          ) : null}
          <span
            className={[
              'mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-black',
              isHero ? 'text-sm sm:text-base' : 'text-xs',
            ].join(' ')}
          >
            Войти в проект
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}
