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

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) {
    return Response.json({ error: 'Требуется путь' }, { status: 400 })
  }

  try {
    const download = await getDownloadUrl(normalizeApiPath(path))
    if (!download.href) {
      return Response.json({ error: 'Не удалось получить ссылку на файл' }, { status: 502 })
    }

    const res = await fetch(download.href)
    if (!res.ok || !res.body) {
      return Response.json({ error: `Не удалось загрузить файл (${res.status})` }, { status: 502 })
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    if (error instanceof YandexDiskError) {
      return Response.json({ error: error.message, details: error.body }, { status: error.status })
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
