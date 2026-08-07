import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminOverlay } from '@/components/AdminOverlay'
import { withRetry } from '@/utilities/withRetry'
import { JsonLd } from '@/components/seo/JsonLd'
import { serviceJsonLd } from '@/seo/jsonld'

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
      <article className="min-h-screen bg-[linear-gradient(180deg,rgba(238,227,198,0.72),transparent_45%)] pt-20 pb-20">
        <JsonLd data={serviceJsonLd(service, url)} />
        <div className="container">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/services', label: 'Сервисы' },
              { label: service.title || decodedSlug },
            ]}
          />
        </div>
        <div className="container mt-8 max-w-5xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-amber-800 uppercase">Впечатление в Гоньбе</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">{service.title}</h1>
          {service.summary && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{service.summary}</p>}
          <p className="mt-6 inline-flex rounded-full border border-amber-900/15 bg-white/60 px-5 py-2 text-sm font-semibold text-amber-950">
            {service.price != null
              ? `от ${service.price} ${service.currency === 'RUB' ? '₽' : service.currency || '₽'}`
              : 'Стоимость уточняйте у команды проекта'}
          </p>
        </div>
        {service.heroImage && typeof service.heroImage !== 'string' && (
          <div className="container mt-10 max-w-5xl">
            <Media resource={service.heroImage} className="overflow-hidden rounded-[2rem] shadow-xl" />
          </div>
        )}
        {service.description && (
          <div className="container mt-10 max-w-3xl rounded-3xl bg-card/80 p-6 shadow-sm md:p-10">
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

  // pool #040: ретрай против транзиентного сбоя БД. Бросает после ретраев →
  // ISR не кэширует ложный 404; null (0 docs) = реально нет → штатный 404.
  const result = await withRetry(() =>
    payload.find({
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
    }),
  )

  return result.docs?.[0] || null
})
