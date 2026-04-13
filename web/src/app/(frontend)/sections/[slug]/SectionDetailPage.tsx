import { notFound } from 'next/navigation'
import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { sections, getSectionBySlug, type SectionDefinition } from '@/app/(frontend)/sections/data'
import { SectionNavigator } from '@/components/SectionNavigator'
import { SectionHero } from '@/components/SectionHero'
import { CollectionArchive } from '@/components/CollectionArchive'
import { Media } from '@/components/Media'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const section = getSectionBySlug(slug)
  if (!section) return { title: 'Раздел не найден' }

  return {
    title: `${section.title} — Миры Жемчужины Вятки`,
    description: section.description,
  }
}

export async function generateStaticParams() {
  return sections.map((section) => ({
    slug: section.slug,
  }))
}

type PostDoc = {
  id: string | number
  title?: string
  slug?: string
  categories?: unknown
  meta?: unknown
}

type EventDoc = {
  id: string | number
  title?: string
  slug?: string
  startDate?: string | null
}

type ServiceDoc = {
  id: string | number
  title?: string
  summary?: string | null
  slug?: string
  price?: number | null
  currency?: string | null
}

type ProductDoc = {
  id: string | number
  title?: string
  slug?: string
  price?: number | null
  currency?: string | null
}

type ProjectDoc = {
  id: string | number
  title?: string
  slug?: string
  logo?: unknown
}

export default async function SectionDetailPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const section = getSectionBySlug(slug)

  if (!section) return notFound()
  if (section.status === 'planned') return notFound()

  const payload = await getPayload({ config: configPromise })

  // Получаем проект, привязанный к секции
  let project: ProjectDoc | null = null
  try {
    const projectRes = await payload.find({
      collection: 'projects',
      depth: 2,
      limit: 1,
      where: {
        slug: {
          equals: section.projectSlug,
        },
      },
      overrideAccess: false,
    })
    project = (projectRes.docs[0] as ProjectDoc) || null
  } catch {
    project = null
  }

  // Получаем посты для этой секции
  let posts: PostDoc[] = []
  if (section.enabledSections.includes('posts')) {
    try {
      const postsRes = await payload.find({
        collection: 'posts',
        depth: 2,
        limit: 6,
        where: {
          ...(project ? { project: { equals: project.id } } : {}),
        },
        sort: '-publishedAt',
        overrideAccess: false,
        select: {
          title: true,
          slug: true,
          categories: true,
          meta: true,
        },
      })
      posts = postsRes.docs as PostDoc[]
    } catch {
      posts = []
    }
  }

  // Получаем события для этой секции
  let events: EventDoc[] = []
  if (section.enabledSections.includes('events')) {
    try {
      const eventsRes = await payload.find({
        collection: 'events',
        depth: 2,
        limit: 4,
        where: {
          ...(project ? { project: { equals: project.id } } : {}),
        },
        sort: 'startDate',
        overrideAccess: false,
      })
      events = eventsRes.docs as EventDoc[]
    } catch {
      events = []
    }
  }

  // Получаем услуги для этой секции
  let services: ServiceDoc[] = []
  if (section.enabledSections.includes('services')) {
    try {
      const servicesRes = await payload.find({
        collection: 'services',
        depth: 2,
        limit: 6,
        where: {
          ...(project ? { project: { equals: project.id } } : {}),
        },
        sort: '-updatedAt',
        overrideAccess: false,
        select: {
          title: true,
          summary: true,
          slug: true,
          price: true,
          currency: true,
        },
      })
      services = servicesRes.docs as ServiceDoc[]
    } catch {
      services = []
    }
  }

  // Получаем товары для этой секции
  let products: ProductDoc[] = []
  if (section.enabledSections.includes('shop')) {
    try {
      const productsRes = await payload.find({
        collection: 'products',
        depth: 2,
        limit: 6,
        where: {
          ...(project ? { project: { equals: project.id } } : {}),
        },
        sort: '-updatedAt',
        overrideAccess: false,
        select: {
          title: true,
          slug: true,
          price: true,
          currency: true,
        },
      })
      products = productsRes.docs as ProductDoc[]
    } catch {
      products = []
    }
  }

  const hasPosts = section.enabledSections.includes('posts') && posts.length > 0
  const hasEvents = section.enabledSections.includes('events') && events.length > 0
  const hasServices = section.enabledSections.includes('services') && services.length > 0
  const hasShop = section.enabledSections.includes('shop') && products.length > 0

  return (
    <main
      className="sectionDetailPage pb-20"
      style={{ '--section-accent': section.accentColor } as React.CSSProperties}
    >
      {/* Navigator */}
      <SectionNavigator sections={sections} />

      <div className="container pt-8">
        {/* Hero */}
        <SectionHero section={section} />

        {/* Main content */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left column - main content */}
          <div className="space-y-8">
            {/* Posts */}
            {hasPosts && (
              <section id="posts" className="rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="text-2xl font-semibold">Записи</h2>
                <div className="mt-4">
                  <CollectionArchive posts={posts} />
                </div>
                <div className="mt-4">
                  <Link
                    href="/posts"
                    className="text-sm font-medium text-[var(--section-accent)] hover:underline"
                  >
                    Все публикации →
                  </Link>
                </div>
              </section>
            )}

            {!hasPosts && section.enabledSections.includes('posts') && (
              <section id="posts" className="rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="text-2xl font-semibold">Записи</h2>
                <p className="mt-3 text-muted-foreground">Пока публикаций нет. Скоро появятся!</p>
              </section>
            )}

            {/* Events */}
            {hasEvents && (
              <section id="events" className="rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="text-2xl font-semibold">События</h2>
                <ul className="mt-4 space-y-4">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-4">
                      <div className="shrink-0 text-2xl">📅</div>
                      <div className="flex-1">
                        <Link
                          href={`/events/${event.slug}`}
                          className="font-medium hover:text-[var(--section-accent)] transition-colors"
                        >
                          {event.title}
                        </Link>
                        {event.startDate && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {new Date(event.startDate).toLocaleString('ru-RU', {
                              dateStyle: 'long',
                            })}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Link
                    href="/events"
                    className="text-sm font-medium text-[var(--section-accent)] hover:underline"
                  >
                    Все события →
                  </Link>
                </div>
              </section>
            )}

            {/* Services */}
            {hasServices && (
              <section id="services" className="rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="text-2xl font-semibold">Услуги</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.slug}`}
                      className="rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-[var(--section-accent)]/30 hover:shadow-md"
                    >
                      <h3 className="font-medium hover:text-[var(--section-accent)] transition-colors">
                        {service.title}
                      </h3>
                      {service.summary && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {service.summary}
                        </p>
                      )}
                      {service.price && (
                        <p className="mt-2 text-sm font-semibold text-[var(--section-accent)]">
                          {service.price} {service.currency || '₽'}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    href="/services"
                    className="text-sm font-medium text-[var(--section-accent)] hover:underline"
                  >
                    Все услуги →
                  </Link>
                </div>
              </section>
            )}

            {/* Shop */}
            {hasShop && (
              <section id="shop" className="rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="text-2xl font-semibold">Магазин</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/shop/${product.slug}`}
                      className="rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-[var(--section-accent)]/30 hover:shadow-md"
                    >
                      <h3 className="font-medium hover:text-[var(--section-accent)] transition-colors">
                        {product.title}
                      </h3>
                      {product.price && (
                        <p className="mt-2 text-sm font-semibold text-[var(--section-accent)]">
                          {product.price} {product.currency || '₽'}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    href="/shop"
                    className="text-sm font-medium text-[var(--section-accent)] hover:underline"
                  >
                    Все товары →
                  </Link>
                </div>
              </section>
            )}
          </div>

          {/* Right column - sidebar */}
          <aside className="space-y-6">
            {/* Quick links to other sections */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <h3 className="text-lg font-semibold">Другие миры</h3>
              <div className="mt-4 space-y-2">
                {sections
                  .filter((s: SectionDefinition) => s.slug !== section.slug && s.status === 'ready')
                  .map((s: SectionDefinition) => (
                    <Link
                      key={s.slug}
                      href={`/sections/${s.slug}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                    >
                      <span>{s.icon}</span>
                      <span>{s.shortLabel}</span>
                    </Link>
                  ))}
              </div>
            </div>

            {/* Project link */}
            {project && (
              <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <h3 className="text-lg font-semibold">Страница проекта</h3>
                <Link
                  href={`/projects/${project.slug}`}
                  className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-[var(--section-accent)]/30 hover:shadow-md"
                >
                  {project.logo && typeof project.logo !== 'string' ? (
                    <Media
                      resource={project.logo}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"
                      imgClassName="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent text-2xl">
                      {section.icon}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">Перейти на страницу проекта</p>
                  </div>
                </Link>
              </div>
            )}

            {/* CTA buttons */}
            {section.ctas.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <h3 className="text-lg font-semibold">Быстрые действия</h3>
                <div className="mt-4 space-y-2">
                  {section.ctas.map((cta, i) => (
                    <Link
                      key={i}
                      href={cta.href}
                      className="flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${section.accentColor}, ${section.accentColor}dd)`,
                      }}
                    >
                      {cta.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
