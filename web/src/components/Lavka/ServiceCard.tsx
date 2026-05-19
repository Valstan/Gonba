import React from 'react'
import Link from 'next/link'

import type { Service } from '@/payload-types'
import { Media } from '@/components/Media'
import { BookingDialog } from './BookingDialog'

const formatPrice = (price?: number | null, currency?: string | null) => {
  if (price == null) return null
  const cur = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽'
  return `${price.toLocaleString('ru-RU')} ${cur}`
}

type Props = {
  service: Service
  projectSlug: string
  projectId: number
}

export const ServiceCard: React.FC<Props> = ({ service, projectSlug, projectId }) => {
  const price = formatPrice(service.price, service.currency)
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
      {service.heroImage ? (
        <div className="aspect-[4/5] overflow-hidden">
          <Media
            resource={service.heroImage}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[4/5] bg-muted/40" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link href={service.slug ? `/services/${service.slug}` : `/projects/${projectSlug}/lavka`}>
            {service.title}
          </Link>
        </h3>
        {service.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{service.summary}</p> : null}
        <div className="mt-auto flex flex-col gap-2">
          {price ? <div className="text-base font-semibold text-[var(--project-accent)]">{price}</div> : null}
          {service.bookingEnabled !== false ? (
            <BookingDialog
              mode="service"
              itemId={service.id}
              itemTitle={service.title}
              projectId={projectId}
              triggerLabel="Записаться"
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}
