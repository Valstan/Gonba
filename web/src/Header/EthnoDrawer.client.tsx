'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type DrawerLink = {
  href: string
  title: string
  subtitle?: string
}

type DrawerGroup = {
  modifier?: 'stay' | 'see' | 'shop'
  heading: string
  items: DrawerLink[]
}

const GROUPS: DrawerGroup[] = [
  {
    modifier: 'stay',
    heading: '· Пожить ·',
    items: [{ href: '/projects/eco-hotel-booking', title: 'ЭКО-отель', subtitle: 'над рекой, 6 номеров' }],
  },
  {
    heading: '· Делать ·',
    items: [
      { href: '/projects/workshops', title: 'Ремесленные мастерские', subtitle: 'гончарка, ткачество, валяние' },
      { href: '/projects/excursions', title: 'Экскурсии по району', subtitle: 'Малмыж · Гоньба · Вятка' },
      { href: '/projects/horse-club', title: 'Конный клуб', subtitle: 'г. Малмыж' },
    ],
  },
  {
    modifier: 'see',
    heading: '· Смотреть ·',
    items: [
      { href: '/projects/village-and-temple', title: 'Село и храм', subtitle: 'Покровская церковь, 1808' },
      { href: '/projects/gulfia', title: 'Садовая фея', subtitle: 'Гульфия Харисовна' },
      { href: '/projects/vyatskaya-lepota', title: 'Вятская лепота', subtitle: 'студия керамики, Малмыж' },
      { href: '/projects/events', title: 'События села', subtitle: 'ярмарки, праздники' },
    ],
  },
  {
    modifier: 'shop',
    heading: '· Лавка ·',
    items: [{ href: '/projects/vyatskiy-sbor', title: 'Вятский сбор', subtitle: 'травы, иван-чай, мёд' }],
  },
]

export const EthnoDrawer: React.FC = () => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Открыть меню"
          className="ethno-header__menu-btn"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(360px,86vw)] sm:max-w-none p-0 bg-[var(--paper)] border-l-[var(--rule)]"
      >
        <div className="ethno-drawer">
          <SheetHeader className="sr-only">
            <SheetTitle>Меню</SheetTitle>
          </SheetHeader>

          {GROUPS.map((group, gi) => (
            <div
              key={gi}
              className={`ethno-drawer__group${group.modifier ? ` ethno-drawer__group--${group.modifier}` : ''}`}
            >
              <h3>{group.heading}</h3>
              {group.items.map((item, ii) => (
                <Link key={ii} href={item.href}>
                  <div>
                    <strong>{item.title}</strong>
                    {item.subtitle && <span>{item.subtitle}</span>}
                  </div>
                  <svg className="ethno-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </Link>
              ))}
            </div>
          ))}

          <div className="ethno-drawer__footer">
            <h3>контакты</h3>
            <p>
              с. Гоньба, Малмыжский р-н
              <br />
              +7 (8332) 00-00-00
              <br />
              hello@гоньба.рф
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
