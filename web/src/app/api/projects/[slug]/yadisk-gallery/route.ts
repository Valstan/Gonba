import { listYandexGalleryFolder } from '@/server/integrations/yandex-disk-gallery'
import { queryProjectBySlug } from '@/app/(frontend)/projects/queries'

const WHITELIST_PREFIX = (process.env.YANDEX_PUBLIC_GALLERY_PREFIX || '/public-galleries/').toLowerCase()

type RouteParams = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }
  const folder = (project.galleryYandexFolder || '').trim()
  if (!folder) {
    return Response.json({ error: 'Yandex folder is not configured for this project' }, { status: 404 })
  }
  if (!folder.toLowerCase().startsWith(WHITELIST_PREFIX)) {
    return Response.json(
      {
        error: `Folder must start with ${WHITELIST_PREFIX} for public listing`,
      },
      { status: 403 },
    )
  }

  try {
    const items = await listYandexGalleryFolder(folder, 60)
    return Response.json(
      { items, source: folder },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : 'Failed to list folder',
        items: [],
      },
      { status: 502 },
    )
  }
}
