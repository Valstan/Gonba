import React from 'react'

import type { ScheduleBlock as ScheduleBlockProps } from '@/payload-types'

export const ScheduleBlock: React.FC<ScheduleBlockProps> = ({ items, title }) => {
  if (!items || items.length === 0) return null

  return (
    <section className="container">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4">
            <div className="font-medium">{item.label}</div>
            {item.time && <div className="text-sm text-muted-foreground">{item.time}</div>}
            {item.note && <div className="w-full text-sm text-muted-foreground">{item.note}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
