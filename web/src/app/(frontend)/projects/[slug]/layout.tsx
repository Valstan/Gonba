import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

import { ProjectNav } from '@/components/ProjectNav'
import { ProjectProvider } from '@/providers/ProjectContext'
import { queryProjectBySlug, DEFAULT_PROJECT_SECTIONS } from '../queries'

export const revalidate = 600

type LayoutProps = {
  children: ReactNode
  params: Promise<{
    slug: string
  }>
}

const FALLBACK_ACCENT = '#2d7a4f'

const normalizeSections = (sections?: Array<string | null> | null) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return DEFAULT_PROJECT_SECTIONS
  }

  return sections.filter((item): item is 'posts' | 'events' | 'services' | 'shop' | 'gallery' | 'contacts' => {
    return item === 'posts' || item === 'events' || item === 'services' || item === 'shop' || item === 'gallery' || item === 'contacts'
  })
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const accent = typeof project.accentColor === 'string' && project.accentColor.trim().length > 0 ? project.accentColor.trim() : FALLBACK_ACCENT
  const enabledSections = normalizeSections(project.enabledSections)

  return (
    <ProjectProvider project={{ ...project, enabledSections }}>
      <div
        style={
          {
            '--project-accent': accent,
            '--project-accent-light': accent,
          } as CSSProperties
        }
      >
        <ProjectNav />
        <div className="project-layout">{children}</div>
      </div>
    </ProjectProvider>
  )
}
