import React from 'react'

import type { GalleryBlock as GalleryBlockProps } from '@/payload-types'
import { Media } from '@/components/Media'

export const GalleryBlock: React.FC<GalleryBlockProps> = ({ items, title }) => {
  if (!items || items.length === 0) return null

  return (
    <section className="container">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={index} className="space-y-2">
            <Media resource={item.image} className="rounded-xl" />
            {item.caption && <p className="text-sm text-muted-foreground">{item.caption}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
