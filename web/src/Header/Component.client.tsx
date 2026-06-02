'use client'

import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { LoginControl } from '@/components/Auth/LoginControl.client'
import { EthnoDrawer } from './EthnoDrawer.client'
import { NavEditor, type NavItem } from './NavEditor.client'

interface HeaderClientProps {
  data: Header
}

// Дефолтные пункты — fallback, пока глобал header.navItems пуст.
// Как только меню отредактируют через сайт, рендер идёт из глобала.
const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Пожить', href: '/projects?group=stay' },
  { label: 'Делать', href: '/projects?group=do' },
  { label: 'Смотреть', href: '/projects?group=see' },
  { label: 'Лавка', href: '/projects?group=shop' },
  { label: 'Усадьба', href: '/usadba' },
  { label: 'О проекте', href: '/projects/about-project' },
]

type NavItemDoc = NonNullable<Header['navItems']>[number]

function resolveHref(link: NavItemDoc['link'] | undefined): string {
  if (!link) return '#'
  if (link.type === 'custom') return link.url || '#'
  const ref = link.reference
  if (ref && typeof ref.value === 'object' && ref.value) {
    const value = ref.value as { slug?: string }
    const slug = value.slug || ''
    return ref.relationTo === 'pages' ? `/${slug}` : `/${ref.relationTo}/${slug}`
  }
  return '#'
}

function deriveNavItems(data: Header): NavItem[] {
  const items = Array.isArray(data?.navItems) ? data.navItems : []
  const mapped = items
    .map((item) => ({ label: item?.link?.label || '', href: resolveHref(item?.link) }))
    .filter((i) => i.label && i.href && i.href !== '#')
  return mapped.length ? mapped : DEFAULT_NAV_ITEMS
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const navItems = deriveNavItems(data)

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
          <EthnoDrawer />
        </div>
      </div>
    </header>
  )
}
