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
    title: `${project.title} — Услуги`,
  }
}

export default async function ProjectServicesPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const payload = await getPayload({ config: configPromise })
  const services = await payload.find({
    collection: 'services',
    depth: 1,
    sort: '-updatedAt',
    limit: 100,
    overrideAccess: false,
    where: {
      project: {
        equals: project.id,
      },
    },
    select: {
      title: true,
      slug: true,
      summary: true,
      price: true,
      currency: true,
      heroImage: true,
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
            { label: 'Услуги' },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold">Услуги проекта</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.docs.length > 0 ? (
            services.docs.map((service) => (
              <article key={service.id} className="rounded-xl border border-border p-4">
                {service.heroImage ? <Media resource={service.heroImage} className="rounded-lg" /> : null}
                <h2 className="text-lg font-medium">{service.title || 'Услуга'}</h2>
                {service.summary ? <p className="mt-2 text-sm text-muted-foreground">{service.summary}</p> : null}
                {typeof service.price !== 'undefined' ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Цена: {service.price} {service.currency || 'RUB'}
                  </p>
                ) : null}
                {service.slug ? (
                  <Link href={`/services/${service.slug}`} className="mt-4 inline-block text-sm text-[var(--project-accent)] hover:underline">
                    Подробнее
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Услуги пока не добавлены.</p>
          )}
        </div>
      </section>
    </main>
  )
}
