'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'
import { resolveProjectWorld } from '@/components/ProjectWorld/theme'

type Props = {
  current: ProjectRecord
  projects: ProjectRecord[]
}

export function ProjectSwitcher({ current, projects }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="project-switcher" ref={rootRef}>
      <button
        type="button"
        className="project-switcher__trigger"
        aria-expanded={open}
        aria-controls="project-switcher-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="project-switcher__eyebrow">Сейчас внутри</span>
        <strong>{current.shortLabel || current.title}</strong>
        <span className="project-switcher__chevron" aria-hidden>⌄</span>
      </button>

      {open ? (
        <div id="project-switcher-panel" className="project-switcher__panel">
          <div className="project-switcher__intro">
            <span>Перейти в другой проект</span>
            <Link href="/projects">Смотреть все</Link>
          </div>
          <div className="project-switcher__grid">
            {projects.map((project) => {
              const world = resolveProjectWorld(project)
              const active = project.slug === current.slug
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className={`project-switcher__item${active ? ' is-active' : ''}`}
                  style={{ '--switcher-art': `url("${world.art}")` } as React.CSSProperties}
                  aria-current={active ? 'page' : undefined}
                >
                  <span>{project.shortLabel || project.title}</span>
                  <small>{world.eyebrow.split(' · ')[0]}</small>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
