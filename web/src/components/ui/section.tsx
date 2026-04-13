import * as React from 'react'

import { cn } from '@/utilities/ui'

export type SectionProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export const Section: React.FC<SectionProps> = ({ title, subtitle, actions, className, children, ...props }) => {
  return (
    <section className={cn('container py-8', className)} {...props}>
      {(title || subtitle || actions) && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-2xl font-semibold">{title}</h2>}
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
