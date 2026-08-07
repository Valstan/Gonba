import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'
import { Media } from '@/components/Media'
import { withRetry } from '@/utilities/withRetry'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ServicesPage() {
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай транзиентного сбоя БД (бросает → ISR не кэширует пустым).
  const services = await withRetry(() =>
    payload.find({
      collection: 'services',
      depth: 1,
      limit: 100,
      overrideAccess: false,
    }),
  )

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(244,235,211,0.72),transparent_38%)] pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Сервисы' }]} />
      </div>
      <div className="container mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-amber-800 uppercase">Чем заняться в Гоньбе</p>
          <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Впечатления и услуги</h1>
          <p className="mt-4 text-muted-foreground">Экскурсии, поездки, мастер-классы и другие поводы познакомиться с Вятским краем ближе.</p>
        </div>
        <AdminManageActions
          addLabel="Добавить сервис"
          addUrl="/admin/collections/services/create"
        />
      </div>
      <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.docs.map((service) => (
          <article key={service.id} className="group overflow-hidden rounded-3xl border border-amber-950/10 bg-card/90 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            {service.heroImage && typeof service.heroImage !== 'string' && (
              <Media resource={service.heroImage} className="aspect-[4/3] overflow-hidden [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition [&_img]:duration-500 group-hover:[&_img]:scale-105" />
            )}
            <div className="p-5">
              <h2 className="text-xl font-semibold leading-snug">
                <Link href={`/services/${service.slug}`}>{service.title}</Link>
              </h2>
              {service.summary && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{service.summary}</p>}
              <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-amber-900">
                  {service.price != null
                    ? `от ${service.price} ${service.currency === 'RUB' ? '₽' : service.currency || '₽'}`
                    : 'Стоимость по запросу'}
                </span>
                <span aria-hidden="true" className="text-xl text-amber-800">→</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
