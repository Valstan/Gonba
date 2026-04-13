'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'
import { Menu, X } from 'lucide-react'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header className="container relative z-20   " {...(theme ? { 'data-theme': theme } : {})}>
      <div className="py-8 flex justify-between">
        <Link href="/">
          <Logo loading="eager" className="invert dark:invert-0" />
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-muted-foreground text-muted-foreground md:hidden"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X className="w-5" /> : <Menu className="w-5" />}
        </button>
        <HeaderNav data={data} isOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
      </div>
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/35 md:hidden" onClick={() => setMenuOpen(false)} />}
    </header>
  )
}
