import React from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'

import { EditableProjectsGrid } from '../EditableProjectsGrid'
import { queryProjects } from './queries'
import type { EthnoHomepageGroup, ProjectRecord } from './shared'

// Динамически генерируем — чтобы админские правки плашек подхватывались быстро
export const revalidate = 30

const CENTER_SLUG = 'gonba'

// Метаданные групп для фильтра ?group= (ведут сюда пункты шапки/футера/EthnoGroupCards).
const GROUP_META: Record<EthnoHomepageGroup, { title: string; subtitle: string }> = {
  stay: { title: 'Пожить', subtitle: 'Где остановиться: эко-отель и бронирование.' },
  do: { title: 'Делать', subtitle: 'Чем заняться: мастерские, экскурсии, конный клуб.' },
  see: { title: 'Смотреть', subtitle: 'Что посмотреть: студии, события, село и храм.' },
  shop: { title: 'Лавка', subtitle: 'Купить: вятские сборы и изделия.' },
}

const isGroup = (v: string | undefined): v is EthnoHomepageGroup =>
  v === 'stay' || v === 'do' || v === 'see' || v === 'shop'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[] }>
}) {
  const sp = await searchParams
  const groupRaw = Array.isArray(sp?.group) ? sp.group[0] : sp?.group
  const group = isGroup(groupRaw) ? groupRaw : undefined

  const all = await queryProjects()
  const projects = group ? all.filter((p: ProjectRecord) => p.homepageGroup === group) : all
  const centerProject = projects.find((p) => p.slug === CENTER_SLUG) ?? projects[0]

  const heading = group
    ? GROUP_META[group]
    : { title: 'Проекты', subtitle: 'Выберите направление. В центре — главный проект экопортала.' }

  return (
    <div className="pb-24 pt-24">
      <div className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            group ? { href: '/projects', label: 'Проекты' } : { label: 'Проекты' },
            ...(group ? [{ label: heading.title }] : []),
          ]}
        />
      </div>
      <div className="container mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{heading.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{heading.subtitle}</p>
        </div>
        <AdminManageActions addLabel="Добавить проект" addUrl="/admin/collections/projects/create" />
      </div>
      <div className="container">
        {projects.length > 0 ? (
          <EditableProjectsGrid
            initialProjects={projects}
            centerSlug={centerProject?.slug || CENTER_SLUG}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            В этом разделе пока нет проектов.{' '}
            <a href="/projects" className="underline">
              Посмотреть все
            </a>
            .
          </p>
        )}
      </div>
    </div>
  )
}
