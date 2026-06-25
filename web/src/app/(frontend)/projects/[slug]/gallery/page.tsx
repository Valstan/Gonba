import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Media } from '@/components/Media'
import { ProjectGalleryEditor } from '@/components/InlineEdit/ProjectGalleryEditor.client'
import { YandexGallerySection } from '@/components/Gallery/YandexGallerySection'
import { listYandexGalleryFolder, type YandexGalleryItem } from '@/server/integrations/yandex-disk-gallery'
import { queryProjectBySlug } from '../../queries'
import { withRetry } from '@/utilities/withRetry'
import type { Media as MediaType } from '@/payload-types'

const YANDEX_PREFIX = (process.env.YANDEX_PUBLIC_GALLERY_PREFIX || '/public-galleries/').toLowerCase()

export const dynamic = 'force-static'
export const revalidate = 600

type Args = {
  params: Promise<{
    slug: string
  }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })

  if (!project) {
    return {
      title: 'Проект не найден',
    }
  }

  return {
    title: `${project.title} — Галерея`,
  }
}

type GalleryEntry = { image?: MediaType | number | null; caption?: string | null } | MediaType | number | null | undefined

const isGalleryItem = (value: GalleryEntry): value is { image?: MediaType | number | null; caption?: string | null } => {
  return typeof value === 'object' && value !== null && 'image' in value
}

const getMediaResource = (value: GalleryEntry): MediaType | number | null => {
  if (isGalleryItem(value)) {
    return value.image || null
  }
  return value || null
}

const getMediaKey = (value: GalleryEntry, index: number) => {
  const resource = getMediaResource(value)
  if (typeof resource === 'number') {
    return `media-id:${resource}`
  }

  if (resource && typeof resource === 'object') {
    if (typeof resource.id === 'number') {
      return `media-id:${resource.id}`
    }
    if (typeof resource.yandexPath === 'string' && resource.yandexPath) {
      return `media-path:${resource.yandexPath}`
    }
    if (typeof resource.url === 'string' && resource.url) {
      return `media-url:${resource.url}`
    }
    if (typeof resource.filename === 'string' && resource.filename) {
      return `media-file:${resource.filename}`
    }
  }

  return `media-fallback:${index}`
}

export default async function ProjectGalleryPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const payload = await getPayload({ config: configPromise })

  // pool #040: каждый запрос с ретраем транзиентного сбоя БД (бросает → ISR не
  // кэширует пустым). Yandex-листинг ниже остаётся под своим try/catch (внешний API).
  const [projectPosts, galleryEvents] = await Promise.all([
    withRetry(() =>
      payload.find({
        collection: 'posts',
        depth: 1,
        sort: '-publishedAt',
        limit: 50,
        overrideAccess: false,
        where: {
          project: {
            equals: project.id,
          },
        },
        select: {
          heroImage: true,
        },
      }),
    ),
    withRetry(() =>
      payload.find({
        collection: 'events',
        depth: 1,
        sort: '-startDate',
        limit: 12,
        overrideAccess: false,
        where: {
          project: {
            equals: project.id,
          },
        },
      }),
    ),
  ])

  const postImages = projectPosts.docs.map((post) => post.heroImage)

  const eventImages = galleryEvents.docs.flatMap((event) => (Array.isArray(event.gallery) ? event.gallery : []))

  const eventHeroImages = galleryEvents.docs.map((event) => event.heroImage)

  const merged = [
    project.heroImage,
    ...(Array.isArray(project.gallery) ? project.gallery : []),
    ...postImages,
    ...eventHeroImages,
    ...eventImages,
  ]

  const deduped = merged.filter((entry, index, all) => {
    const key = getMediaKey(entry, index)
    return all.findIndex((candidate, candidateIndex) => getMediaKey(candidate, candidateIndex) === key) === index
  })

  // Подгрузка из Яндекс-папки (если задана и проходит whitelist).
  let yandexItems: YandexGalleryItem[] = []
  const yandexFolder = (project.galleryYandexFolder || '').trim()
  if (yandexFolder && yandexFolder.toLowerCase().startsWith(YANDEX_PREFIX)) {
    try {
      yandexItems = await listYandexGalleryFolder(yandexFolder, 48)
    } catch (err) {
      console.warn(`[gallery] yandex listing failed for ${project.slug}: ${(err as Error).message}`)
    }
  }

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { href: `/projects/${project.slug}`, label: project.title },
            { label: 'Галерея' },
          ]}
        />
        <div className="mt-6 flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold">Галерея проекта</h1>
          <ProjectGalleryEditor id={project.id} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deduped.map((media, index) => {
            if (!media) return null
            const image = getMediaResource(media)
            if (!image) return null

            return (
              <article key={getMediaKey(media, index)} className="overflow-hidden rounded-xl border border-border bg-card/80">
                <div className="aspect-[4/3]">
                  <Media resource={image} imgClassName="h-full w-full object-cover" className="h-full w-full" />
                </div>
              </article>
            )
          })}
        </div>

        {deduped.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Фото в галерее пока не добавлены.</p> : null}

        <YandexGallerySection items={yandexItems} />
      </section>
    </main>
  )
}
