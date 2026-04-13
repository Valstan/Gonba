'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { cn } from '@/utilities/ui'

export type NavLinkProps = React.ComponentProps<typeof Link> & {
  activeClassName?: string
}

export const NavLink: React.FC<NavLinkProps> = ({ className, activeClassName, href, prefetch, ...props }) => {
  const pathname = usePathname()
  const isActive = pathname === href || (typeof href === 'string' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      prefetch={prefetch ?? false}
      className={cn(
        'text-sm font-medium transition-colors hover:text-primary',
        isActive && 'text-primary',
        activeClassName,
        className,
      )}
      {...props}
    />
  )
}
