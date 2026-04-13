import React from 'react'

import type { BookingCTABlock as BookingCTABlockProps } from '@/payload-types'
import { CMSLink } from '@/components/Link'

export const BookingCTABlock: React.FC<BookingCTABlockProps> = ({ action, description, title }) => {
  return (
    <section className="container">
      <div className="rounded-2xl border border-border p-6 md:p-8">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        {action && (
          <div className="mt-4">
            <CMSLink {...action} />
          </div>
        )}
      </div>
    </section>
  )
}
