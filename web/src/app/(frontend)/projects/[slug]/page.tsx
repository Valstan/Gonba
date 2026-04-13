import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CollectionArchive } from '@/components/CollectionArchive'
import { AdminOverlay } from '@/components/AdminOverlay'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { queryProjectBySlug } from '../queries'

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export async function generateMetadata({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return { title: 'Проект не найден' }

  return {
    title: `${project.title} | Проект`,
    description: project.summary || 'Личный раздел проекта',
  }
}

export default async function ProjectPage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const project = await queryProjectBySlug({ slug: decodedSlug })
  if (!project) return notFound()

  const payload = await getPayload({ config: configPromise })
  const projectId = project.id
  const projectEditUrl = `/admin/collections/projects/${projectId}`
  const enabledSections = Array.isArray(project.enabledSections) && project.enabledSections.length > 0 ? project.enabledSections : null

  const [featuredPosts, upcomingEvents, projectServices] = await Promise.all([
    payload.find({
      collection: 'posts',
      depth: 1,
      limit: 3,
      where: {
        project: {
          equals: projectId,
        },
      },
      sort: '-publishedAt',
      overrideAccess: false,
      select: {
        title: true,
        slug: true,
        categories: true,
        meta: true,
      },
    }),
    payload.find({
      collection: 'events',
      depth: 1,
      limit: 3,
      where: {
        project: {
          equals: projectId,
        },
      },
      sort: 'startDate',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'services',
      depth: 1,
      limit: 6,
      where: {
        project: {
          equals: projectId,
        },
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
    }),
  ])

  const hasPostsSection = !enabledSections || enabledSections.includes('posts')
  const hasEventsSection = !enabledSections || enabledSections.includes('events')
  const hasServicesSection = !enabledSections || enabledSections.includes('services')
  const hasContactsSection = !enabledSections || enabledSections.includes('contacts')
  const hasGallerySection = !enabledSections || enabledSections.includes('gallery')
  return (
    <AdminOverlay
      addLabel="Добавить контент"
      addUrl={projectEditUrl}
      editLabel="Редактировать"
      editUrl={projectEditUrl}
      label="проект"
    >
      <article className="pb-20 pt-28">
      <div className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { label: project.title || decodedSlug },
          ]}
        />
      </div>

      <div className="container rounded-3xl border border-border/80 bg-card/80 p-6 md:p-10">
        <h1 className="text-3xl font-semibold">{project.title}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{project.summary || 'Проектное пространство проекта и его активная программа.'}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/projects/${project.slug}/posts`} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            Перейти в проект
          </Link>
          <Link href={`/projects/${project.slug}/contacts`} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            Контакты
          </Link>
        </div>
      </div>

      <div className="container mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-6">
          {project.heroImage ? <Media resource={project.heroImage} className="rounded-xl" /> : null}

          {project.description ? (
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
              <h2 className="text-xl font-medium">О проекте</h2>
              <div className="mt-3">
                <RichText data={project.description} enableGutter={false} />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <h2 className="text-xl font-medium">Ближайшие события</h2>
            {hasEventsSection ? (
              upcomingEvents.docs.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {upcomingEvents.docs.map((event) => (
                    <li key={event.id}>
                      <Link href={`/projects/${project.slug}/events`} className="text-sm hover:text-[var(--project-accent)]">
                        {event.title as string}
                      </Link>
                      {event.startDate ? (
                        <p className="text-xs text-muted-foreground">{new Date(event.startDate).toLocaleString('ru-RU', { dateStyle: 'long' })}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Скоро будут анонсы событий.</p>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Подраздел событий отключен для этого проекта.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <h2 className="text-xl font-medium">Последние посты</h2>
            {hasPostsSection ? (
              featuredPosts.docs.length > 0 ? (
                <>
                  <div className="mt-4">
                    <CollectionArchive posts={featuredPosts.docs} />
                  </div>
                  <div className="mt-4">
                    <Link href={`/projects/${project.slug}/posts`} className="text-sm text-[var(--project-accent)] hover:underline">
                      Все публикации
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Пока публикаций нет.</p>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Подраздел блога отключен для этого проекта.</p>
            )}
          </div>

          {hasGallerySection && project.gallery && project.gallery.length > 0 ? (
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
              <h2 className="text-xl font-medium">Мини-галерея</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {project.gallery.slice(0, 4).map((item, index) => (
                  <div key={index} className="overflow-hidden rounded-xl border border-border/80">
                    {item.image ? <Media resource={item.image} className="h-full w-full" imgClassName="h-40 w-full object-cover" /> : null}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href={`/projects/${project.slug}/gallery`} className="text-sm text-[var(--project-accent)] hover:underline">
                  Перейти в галерею
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          {hasContactsSection ? (
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
              <h2 className="text-xl font-medium">Контакты</h2>
              <p className="mt-2 text-sm text-muted-foreground">Для связи и бронирования.</p>
              {project.location?.address ? <p className="mt-3 text-sm text-muted-foreground">Адрес: {project.location.address}</p> : null}
              {project.location?.mapUrl ? (
                <Link href={project.location.mapUrl} className="mt-3 inline-block text-sm text-[var(--project-accent)] hover:underline" rel="noreferrer">
                  Карта проезда
                </Link>
              ) : null}
              {project.contacts?.phone ? <p className="mt-2 text-sm text-muted-foreground">Телефон: {project.contacts.phone}</p> : null}
              {project.contacts?.email ? <p className="mt-2 text-sm text-muted-foreground">Email: {project.contacts.email}</p> : null}
              {project.contacts?.whatsApp ? <p className="mt-2 text-sm text-muted-foreground">WhatsApp: {project.contacts.whatsApp}</p> : null}
              <div className="mt-4">
                <Link href={`/projects/${project.slug}/contacts`} className="inline-flex rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
                  Полные контакты
                </Link>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <h2 className="text-xl font-medium">Услуги</h2>
            {hasServicesSection ? (
              projectServices.docs.length > 0 ? (
                <ul className="mt-4 space-y-3 text-sm">
                  {projectServices.docs.map((service) => (
                    <li key={service.id}>
                      <Link href={`/projects/${project.slug}/services`} className="hover:text-[var(--project-accent)]">
                        {service.title || 'Услуга'}
                      </Link>
                      {service.summary ? <p className="mt-1 text-muted-foreground">{service.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Пока услуги не добавлены.</p>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Подраздел услуг отключен для этого проекта.</p>
            )}
            <Link href={`/projects/${project.slug}/services`} className="mt-4 inline-block text-sm text-[var(--project-accent)] hover:underline">
              Все услуги
            </Link>
          </div>
        </aside>
      </div>

      <div className="container mt-8">
        {hasGallerySection && project.gallery && project.gallery.length > 4 ? (
          <p className="text-sm text-muted-foreground">И ещё {project.gallery.length - 4} фото в полном блоке галерии.</p>
        ) : null}
      </div>
      </article>
    </AdminOverlay>
  )
}
