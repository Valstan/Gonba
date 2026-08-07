import Image from 'next/image'
import Link from 'next/link'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'
import { projectCoverArt, resolveProjectWorld } from './theme'

function mediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const url = (media as { url?: string | null }).url
  if (!url) return null
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('//')) return url
  return `/media/${url}`
}

export function ProjectAtlas({ projects }: { projects: ProjectRecord[] }) {
  return (
    <div className="project-atlas" role="list">
      {projects.map((project, index) => {
        const world = resolveProjectWorld(project)
        const image = projectCoverArt(project) || mediaUrl(project.heroImage) || mediaUrl(project.logo)
        const label = project.shortLabel && project.shortLabel !== 'Проект' ? project.shortLabel : project.title

        return (
          <Link
            key={project.id}
            href={`/projects/${project.slug}`}
            className={`project-atlas__card project-atlas__card--${world.key}${index === 0 ? ' is-featured' : ''}`}
            style={{ '--atlas-art': `url("${world.art}")` } as React.CSSProperties}
            role="listitem"
          >
            <div className="project-atlas__generated" aria-hidden />
            {image ? (
              <div className="project-atlas__media">
                <Image src={image} alt="" fill sizes="(max-width: 767px) 100vw, 40vw" className="object-cover" unoptimized />
              </div>
            ) : null}
            <div className="project-atlas__veil" aria-hidden />
            <div className="project-atlas__content">
              <span className="project-atlas__eyebrow">{world.eyebrow.split(' · ')[0]}</span>
              <h2>{label}</h2>
              <p>{project.excerpt || project.summary || world.invitation}</p>
              <span className="project-atlas__enter">Войти в проект <b aria-hidden>↗</b></span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
