import Link from 'next/link'
import Image from 'next/image'
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
  stay: { title: 'Пожить', subtitle: 'Гостевые домики, баня, бассейн и отдых на берегу Вятки.' },
  do: {
    title: 'Заняться',
    subtitle: 'Сельские экскурсии, путешествия, мастерские, рыбалка и прокат.',
  },
  see: { title: 'Увидеть', subtitle: 'История Гоньбы, храм, оленья ферма, сады и события села.' },
  shop: {
    title: 'Унести с собой',
    subtitle: 'Вятские травы, ремесленные изделия и подарки с характером.',
  },
}

const GROUPS: Array<{ key: EthnoHomepageGroup; label: string; eyebrow: string }> = [
  { key: 'stay', label: 'Пожить', eyebrow: 'Домики и отдых' },
  { key: 'do', label: 'Заняться', eyebrow: 'Маршруты и дела' },
  { key: 'see', label: 'Увидеть', eyebrow: 'Места и истории' },
  { key: 'shop', label: 'Унести с собой', eyebrow: 'Ремёсла и дары' },
]

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
    : {
        title: 'Живая Гоньба',
        subtitle:
          'Место, где сельское хозяйство, путешествия и ремёсла становятся поводом приехать — и вернуться.',
      }

  return (
    <main className="overflow-hidden pb-24">
      <section className="relative border-b border-[#d8c9ac] bg-[#f2e7d1] pb-12 pt-16 sm:pb-16 sm:pt-20">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(#9b342b 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-20 -top-28 h-[420px] w-[420px] rounded-full bg-[#d09b42]/25 blur-3xl"
        />
        <div className="container relative">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              group ? { href: '/projects', label: 'Проекты' } : { label: 'Проекты' },
              ...(group ? [{ label: heading.title }] : []),
            ]}
          />
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_280px]">
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[.28em] text-[#8e3029]">
                Все направления · Малмыжский район
              </p>
              <h1 className="max-w-4xl font-serif text-5xl leading-[.95] text-[#28231d] sm:text-7xl lg:text-8xl">
                {heading.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#5c5145] sm:text-xl">
                {heading.subtitle}
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link
                  href="/projects"
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${!group ? 'border-[#28231d] bg-[#28231d] text-white' : 'border-[#ad9d82] bg-white/45 hover:bg-white'}`}
                >
                  Все проекты · {all.length}
                </Link>
                {GROUPS.map((item) => {
                  const count = all.filter((project) => project.homepageGroup === item.key).length
                  return (
                    <Link
                      key={item.key}
                      href={`/projects?group=${item.key}`}
                      title={item.eyebrow}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${group === item.key ? 'border-[#8e3029] bg-[#8e3029] text-white' : 'border-[#ad9d82] bg-white/45 hover:bg-white'}`}
                    >
                      {item.label} · {count}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="relative mx-auto hidden aspect-square w-full max-w-[260px] items-center justify-center rounded-full border border-[#aa9270]/50 bg-[#fffaf0]/60 p-7 shadow-[0_25px_70px_rgba(70,45,20,.15)] lg:flex">
              <Image
                src="/brand/gonba-mark.png"
                alt="Логотип «Гоньба — Жемчужина Вятки»"
                width={512}
                height={512}
                priority
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container pt-10 sm:pt-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.24em] text-muted-foreground">
              Каталог впечатлений
            </p>
            <h2 className="mt-1 font-serif text-3xl sm:text-4xl">
              {group ? heading.title : 'Выберите свою Гоньбу'}
            </h2>
          </div>
          <AdminManageActions
            addLabel="Добавить проект"
            addUrl="/admin/collections/projects/create"
          />
        </div>
        {projects.length > 0 ? (
          <EditableProjectsGrid
            initialProjects={projects}
            centerSlug={centerProject?.slug || CENTER_SLUG}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            В этом разделе пока нет проектов.{' '}
            <Link href="/projects" className="underline">
              Посмотреть все
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  )
}
