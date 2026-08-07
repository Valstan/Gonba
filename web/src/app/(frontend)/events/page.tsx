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

export default async function EventsPage() {
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай транзиентного сбоя БД (бросает → ISR не кэширует пустым).
  const events = await withRetry(() =>
    payload.find({
      collection: 'events',
      depth: 1,
      limit: 50,
      sort: 'startDate',
      overrideAccess: false,
    }),
  )

  return (
    <main className="editorial-page editorial-page--events pb-24 pt-20">
      <div className="editorial-page__wash" aria-hidden />
      <div className="container editorial-page__breadcrumbs">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'События' }]} />
      </div>
      <header className="container editorial-hero">
        <div className="editorial-hero__art" aria-hidden />
        <div className="editorial-hero__content">
          <p className="editorial-hero__kicker">Афиша на берегу Вятки</p>
          <h1>События, ради которых хочется приехать</h1>
          <p>Праздники, встречи, прогулки и мастерские — ближайшее впереди, воспоминания остаются с нами.</p>
          <AdminManageActions addLabel="Добавить событие" addUrl="/admin/collections/events/create" />
        </div>
      </header>
      <section className="container editorial-list" aria-label="Афиша событий">
        <div className="editorial-list__heading"><span>Календарь</span><h2>Что происходит</h2></div>
        {events.docs.length ? (
          <div className="event-showcase">
            {events.docs.map((event) => {
              const date = event.startDate ? new Date(event.startDate) : null
              return (
                <article key={event.id} className="event-showcase__card">
                  {event.heroImage && typeof event.heroImage !== 'string' ? (
                    <div className="event-showcase__media"><Media resource={event.heroImage} imgClassName="h-full w-full object-cover" /></div>
                  ) : <div className="event-showcase__media is-placeholder" aria-hidden />}
                  <div className="event-showcase__date">
                    <strong>{date ? date.toLocaleDateString('ru-RU', { day: '2-digit' }) : '—'}</strong>
                    <span>{date ? date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') : ''}</span>
                  </div>
                  <div className="event-showcase__content">
                    <p>{date ? date.toLocaleString('ru-RU', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'Дата уточняется'}</p>
                    <h3><Link href={`/events/${event.slug}`}>{event.title}</Link></h3>
                    {event.summary && <div>{event.summary}</div>}
                    <Link href={`/events/${event.slug}`} className="event-showcase__more">Подробнее ↗</Link>
                  </div>
                </article>
              )
            })}
          </div>
        ) : <p className="editorial-empty">Новая афиша уже готовится. Загляните чуть позже.</p>}
      </section>
    </main>
  )
}
