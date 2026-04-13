import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminOverlay } from '@/components/AdminOverlay'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const services = await payload.find({
    collection: 'services',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return services.docs.map(({ slug }) => ({ slug }))
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function ServicePage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const url = `/services/${decodedSlug}`

  const service = await queryServiceBySlug({ slug: decodedSlug })
  if (!service) return <PayloadRedirects url={url} />
  const serviceEditUrl = `/admin/collections/services/${service.id}`

  return (
    <AdminOverlay
      addLabel="Добавить контент"
      addUrl={serviceEditUrl}
      editLabel="Редактировать"
      editUrl={serviceEditUrl}
      label="сервис"
    >
      <article className="pt-16 pb-16">
        <div className="container">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/services', label: 'Сервисы' },
              { label: service.title || decodedSlug },
            ]}
          />
        </div>
        <div className="container">
          <h1 className="text-3xl font-semibold">{service.title}</h1>
          {service.summary && <p className="mt-2 text-sm text-muted-foreground">{service.summary}</p>}
          {service.price !== undefined && (
            <p className="mt-2 text-sm text-muted-foreground">Цена: {service.price} {service.currency}</p>
          )}
        </div>
        {service.heroImage && typeof service.heroImage !== 'string' && (
          <div className="container mt-6">
            <Media resource={service.heroImage} className="rounded-xl" />
          </div>
        )}
        {service.description && (
          <div className="container mt-6">
            <RichText data={service.description} enableGutter={false} />
          </div>
        )}
        <PayloadRedirects disableNotFound url={url} />
      </article>
    </AdminOverlay>
  )
}

const queryServiceBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'services',
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
