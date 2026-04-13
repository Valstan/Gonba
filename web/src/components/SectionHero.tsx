import Link from 'next/link'
import type { SectionDefinition } from '@/app/(frontend)/sections/data'

type SectionHeroProps = {
  section: SectionDefinition
}

export function SectionHero({ section }: SectionHeroProps) {
  const isPlanned = section.status === 'planned'

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${section.gradient} p-8 md:p-12`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{section.icon}</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white md:text-4xl">{section.title}</h1>
            <p className="mt-3 max-w-2xl text-lg text-white/80">{section.description}</p>

            {/* CTA buttons */}
            {!isPlanned && section.ctas.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {section.ctas.map((cta, i) => (
                  <Link
                    key={i}
                    href={cta.href}
                    className="rounded-full bg-white/20 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30"
                  >
                    {cta.label}
                  </Link>
                ))}
              </div>
            )}

            {isPlanned && (
              <div className="mt-4 inline-flex items-center rounded-full bg-black/20 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                🚧 Раздел в разработке
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
