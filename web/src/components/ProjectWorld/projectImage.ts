import type { ProjectRecord } from '@/app/(frontend)/projects/shared'

const CURATED_PROJECT_IMAGES: Record<string, string> = {
  gonba: '/projects/gonba-cover.webp',
  'deer-farm': '/projects/deer-farm-cover.webp',
  'district-excursions': '/projects/rural-tourism-cover.webp',
  'village-and-temple': '/projects/village-temple-cover.jpg',
  'village-events': '/projects/village-events-cover.webp',
  'craft-workshops-gonba': '/projects/craft-workshops-cover.webp',
}

export function projectMediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const url = (media as { url?: string | null }).url
  if (!url) return null
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('//')) return url
  return `/media/${url}`
}

/** Единая узнаваемая обложка проекта для всех переходных карточек сайта. */
export function projectCoverImage(
  project: Pick<ProjectRecord, 'slug' | 'heroImage' | 'gallery' | 'logo'>,
): string | null {
  const hero = projectMediaUrl(project.heroImage)
  if (hero) return hero

  const curated = CURATED_PROJECT_IMAGES[project.slug]
  if (curated) return curated

  if (Array.isArray(project.gallery)) {
    for (const item of project.gallery) {
      const image = projectMediaUrl((item as { image?: unknown })?.image)
      if (image) return image
    }
  }

  return projectMediaUrl(project.logo)
}
