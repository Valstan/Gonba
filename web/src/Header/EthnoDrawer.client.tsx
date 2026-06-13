'use client'

import React, { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { DrawerData, DrawerLink } from './nav-data'

const DrawerRow: React.FC<{ item: DrawerLink }> = ({ item }) => (
  <Link href={item.href}>
    <div>
      <strong>{item.title}</strong>
      {item.subtitle && <span>{item.subtitle}</span>}
    </div>
    <svg className="ethno-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  </Link>
)

export const EthnoDrawer: React.FC<DrawerData> = ({ groups, extraLinks, contacts }) => {
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

          {groups.map((group, gi) => (
            <div
              key={gi}
              className={`ethno-drawer__group${group.modifier ? ` ethno-drawer__group--${group.modifier}` : ''}`}
            >
              <h3>{group.heading}</h3>
              {group.items.map((item, ii) => (
                <DrawerRow key={ii} item={item} />
              ))}
            </div>
          ))}

          {extraLinks.length > 0 && (
            <div className="ethno-drawer__group">
              {extraLinks.map((item, ii) => (
                <DrawerRow key={ii} item={item} />
              ))}
            </div>
          )}

          <div className="ethno-drawer__footer">
            <h3>{contacts.heading}</h3>
            <p>
              {contacts.body.split('\n').map((line, i, arr) => (
                <Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
