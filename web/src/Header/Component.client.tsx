'use client'

import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { EthnoDrawer } from './EthnoDrawer.client'

interface HeaderClientProps {
  data: Header
}

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'Пожить', href: '/projects?group=stay' },
  { label: 'Делать', href: '/projects?group=do' },
  { label: 'Смотреть', href: '/projects?group=see' },
  { label: 'Лавка', href: '/projects?group=shop' },
  { label: 'Усадьба', href: '/usadba' },
  { label: 'О проекте', href: '/projects/about-project' },
]

export const HeaderClient: React.FC<HeaderClientProps> = ({ data: _data }) => {
  return (
    <header className="ethno-header">
      <div className="container ethno-header__inner">
        <Link href="/" className="ethno-header__logo" aria-label="На главную">
          <span className="ethno-rhomb" aria-hidden="true" />
          Гоньба
        </Link>

        <nav className="ethno-nav" aria-label="Главная навигация">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <EthnoDrawer />
      </div>
    </header>
  )
}
