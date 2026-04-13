import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import type { Event } from '@/payload-types'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminOverlay } from '@/components/AdminOverlay'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const events = await payload.find({
    collection: 'events',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return events.docs.map(({ slug }) => ({ slug }))
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function EventPage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const url = `/events/${decodedSlug}`

  const event = await queryEventBySlug({ slug: decodedSlug })
  if (!event) return <PayloadRedirects url={url} />
  const eventEditUrl = `/admin/collections/events/${event.id}`

  return (
    <AdminOverlay
      addLabel="Добавить контент"
      addUrl={eventEditUrl}
      editLabel="Редактировать"
      editUrl={eventEditUrl}
      label="событие"
    >
      <article className="pt-16 pb-16">
        <div className="container">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/events', label: 'События' },
              { label: event.title || decodedSlug },
            ]}
          />
        </div>
        <div className="container">
          <h1 className="text-3xl font-semibold">{event.title}</h1>
          {event.summary && <p className="mt-2 text-sm text-muted-foreground">{event.summary}</p>}
          {event.startDate && (
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(event.startDate).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
        {event.heroImage && typeof event.heroImage !== 'string' && (
          <div className="container mt-6">
            <Media resource={event.heroImage} className="rounded-xl" />
          </div>
        )}
        {event.content && (
          <div className="container mt-6">
            <RichText data={event.content} enableGutter={false} />
          </div>
        )}
        {event.gallery && event.gallery.length > 0 && (
          <div className="container mt-8 grid gap-4 md:grid-cols-2">
            {event.gallery.map((item: NonNullable<Event['gallery']>[number], index: number) => (
              <div key={index} className="space-y-2">
                <Media resource={item.image} className="rounded-lg" />
                {item.caption && <p className="text-sm text-muted-foreground">{item.caption}</p>}
              </div>
            ))}
          </div>
        )}
        <PayloadRedirects disableNotFound url={url} />
      </article>
    </AdminOverlay>
  )
}

const queryEventBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'events',
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
