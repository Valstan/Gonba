import * as React from 'react'

import { cn } from '@/utilities/ui'

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted/60', className)} {...props} />
)
