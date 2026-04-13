import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'

import { Media } from '@/components/Media'
import { queryProjects } from './queries'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ProjectsPage() {
  const projects = await queryProjects()

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Проекты' }]} />
      </div>
      <div className="container mb-10 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">Проекты</h1>
        <AdminManageActions
          addLabel="Добавить проект"
          addUrl="/admin/collections/projects/create"
        />
      </div>
      <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <article key={project.id} className="rounded-xl border border-border p-4">
            {project.logo ? <Media resource={project.logo} className="size-16 rounded-lg object-cover" /> : null}
            {project.heroImage ? (
              <Media resource={project.heroImage} className="rounded-lg" />
            ) : null}
            <h2 className="mt-4 text-lg font-medium">
              <Link href={`/projects/${project.slug}`}>{project.title}</Link>
            </h2>
            {project.summary && <p className="mt-2 text-sm text-muted-foreground">{project.summary}</p>}
            <p className="mt-2 text-xs text-[var(--project-accent)]">{project.shortLabel || project.title}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
