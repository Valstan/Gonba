import Link from 'next/link'
import type { SectionDefinition } from '@/app/(frontend)/sections/data'
import { SectionCardInner } from './SectionCardInner'

type SectionCardProps = {
  section: SectionDefinition
}

export function SectionCard({ section }: SectionCardProps) {
  const isPlanned = section.status === 'planned'
  const href = isPlanned ? section.ctas[0]?.href || '#' : `/sections/${section.slug}`

  return (
    <Link
      href={isPlanned ? '#' : href}
      className={`group relative block overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--section-color)]/10 ${
        isPlanned ? 'opacity-70' : 'cursor-pointer'
      }`}
      style={{ '--section-color': section.accentColor } as React.CSSProperties}
      {...(isPlanned ? { tabIndex: -1 } : {})}
    >
      <SectionCardInner section={section} isPlanned={isPlanned} />
    </Link>
  )
}
