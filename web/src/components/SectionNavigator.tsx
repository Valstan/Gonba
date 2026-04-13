'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SectionDefinition } from '@/app/(frontend)/sections/data'

type SectionNavigatorProps = {
  sections: SectionDefinition[]
}

export function SectionNavigator({ sections }: SectionNavigatorProps) {
  const pathname = usePathname()
  const currentSlug = sections.find((s) => pathname.includes(s.slug))?.slug

  return (
    <nav className="sticky top-16 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container">
        <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-thin">
          {sections.map((section) => {
            const isActive = section.slug === currentSlug
            const isPlanned = section.status === 'planned'

            let classNameStr = ''
            if (isActive) {
              classNameStr = `flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg bg-gradient-to-r ${section.gradient}`
            } else if (isPlanned) {
              classNameStr = 'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground/50'
            } else {
              classNameStr = 'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground'
            }

            const content = (
              <>
                <span className="text-base">{section.icon}</span>
                <span className="whitespace-nowrap">{section.shortLabel}</span>
              </>
            )

            if (isPlanned) {
              return (
                <span key={section.slug} className={classNameStr} title="Скоро откроется">
                  {content}
                </span>
              )
            }

            return (
              <Link
                key={section.slug}
                href={`/sections/${section.slug}`}
                className={classNameStr}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
