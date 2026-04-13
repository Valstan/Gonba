import Link from 'next/link'
import type { SectionDefinition } from '@/app/(frontend)/sections/data'

type SectionCardProps = {
  section: SectionDefinition
}

export function SectionCard({ section }: SectionCardProps) {
  const isPlanned = section.status === 'planned'

  return (
    <Link
      href={isPlanned ? section.ctas[0]?.href || '#' : `/sections/${section.slug}`}
      className={`group relative block overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--section-color)]/10 ${
        isPlanned ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ '--section-color': section.accentColor } as React.CSSProperties}
      {...(isPlanned ? { onClick: (e) => e.preventDefault() } : {})}
    >
      {/* Gradient header */}
      <div className={`h-24 bg-gradient-to-br ${section.gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-4 left-4 text-4xl">{section.icon}</div>
        {isPlanned && (
          <div className="absolute top-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            Скоро
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold group-hover:text-[var(--section-color)] transition-colors">
          {section.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {section.description}
        </p>

        {/* CTA buttons */}
        {!isPlanned && section.ctas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {section.ctas.slice(0, 2).map((cta, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors group-hover:border-[var(--section-color)]/30 group-hover:text-[var(--section-color)]"
              >
                {cta.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
