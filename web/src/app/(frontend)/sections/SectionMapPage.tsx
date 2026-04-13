import type { Metadata } from 'next'
import { sections } from '@/app/(frontend)/sections/data'
import { SectionCard } from '@/components/SectionCard'

export const metadata: Metadata = {
  title: 'Миры Жемчужины Вятки — все разделы',
  description: 'Выберите тематический раздел и погрузитесь в его атмосферу.',
}

export const dynamic = 'force-static'
export const revalidate = 600

export default function SectionMapPage() {
  const readySections = sections.filter((s) => s.status === 'ready')
  const plannedSections = sections.filter((s) => s.status === 'planned')

  return (
    <main className="sectionMapPage pb-20 pt-28">
      <div className="container">
        {/* Hero */}
        <div className="mb-12 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 md:p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold md:text-5xl">Миры Жемчужины Вятки</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/80">
              Каждый раздел — это отдельная вселенная со своей атмосферой, контентом и возможностями.
              Выберите направление и погрузитесь в его мир.
            </p>
          </div>
        </div>

        {/* Ready sections */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold">Доступные разделы</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {readySections.map((section) => (
              <SectionCard key={section.slug} section={section} />
            ))}
          </div>
        </section>

        {/* Planned sections */}
        {plannedSections.length > 0 && (
          <section>
            <h2 className="mb-6 text-2xl font-semibold text-muted-foreground">Скоро откроются</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plannedSections.map((section) => (
                <SectionCard key={section.slug} section={section} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
