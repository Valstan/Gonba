import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-card text-card-foreground">
      <div className="container flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <Link className="flex items-center" href="/" aria-label="На главную">
          <Logo className="invert dark:invert-0" />
        </Link>

        <div className="flex flex-col-reverse items-start gap-4 md:flex-row md:items-center">
          <ThemeSelector />
          <nav className="flex flex-col gap-2 md:flex-row md:gap-4">
            {navItems.map(({ link }, i) => (
              <CMSLink
                key={i}
                {...link}
                className="inline-flex min-h-11 items-center text-sm font-medium text-card-foreground transition-colors hover:text-primary"
              />
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
