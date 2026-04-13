import React from 'react'

import type { PricingBlock as PricingBlockProps } from '@/payload-types'

export const PricingBlock: React.FC<PricingBlockProps> = ({ items, title }) => {
  if (!items || items.length === 0) return null

  return (
    <section className="container">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-medium">{item.name}</h3>
              {item.price !== undefined && (
                <div className="text-lg font-semibold">
                  {item.price} {item.unit ? item.unit : ''}
                </div>
              )}
            </div>
            {item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
