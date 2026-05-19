import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

import { ProjectNav } from '@/components/ProjectNav'
import { ProjectBottomTabs } from '@/components/ProjectNav/ProjectBottomTabs'
import { ProjectProvider } from '@/providers/ProjectContext'
import { normalizeSections } from '../shared'
import { queryProjectBySlug } from '../queries'

export const revalidate = 600

type LayoutProps = {
  children: ReactNode
  params: Promise<{
    slug: string
  }>
}

const FALLBACK_ACCENT = '#2d7a4f'

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const accent =
    typeof project.accentColor === 'string' && project.accentColor.trim().length > 0
      ? project.accentColor.trim()
      : FALLBACK_ACCENT
  const enabledSections = normalizeSections(project.enabledSections)

  return (
    <ProjectProvider project={project} enabledSections={enabledSections}>
      <div
        style={
          {
            '--project-accent': accent,
            '--project-accent-soft': `color-mix(in oklab, ${accent} 12%, transparent)`,
          } as CSSProperties
        }
      >
        <ProjectNav />
        <div key={project.slug} className="project-layout animate-fade-in pb-24 md:pb-0">
          {children}
        </div>
        <ProjectBottomTabs />
      </div>
    </ProjectProvider>
  )
}
