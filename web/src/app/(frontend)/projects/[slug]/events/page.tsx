import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Media } from '@/components/Media'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-static'
export const revalidate = 600

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
    title: `${project.title} — События`,
  }
}

export default async function ProjectEventsPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const payload = await getPayload({ config: configPromise })
  const events = await payload.find({
    collection: 'events',
    depth: 1,
    sort: 'startDate',
    limit: 50,
    overrideAccess: false,
    where: {
      project: {
        equals: project.id,
      },
    },
  })

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { href: `/projects/${project.slug}`, label: project.title },
            { label: 'События' },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold">События проекта</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {events.docs.length > 0 ? (
            events.docs.map((event) => (
              <article key={event.id} className="rounded-xl border border-border p-4">
                {event.heroImage ? <Media resource={event.heroImage} className="rounded-lg" /> : null}
                <h2 className="text-lg font-medium">
                  <Link href={event.slug ? `/events/${event.slug}` : '/events'} className="hover:text-[var(--project-accent)]">
                    {event.title}
                  </Link>
                </h2>
                {event.startDate ? <p className="mt-2 text-sm text-muted-foreground">{new Date(event.startDate).toLocaleString('ru-RU')}</p> : null}
                {event.summary ? <p className="mt-2 text-sm text-muted-foreground">{event.summary}</p> : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Событий пока нет.</p>
          )}
        </div>
      </section>
    </main>
  )
}
