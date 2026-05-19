'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { Media } from '@/components/Media'
import { DEFAULT_PROJECT_SECTIONS, type ProjectSectionKey } from '@/app/(frontend)/projects/shared'
import { useProjectContext } from '@/providers/ProjectContext'

const SECTION_TITLES: Record<ProjectSectionKey, string> = {
  feed: 'Жизнь проекта',
  lavka: 'Лавка',
  gallery: 'Галерея',
  contacts: 'Контакты',
  chat: 'Чат',
}

const buildSectionHref = (projectSlug: string, section: ProjectSectionKey | 'home') =>
  section === 'home' ? `/projects/${projectSlug}` : `/projects/${projectSlug}/${section}`

export const ProjectNav: React.FC = () => {
  const pathname = usePathname()
  const { project, enabledSections } = useProjectContext()

  if (!project) return null

  const visibleSections =
    Array.isArray(enabledSections) && enabledSections.length > 0 ? enabledSections : DEFAULT_PROJECT_SECTIONS
  const sections = visibleSections.filter((item): item is ProjectSectionKey => item in SECTION_TITLES)

  return (
    <div className="hidden border-b border-border bg-card/60 backdrop-blur md:block">
      <div className="container flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={buildSectionHref(project.slug, 'home')} className="flex items-center gap-3 min-w-0">
          {project.logo ? (
            <Media
              resource={project.logo}
              className="size-10 rounded-full border border-white/20 bg-white/80 object-cover shadow-sm"
            />
          ) : null}
          <span className="truncate text-sm font-semibold sm:text-base">{project.shortLabel || project.title}</span>
        </Link>

        <nav className="overflow-x-auto">
          <ul className="flex items-center gap-2">
            <li>
              <Link
                href={buildSectionHref(project.slug, 'home')}
                className={`min-h-11 inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === buildSectionHref(project.slug, 'home')
                    ? 'border-[var(--project-accent)] bg-[color:var(--project-accent-soft,transparent)] text-[var(--project-accent)]'
                    : 'border-border/90 hover:bg-accent/40'
                }`}
              >
                Главная
              </Link>
            </li>
            {sections.map((section) => {
              const href = buildSectionHref(project.slug, section)
              const active = pathname === href || pathname.startsWith(`${href}/`)

              return (
                <li key={section}>
                  <Link
                    href={href}
                    className={`min-h-11 inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[var(--project-accent)] bg-[color:var(--project-accent-soft,transparent)] text-[var(--project-accent)]'
                        : 'border-border/90 hover:bg-accent/40'
                    }`}
                  >
                    {SECTION_TITLES[section]}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
