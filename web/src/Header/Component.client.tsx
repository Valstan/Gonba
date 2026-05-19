'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'
import { MobileNavSheet } from './MobileNavSheet'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
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

  // Компактный режим хедера при скролле.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="container relative z-20 transition-[padding] duration-200"
      data-scrolled={scrolled ? 'true' : 'false'}
      {...(theme ? { 'data-theme': theme } : {})}
    >
      <div className={scrolled ? 'flex items-center justify-between py-3 transition-[padding]' : 'flex items-center justify-between py-8 transition-[padding]'}>
        <Link href="/" aria-label="На главную">
          <Logo loading="eager" className="invert dark:invert-0" />
        </Link>
        <HeaderNav data={data} />
        <MobileNavSheet data={data} />
      </div>
    </header>
  )
}
