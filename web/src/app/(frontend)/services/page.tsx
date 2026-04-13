import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'
import { Media } from '@/components/Media'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ServicesPage() {
  const payload = await getPayload({ config: configPromise })

  const services = await payload.find({
    collection: 'services',
    depth: 1,
    limit: 100,
    overrideAccess: false,
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Сервисы' }]} />
      </div>
      <div className="container mb-10 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">Сервисы</h1>
        <AdminManageActions
          addLabel="Добавить сервис"
          addUrl="/admin/collections/services/create"
        />
      </div>
      <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.docs.map((service) => (
          <article key={service.id} className="rounded-xl border border-border p-4">
            {service.heroImage && typeof service.heroImage !== 'string' && (
              <Media resource={service.heroImage} className="rounded-lg" />
            )}
            <h2 className="text-lg font-medium">
              <Link href={`/services/${service.slug}`}>{service.title}</Link>
            </h2>
            {service.summary && <p className="mt-2 text-sm text-muted-foreground">{service.summary}</p>}
            {service.price !== undefined && (
              <p className="mt-2 text-sm text-muted-foreground">Цена: {service.price} {service.currency}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
