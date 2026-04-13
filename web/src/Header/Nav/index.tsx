'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { NavLink } from '@/components/ui/nav-link'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/utilities/ui'

export const HeaderNav: React.FC<{ data: HeaderType; isOpen?: boolean; onNavigate?: () => void }> = ({
  data,
  isOpen,
  onNavigate,
}) => {
  const navItems = data?.navItems || []
  const navClass = cn(
    'fixed inset-x-3 top-24 z-40 flex flex-col gap-2 rounded-2xl border bg-card/95 p-4 backdrop-blur-sm md:static md:inset-0 md:top-auto md:z-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 md:items-center md:gap-3 md:flex-row md:flex-wrap',
    isOpen ? 'flex' : 'hidden md:flex',
  )
  const linkClass = 'inline-flex items-center rounded-full px-3 py-2 text-left text-sm font-medium transition-all hover:text-primary md:px-0 md:py-0'
  const linkClassName = 'w-full md:w-auto'

  return (
    <nav className={navClass} onClick={isOpen ? onNavigate : undefined}>
      {navItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="inline" className={cn(linkClass, linkClassName)} />
      })}
      <NavLink href="/search" className={cn('inline-flex items-center rounded-full px-3 py-2 md:px-0 md:py-0', linkClassName)}>
        <span className="sr-only">Поиск</span>
        <SearchIcon className="w-5 text-primary" />
      </NavLink>
    </nav>
  )
}
