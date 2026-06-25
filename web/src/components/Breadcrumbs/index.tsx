import Link from 'next/link'
import React from 'react'

import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbJsonLd } from '@/seo/jsonld'

type Breadcrumb = {
  href?: string
  label: string
}

type Props = {
  items: Breadcrumb[]
  /**
   * 'overlay' — для размещения поверх тёмного hero (белый текст + тень,
   * читаемо над фотографией). 'default' — обычный светлый фон.
   */
  variant?: 'default' | 'overlay'
}

export const Breadcrumbs: React.FC<Props> = ({ items, variant = 'default' }) => {
  if (items.length <= 1) {
    return null
  }

  const overlay = variant === 'overlay'
  const listClass = overlay
    ? 'flex flex-wrap items-center gap-1 text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]'
    : 'flex flex-wrap items-center gap-1 text-muted-foreground'
  const currentClass = overlay ? 'text-white' : 'text-foreground'
  const linkClass = overlay
    ? 'hover:text-white transition-colors'
    : 'hover:text-foreground transition-colors'

  return (
    <>
      {/* pool #051 (GEO): BreadcrumbList — серверно, на каждой странице с крошками. */}
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav className="mb-4 text-sm" aria-label="Хлебные крошки">
        <ol className={listClass}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.href || item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {isLast ? (
                <span className={currentClass} aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          )
        })}
        </ol>
      </nav>
    </>
  )
}
