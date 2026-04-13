import { requireAdmin } from '@/server/auth/requireAdmin'
import { getDownloadUrl, YandexDiskError } from '@/server/integrations/yandex-disk'

const normalizeApiPath = (value: string) => {
  let path = value.trim()
  if (path.startsWith('/disk:') || path.startsWith('/app:') || path.startsWith('/urn:')) {
    path = path.slice(1)
  }
  if (path.startsWith('disk:')) {
    return path.replace(/^disk:/, '')
  }
  if (path.startsWith('app:')) {
    return path.replace(/^app:/, '')
  }
  return path
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json()) as Record<string, string>
  const path = body.path ? normalizeApiPath(body.path) : ''

  if (!path) {
    return Response.json({ error: 'Требуется путь' }, { status: 400 })
  }

  try {
    const data = await getDownloadUrl(path)
    return Response.json({ data })
  } catch (error) {
    if (error instanceof YandexDiskError) {
      return Response.json({ error: error.message, details: error.body }, { status: error.status })
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
