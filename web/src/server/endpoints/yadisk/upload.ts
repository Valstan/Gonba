import { requireAdmin } from '@/server/auth/requireAdmin'
import {
  ensureYandexPath,
  getUploadUrl,
  getYandexErrorFromResponse,
  YandexDiskError,
} from '@/server/integrations/yandex-disk'

const normalizeApiPath = (value: string) => {
  let targetPath = value.trim()
  if (
    targetPath.startsWith('/disk:') ||
    targetPath.startsWith('/app:') ||
    targetPath.startsWith('/urn:')
  ) {
    targetPath = targetPath.slice(1)
  }
  if (targetPath.startsWith('disk:')) {
    return targetPath.replace(/^disk:/, '')
  }
  if (targetPath.startsWith('app:')) {
    return targetPath.replace(/^app:/, '')
  }
  return targetPath
}

const parseOverwrite = (raw: unknown) => {
  if (raw === false || raw === 0) return false
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  }
  return true
}

export async function handleYadiskUploadPost(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json()) as Record<string, string | boolean | number>
  const targetPath = typeof body.path === 'string' ? normalizeApiPath(body.path) : ''
  const filename = typeof body.filename === 'string' ? body.filename : ''
  const overwrite = parseOverwrite(body.overwrite)

  if (!targetPath || !filename) {
    return Response.json({ error: 'Требуются путь и имя файла' }, { status: 400 })
  }

  const fullPath = targetPath === '/' ? `/${filename}` : `${targetPath}/${filename}`

  try {
    await ensureYandexPath(targetPath)
    const data = await getUploadUrl(fullPath, overwrite)
    return Response.json({ data })
  } catch (error) {
    if (error instanceof YandexDiskError) {
      return Response.json(
        { error: error.message, details: error.body, code: getYandexErrorFromResponse(error) },
        { status: error.status },
      )
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
