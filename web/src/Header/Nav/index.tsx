'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { NavLink } from '@/components/ui/nav-link'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/utilities/ui'

/**
 * Десктопная навигация в шапке. На мобильных полностью скрыта — за неё отвечает MobileNavSheet.
 */
export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []
  const linkClass = cn(
    'inline-flex min-h-11 items-center px-3 py-2 text-sm font-medium transition-colors hover:text-primary',
  )

  return (
    <nav className="hidden items-center gap-3 md:flex">
      {navItems.map(({ link }, i) => (
        <CMSLink key={i} {...link} appearance="inline" className={linkClass} />
      ))}
      <NavLink href="/search" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full">
        <span className="sr-only">Поиск</span>
        <SearchIcon className="size-5 text-primary" aria-hidden />
      </NavLink>
    </nav>
  )
}
