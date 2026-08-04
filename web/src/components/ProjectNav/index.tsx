'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { Media } from '@/components/Media'
import { DEFAULT_PROJECT_SECTIONS, type ProjectSectionKey } from '@/app/(frontend)/projects/shared'
import { useProjectContext } from '@/providers/ProjectContext'
import { ProjectSwitcher } from './ProjectSwitcher.client'

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
  const { project, projects, enabledSections } = useProjectContext()

  if (!project) return null

  const visibleSections =
    Array.isArray(enabledSections) && enabledSections.length > 0 ? enabledSections : DEFAULT_PROJECT_SECTIONS
  const sections = visibleSections.filter((item): item is ProjectSectionKey => item in SECTION_TITLES)

  return (
    <div className="project-dock hidden md:block">
      <div className="container project-dock__inner">
        <div className="project-dock__identity">
          {project.logo ? <Media resource={project.logo} className="project-dock__logo" /> : null}
          <ProjectSwitcher current={project} projects={projects} />
        </div>

        <nav aria-label="Разделы проекта">
          <ul className="project-dock__sections">
            <li>
              <Link
                href={buildSectionHref(project.slug, 'home')}
                className={`project-dock__link ${
                  pathname === buildSectionHref(project.slug, 'home')
                    ? 'is-active'
                    : ''
                }`}
              >
                Обзор
              </Link>
            </li>
            {sections.map((section) => {
              const href = buildSectionHref(project.slug, section)
              const active = pathname === href || pathname.startsWith(`${href}/`)

              return (
                <li key={section}>
                  <Link
                    href={href}
                    className={`project-dock__link ${
                      active
                        ? 'is-active'
                        : ''
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
