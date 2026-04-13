import React from 'react'

import type { FAQBlock as FAQBlockProps } from '@/payload-types'

export const FAQBlock: React.FC<FAQBlockProps> = ({ items, title }) => {
  if (!items || items.length === 0) return null

  return (
    <section className="container">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <h3 className="font-medium">{item.question}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
