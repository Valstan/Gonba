'use client'

import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { LoginControl } from '@/components/Auth/LoginControl.client'
import { EthnoDrawer } from './EthnoDrawer.client'
import { NavEditor } from './NavEditor.client'
import { deriveNavItems, deriveDrawerData } from './nav-data'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const navItems = deriveNavItems(data)
  const drawer = deriveDrawerData(data)

  return (
    <header className="ethno-header">
      <div className="container ethno-header__inner">
        <Link href="/" className="ethno-header__logo" aria-label="На главную">
          <span className="ethno-rhomb" aria-hidden="true" />
          Гоньба
        </Link>

        <nav className="ethno-nav" aria-label="Главная навигация">
          {navItems.map((item) => (
            <Link key={`${item.label}-${item.href}`} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ethno-header__actions">
          <NavEditor items={navItems} />
          <LoginControl />
          <EthnoDrawer {...drawer} />
        </div>
      </div>
    </header>
  )
}
