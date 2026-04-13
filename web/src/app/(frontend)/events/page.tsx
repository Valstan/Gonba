import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminManageActions } from '@/components/AdminOverlay'
import { Media } from '@/components/Media'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function EventsPage() {
  const payload = await getPayload({ config: configPromise })

  const events = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 50,
    overrideAccess: false,
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'События' }]} />
      </div>
      <div className="container mb-10 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">События</h1>
        <AdminManageActions addLabel="Добавить событие" addUrl="/admin/collections/events/create" />
      </div>
      <div className="container grid gap-6 md:grid-cols-2">
        {events.docs.map((event) => (
          <article key={event.id} className="rounded-xl border border-border p-4">
            {event.heroImage && typeof event.heroImage !== 'string' && (
              <Media resource={event.heroImage} className="rounded-lg" />
            )}
            <h2 className="text-lg font-medium">
              <Link href={`/events/${event.slug}`}>{event.title}</Link>
            </h2>
            {event.startDate && (
              <p className="mt-2 text-sm text-muted-foreground">
                {new Date(event.startDate).toLocaleString('ru-RU')}
              </p>
            )}
            {event.summary && <p className="mt-2 text-sm text-muted-foreground">{event.summary}</p>}
          </article>
        ))}
      </div>
    </div>
  )
}
