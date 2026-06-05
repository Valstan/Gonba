'use client'

import type { CSSProperties } from 'react'
import { usePathname } from 'next/navigation'

import { DecorSpots, hashString, pickTheme } from './Decor/shapes'

/**
 * SiteDecor — общесайтовый фоновый арт-декор (фикс-слой за контентом).
 * Цвет и мотивы подбираются по текущему маршруту → у каждой страницы свой
 * узнаваемый облик. Детальные страницы проектов пропускаем — там свой
 * ProjectDecor с цветом из данных проекта.
 *
 * Виден на всех страницах, т.к. фон вынесен на html-канву (body прозрачен),
 * а слой — position:fixed; z-index:-1 (см. globals.css .site-decor).
 */
export function SiteDecor() {
  const pathname = usePathname() || '/'

  // /projects/<slug> и вложенные (feed/lavka/gallery/...) — у них ProjectDecor
  if (/^\/projects\/[^/]+/.test(pathname)) return null
  // админка Payload своим layout'ом не использует этот компонент, но на всякий
  if (pathname.startsWith('/admin')) return null

  const { accent, primary, secondary } = pickTheme(hashString(pathname))

  return (
    <div className="site-decor" data-motif={primary} style={{ '--decor-accent': accent } as CSSProperties} aria-hidden>
      <DecorSpots primary={primary} secondary={secondary} />
    </div>
  )
}
