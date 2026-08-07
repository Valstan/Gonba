import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

import { ProjectNav } from '@/components/ProjectNav'
import { ProjectBottomTabs } from '@/components/ProjectNav/ProjectBottomTabs'
import { ProjectSwitcher } from '@/components/ProjectNav/ProjectSwitcher.client'
import { ProjectDecor, resolveProjectTheme, type DecorMotif } from '@/components/ProjectDecor'
import { ProjectProvider } from '@/providers/ProjectContext'
import { normalizeSections } from '../shared'
import { queryProjectBySlug, queryProjects } from '../queries'
import { projectWorldStyle, resolveProjectWorld } from '@/components/ProjectWorld/theme'
import { JsonLd } from '@/components/seo/JsonLd'
import { projectJsonLd } from '@/seo/jsonld'

export const revalidate = 600

type LayoutProps = {
  children: ReactNode
  params: Promise<{
    slug: string
  }>
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const [project, projects] = await Promise.all([queryProjectBySlug({ slug }), queryProjects()])
  if (!project) return notFound()

  // Единый источник accent + мотива: явные поля проекта или детерминированный
  // подбор по slug (чтобы проекты различались даже без ручной разметки).
  const decorMotif = (project as { decorMotif?: DecorMotif | null }).decorMotif ?? null
  const { accent } = resolveProjectTheme(project.slug || slug, project.accentColor, decorMotif)
  const enabledSections = normalizeSections(project.enabledSections)

  const world = resolveProjectWorld(project)

  return (
    <ProjectProvider project={project} projects={projects} enabledSections={enabledSections}>
      {/* pool #051 (GEO): Organization-узел проекта — серверно, на всех вкладках. */}
      <JsonLd data={projectJsonLd(project, `/projects/${project.slug || slug}`)} />
      <div
        className="relative isolate min-h-screen"
        style={
          {
            '--project-accent': accent,
            '--project-accent-soft': `color-mix(in oklab, ${accent} 12%, transparent)`,
            ...projectWorldStyle(project, accent),
          } as CSSProperties
        }
        data-project-world={world.key}
        data-project-signature={world.signature}
      >
        <ProjectDecor slug={project.slug || slug} accentColor={project.accentColor} decorMotif={decorMotif} />
        <div className="relative z-[1]">
          <ProjectNav />
          <div className="project-mobile-switcher md:hidden">
            <ProjectSwitcher current={project} projects={projects} />
          </div>
          <div key={project.slug} className="project-layout animate-fade-in pb-24 md:pb-0">
            {children}
          </div>
          <ProjectBottomTabs />
        </div>
      </div>
    </ProjectProvider>
  )
}
