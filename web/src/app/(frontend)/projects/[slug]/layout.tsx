import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

import { ProjectNav } from '@/components/ProjectNav'
import { ProjectBottomTabs } from '@/components/ProjectNav/ProjectBottomTabs'
import { ProjectDecor, resolveProjectTheme, type DecorMotif } from '@/components/ProjectDecor'
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

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  // Единый источник accent + мотива: явные поля проекта или детерминированный
  // подбор по slug (чтобы проекты различались даже без ручной разметки).
  const decorMotif = (project as { decorMotif?: DecorMotif | null }).decorMotif ?? null
  const { accent } = resolveProjectTheme(project.slug || slug, project.accentColor, decorMotif)
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
        <ProjectDecor slug={project.slug || slug} accentColor={project.accentColor} decorMotif={decorMotif} />
        <ProjectNav />
        <div key={project.slug} className="project-layout animate-fade-in pb-24 md:pb-0">
          {children}
        </div>
        <ProjectBottomTabs />
      </div>
    </ProjectProvider>
  )
}
