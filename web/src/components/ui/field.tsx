import * as React from 'react'

import { cn } from '@/utilities/ui'

export type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string
  description?: string
  error?: string
}

export const Field: React.FC<FieldProps> = ({ label, description, error, className, children, ...props }) => {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label && <label className="text-sm font-medium">{label}</label>}
      {children}
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
