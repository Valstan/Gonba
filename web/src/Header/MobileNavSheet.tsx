'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MenuIcon, SearchIcon } from 'lucide-react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { NavLink } from '@/components/ui/nav-link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utilities/ui'

type Props = {
  data: HeaderType
}

export const MobileNavSheet: React.FC<Props> = ({ data }) => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Закрываем шит при смене страницы.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const navItems = data?.navItems || []

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Открыть меню"
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full border border-muted-foreground text-muted-foreground transition-colors hover:bg-accent/40 md:hidden',
          )}
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Меню</SheetTitle>
        </SheetHeader>
        <nav className="mt-2 flex flex-col gap-1">
          {navItems.map(({ link }, i) => (
            <CMSLink
              key={i}
              {...link}
              appearance="inline"
              className="inline-flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent/40"
            />
          ))}
          <Separator className="my-2" />
          <NavLink
            href="/search"
            className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent/40"
          >
            <SearchIcon className="size-5" aria-hidden />
            <span>Поиск</span>
          </NavLink>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
