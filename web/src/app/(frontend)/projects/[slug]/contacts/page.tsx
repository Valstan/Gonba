import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { queryProjectBySlug } from '../../queries'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })

  if (!project) {
    return {
      title: 'Проект не найден',
    }
  }

  return {
    title: `${project.title} — Контакты`,
  }
}

export default async function ProjectContactsPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { href: `/projects/${project.slug}`, label: project.title },
            { label: 'Контакты' },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold">Контакты проекта</h1>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/80 bg-card/80 p-6">
            <h2 className="text-xl font-medium">Основная информация</h2>
            {project.shortLabel ? <p className="mt-4 text-sm text-muted-foreground">{project.shortLabel}</p> : null}
            <h3 className="mt-6 text-sm font-medium">Адрес</h3>
            {project.location?.address ? <p className="mt-2 text-sm text-muted-foreground">{project.location.address}</p> : <p className="mt-2 text-sm text-muted-foreground">Адрес не указан.</p>}
            {project.location?.mapUrl ? (
              <a href={project.location.mapUrl} className="mt-3 inline-block text-sm text-[var(--project-accent)] hover:underline" target="_blank" rel="noreferrer">
                Открыть на карте
              </a>
            ) : null}
          </article>

          <article className="rounded-2xl border border-border/80 bg-card/80 p-6">
            <h2 className="text-xl font-medium">Связь</h2>
            {project.contacts?.phone ? (
              <p className="mt-4 text-sm text-muted-foreground">Телефон: {project.contacts.phone}</p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Телефон не указан</p>
            )}
            {project.contacts?.email ? <p className="mt-3 text-sm text-muted-foreground">Email: {project.contacts.email}</p> : null}
            {project.contacts?.whatsApp ? <p className="mt-3 text-sm text-muted-foreground">WhatsApp: {project.contacts.whatsApp}</p> : null}
          </article>
        </div>
      </section>
    </main>
  )
}
