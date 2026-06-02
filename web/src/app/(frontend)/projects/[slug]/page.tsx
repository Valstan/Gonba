import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CollectionArchive } from '@/components/CollectionArchive'
import { AdminOverlay } from '@/components/AdminOverlay'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { ProjectDetailEditor } from '@/components/InlineEdit/ProjectDetailEditor.client'
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

  // Данные для inline-редактора проекта (depth=1 → heroImage уже объект с url).
  const heroImage = project.heroImage as { id?: number | string; url?: string | null } | number | string | null | undefined
  const heroImageId =
    heroImage && typeof heroImage === 'object'
      ? heroImage.id ?? null
      : typeof heroImage === 'number' || typeof heroImage === 'string'
        ? heroImage
        : null
  const heroImageUrl = heroImage && typeof heroImage === 'object' ? heroImage.url ?? null : null

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

  const hasFeed = !enabledSections || enabledSections.includes('feed') || enabledSections.includes('posts') || enabledSections.includes('events')
  const hasLavka = !enabledSections || enabledSections.includes('lavka') || enabledSections.includes('services') || enabledSections.includes('shop')
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
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold">{project.title}</h1>
          <ProjectDetailEditor
            project={{
              id: projectId,
              title: project.title || '',
              summary: project.summary || '',
              description: project.description,
              heroImageId,
              heroImageUrl,
            }}
          />
        </div>
        <p className="mt-4 max-w-2xl text-muted-foreground">{project.summary || 'Проектное пространство проекта и его активная программа.'}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/projects/${project.slug}/feed`} className="min-h-11 inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            Жизнь проекта
          </Link>
          <Link href={`/projects/${project.slug}/lavka`} className="min-h-11 inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            Лавка
          </Link>
          <Link href={`/projects/${project.slug}/contacts`} className="min-h-11 inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
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
            <h2 className="text-xl font-medium">Жизнь проекта</h2>
            {hasFeed ? (
              upcomingEvents.docs.length > 0 || featuredPosts.docs.length > 0 ? (
                <>
                  {upcomingEvents.docs.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {upcomingEvents.docs.map((event) => (
                        <li key={event.id}>
                          <Link href={`/projects/${project.slug}/feed?type=event`} className="text-sm hover:text-[var(--project-accent)]">
                            🗓 {event.title as string}
                          </Link>
                          {event.startDate ? (
                            <p className="text-xs text-muted-foreground">{new Date(event.startDate).toLocaleString('ru-RU', { dateStyle: 'long' })}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {featuredPosts.docs.length > 0 ? (
                    <div className="mt-4">
                      <CollectionArchive posts={featuredPosts.docs} />
                    </div>
                  ) : null}
                  <div className="mt-4">
                    <Link href={`/projects/${project.slug}/feed`} className="text-sm text-[var(--project-accent)] hover:underline">
                      Открыть ленту
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Лента проекта скоро наполнится.</p>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Лента отключена для этого проекта.</p>
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
            <h2 className="text-xl font-medium">Лавка</h2>
            {hasLavka ? (
              projectServices.docs.length > 0 ? (
                <ul className="mt-4 space-y-3 text-sm">
                  {projectServices.docs.map((service) => (
                    <li key={service.id}>
                      <Link href={`/projects/${project.slug}/lavka`} className="hover:text-[var(--project-accent)]">
                        {service.title || 'Услуга'}
                      </Link>
                      {service.summary ? <p className="mt-1 text-muted-foreground">{service.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Скоро здесь появятся предложения.</p>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Раздел «Лавка» отключен для этого проекта.</p>
            )}
            <Link href={`/projects/${project.slug}/lavka`} className="mt-4 inline-block text-sm text-[var(--project-accent)] hover:underline">
              Открыть Лавку →
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
