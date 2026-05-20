import React from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'

import { EditableProjectsGrid } from '../EditableProjectsGrid'
import { queryProjects } from './queries'

// Динамически генерируем — чтобы админские правки плашек подхватывались быстро
export const revalidate = 30

const CENTER_SLUG = 'gonba'

export default async function ProjectsPage() {
  const projects = await queryProjects()
  const centerProject = projects.find((p) => p.slug === CENTER_SLUG) ?? projects[0]

  return (
    <div className="pb-24 pt-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Проекты' }]} />
      </div>
      <div className="container mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Проекты</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Выберите направление. В центре — главный проект экопортала.
          </p>
        </div>
        <AdminManageActions
          addLabel="Добавить проект"
          addUrl="/admin/collections/projects/create"
        />
      </div>
      <div className="container">
        <EditableProjectsGrid initialProjects={projects} centerSlug={centerProject?.slug || CENTER_SLUG} />
      </div>
    </div>
  )
}
