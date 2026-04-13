import React from 'react'

import type { TestimonialsBlock as TestimonialsBlockProps } from '@/payload-types'
import { Media } from '@/components/Media'

export const TestimonialsBlock: React.FC<TestimonialsBlockProps> = ({ items, title }) => {
  if (!items || items.length === 0) return null

  return (
    <section className="container">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              {item.photo && <Media resource={item.photo} className="h-12 w-12 rounded-full" />}
              <div>
                <div className="font-medium">{item.name}</div>
                {item.role && <div className="text-xs text-muted-foreground">{item.role}</div>}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{item.quote}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
