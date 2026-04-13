import configPromise from '@payload-config'
import { getPayload } from 'payload'

import {
  copyYandexResource,
  createYandexFolder,
  deleteYandexResource,
  ensureYandexPath,
  cleanupYandexTrash,
  getYandexErrorFromResponse,
  listYandexDisk,
  moveYandexResource,
  resolveDiskPath,
  YandexDiskError,
} from '@/server/integrations/yandex-disk'
import { requireAdmin } from '@/server/auth/requireAdmin'

const sanitizeName = (name: string) => name.replaceAll('/', '').trim()

const getParentPath = (targetPath: string) => {
  if (!targetPath || targetPath === '/') return '/'
  const normalized = targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx)
}

const splitName = (name: string) => {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, idx), ext: name.slice(idx) }
}

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

const updateMediaPathsForMove = async (from: string, to: string, isDir: boolean) => {
  const payload = await getPayload({ config: configPromise })
  const limit = 100
  let page = 1

  const where = isDir
    ? {
        yandexPath: {
          like: `${from}/`,
        },
      }
    : {
        yandexPath: {
          equals: from,
        },
      }

  while (true) {
    const result = await payload.find({
      collection: 'media',
      depth: 0,
      limit,
      page,
      where,
    })

    if (!result.docs.length) break

    for (const doc of result.docs) {
      const currentPath = typeof doc.yandexPath === 'string' ? doc.yandexPath : ''
      if (!currentPath) continue
      if (isDir && !currentPath.startsWith(`${from}/`)) continue
      const nextPath = isDir ? `${to}${currentPath.slice(from.length)}` : to
      if (nextPath === currentPath) continue
      await payload.update({
        collection: 'media',
        id: doc.id,
        data: {
          yandexPath: nextPath,
          yandexCheckedAt: null,
        },
        overrideAccess: true,
      })
    }

    const currentPage = Number(result.page || page || 1)
    const totalPages = Number(result.totalPages || 1)
    if (currentPage >= totalPages) break
    page += 1
  }
}

export async function handleYadiskGet(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const targetPath = normalizeApiPath(searchParams.get('path') || '/')

  try {
    if (targetPath === '/.trash') {
      await cleanupYandexTrash('/.trash', 10)
    }

    const data = await listYandexDisk(targetPath)
    return Response.json({ data, path: targetPath })
  } catch (error) {
    if (error instanceof YandexDiskError) {
      const code = getYandexErrorFromResponse(error)
      if (error.status === 404 || error.status === 409) {
        if (!code || code === 'DiskPathDoesntExistsError') {
          await ensureYandexPath(targetPath)
          const data = await listYandexDisk(targetPath)
          return Response.json({ data, path: targetPath })
        }
      }

      return Response.json({ error: error.message, details: error.body }, { status: error.status })
    }

    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function handleYadiskPost(request: Request) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const body = (await request.json()) as Record<string, string | boolean | number>
  const action = body.action

  try {
    switch (action) {
      case 'create-folder': {
        const basePath = normalizeApiPath(String(body.path || '/'))
        const name = sanitizeName(String(body.name || ''))
        if (!name) return Response.json({ error: 'Требуется имя папки' }, { status: 400 })
        await ensureYandexPath(basePath)
        const fullPath = basePath === '/' ? `/${name}` : `${basePath}/${name}`
        await createYandexFolder(fullPath)
        return Response.json({ ok: true })
      }
      case 'delete': {
        const target = body.path ? normalizeApiPath(String(body.path)) : ''
        if (!target) return Response.json({ error: 'Требуется путь' }, { status: 400 })
        await deleteYandexResource(target)
        return Response.json({ ok: true })
      }
      case 'move': {
        const from = body.from ? normalizeApiPath(String(body.from)) : ''
        const to = body.to ? normalizeApiPath(String(body.to)) : ''
        if (!from || !to) {
          return Response.json({ error: 'Требуются пути откуда и куда' }, { status: 400 })
        }
        const parent = getParentPath(to)
        await ensureYandexPath(parent)
        await moveYandexResource(from, to)
        const syncMedia =
          body.syncMedia === true ||
          body.syncMedia === 'true' ||
          body.syncMedia === '1' ||
          body.syncMedia === 1
        const isDir =
          body.isDir === true || body.isDir === 'true' || body.isDir === '1' || body.isDir === 1
        if (syncMedia) {
          await updateMediaPathsForMove(from, to, isDir)
        }
        return Response.json({ ok: true })
      }
      case 'copy': {
        const from = body.from ? normalizeApiPath(String(body.from)) : ''
        const to = body.to ? normalizeApiPath(String(body.to)) : ''
        if (!from || !to) {
          return Response.json({ error: 'Требуются пути откуда и куда' }, { status: 400 })
        }
        const parent = getParentPath(to)
        await ensureYandexPath(parent)
        await copyYandexResource(from, to)
        return Response.json({ ok: true })
      }
      case 'rename': {
        const from = body.path ? normalizeApiPath(String(body.path)) : ''
        const newNameRaw = sanitizeName(String(body.newName || ''))
        if (!from || !newNameRaw) {
          return Response.json({ error: 'Требуются путь и новое имя' }, { status: 400 })
        }
        const parent = getParentPath(from)
        const { ext } = splitName(from.split('/').pop() || '')
        let newName = newNameRaw
        if (ext && !newNameRaw.endsWith(ext)) {
          const { base } = splitName(newNameRaw)
          newName = `${base}${ext}`
        }
        const to = parent === '/' ? `/${newName}` : `${parent}/${newName}`
        await moveYandexResource(from, to)
        return Response.json({ ok: true, to })
      }
      case 'resolve': {
        const targetPath = normalizeApiPath(String(body.path || '/'))
        return Response.json({ fullPath: resolveDiskPath(targetPath) })
      }
      default:
        return Response.json({ error: 'Неизвестное действие' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof YandexDiskError) {
      return Response.json({ error: error.message, details: error.body }, { status: error.status })
    }
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
