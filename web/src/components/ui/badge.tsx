import * as React from 'react'

import { cn } from '@/utilities/ui'

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'outline' | 'accent'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          variant === 'default' && 'bg-primary text-primary-foreground',
          variant === 'outline' && 'border border-border text-foreground',
          variant === 'accent' && 'bg-accent text-accent-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'
