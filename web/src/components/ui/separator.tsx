import * as React from 'react'

import { cn } from '@/utilities/ui'

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

export const Separator: React.FC<SeparatorProps> = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}) => (
  <div
    role={decorative ? 'none' : 'separator'}
    aria-orientation={orientation}
    data-orientation={orientation}
    data-slot="separator"
    className={cn(
      'shrink-0 bg-border/80',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
)
