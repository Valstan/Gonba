import 'dotenv/config'

import configPromise from '@payload-config'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'

import {
  getDownloadUrl,
  getPublicDownloadUrl,
  getPublicResource,
  getYandexResource,
  publishYandexResource,
  uploadLocalFileToYandex,
} from '@/server/integrations/yandex-disk'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const LOCAL_MAX_MB = Number(process.env.YANDEX_DISK_LOCAL_MAX_MB || 50)
const LOCAL_MAX_BYTES = Number.isFinite(LOCAL_MAX_MB) ? LOCAL_MAX_MB * 1024 * 1024 : 50 * 1024 * 1024

const getTargetPath = (id: string | number, filenameValue: string) => {
  const baseRaw = process.env.YANDEX_DISK_MEDIA_PATH || '/media'
  const base = baseRaw.startsWith('/') ? baseRaw : `/${baseRaw}`
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${id}-${filenameValue}`
}

const downloadToLocal = async (href: string, destination: string) => {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const res = await fetch(href)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status})`)
  }
  const nodeStream = Readable.fromWeb(res.body as any)
  await pipeline(nodeStream as any, createWriteStream(destination))
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const mediaRoot = path.resolve(dirname, '../public/media')
  const seedPublicKey = process.env.YANDEX_DISK_SEED_PUBLIC_KEY || ''
  const seedPublicPath = process.env.YANDEX_DISK_SEED_PATH || '/'
  const publicFilesByName = new Map<string, { href?: string; size?: number }>()

  const collectPublicFiles = async (publicKey: string, folderPath: string) => {
    const resource = (await getPublicResource(
      publicKey,
      [
        'path',
        'type',
        '_embedded.items.name',
        '_embedded.items.path',
        '_embedded.items.type',
        '_embedded.items.file',
        '_embedded.items.size',
      ],
      folderPath,
    )) as {
      _embedded?: { items?: Array<{ name?: string; path?: string; type?: string; file?: string; size?: number }> }
    }
    const items = resource?._embedded?.items || []
    for (const item of items) {
      if (!item?.name || !item?.type) continue
      if (item.type === 'dir' && item.path) {
        await collectPublicFiles(publicKey, item.path)
      } else if (item.type === 'file') {
        publicFilesByName.set(item.name, { href: item.file, size: item.size })
      }
    }
  }

  if (seedPublicKey) {
    try {
      await collectPublicFiles(seedPublicKey, seedPublicPath)
      payload.logger.info(`Loaded public seed files: ${publicFilesByName.size}`)
    } catch (error) {
      payload.logger.warn(`Public seed scan failed: ${(error as Error).message}`)
    }
  }

  let page = 1
  const limit = 50
  let totalPages = 1

  while (page <= totalPages) {
    const results = await payload.find({
      collection: 'media',
      overrideAccess: true,
      limit,
      page,
      sort: 'createdAt',
      context: { skipYandexCheck: true },
    })

    totalPages = results.totalPages || 1

    for (const doc of results.docs) {
      if (!doc?.filename) continue
      const sizeBytes = typeof doc.filesize === 'number' ? doc.filesize : 0
      const localPath = path.join(mediaRoot, doc.filename)
      let hasLocal = true
      try {
        await fs.access(localPath)
      } catch {
        hasLocal = false
      }

      if (!hasLocal && publicFilesByName.size) {
        const publicEntry =
          publicFilesByName.get(doc.filename) ?? publicFilesByName.get(`${doc.id}-${doc.filename}`)
        if (publicEntry?.href) {
          try {
            await downloadToLocal(publicEntry.href, localPath)
            payload.logger.info(`Restored local media ${doc.id} from public seed`)
            hasLocal = true
          } catch (error) {
            payload.logger.warn(
              `Public seed download failed for ${doc.id}: ${(error as Error).message}`,
            )
          }
        }
      }

      if (doc.yandexResourceId || doc.yandexPath) {
        try {
          const expectedPath = getTargetPath(doc.id, doc.filename)
          const primaryKey =
            doc.yandexPath && doc.yandexPath.endsWith(`/${doc.filename}`) ? doc.yandexPath : expectedPath
          const fallbackKeyRaw = doc.yandexResourceId || ''
          const isDiskPathLike =
            fallbackKeyRaw.startsWith('/') ||
            fallbackKeyRaw.startsWith('disk:') ||
            fallbackKeyRaw.startsWith('app:') ||
            fallbackKeyRaw.startsWith('urn:')
          const fallbackKey = isDiskPathLike ? fallbackKeyRaw : ''
          const resourceFields = [
            'path',
            'resource_id',
            'public_key',
            'public_url',
            'sha256',
            'md5',
            'size',
          ]
          const getResourceWithFallback = async () => {
            try {
              return await getYandexResource(primaryKey || fallbackKey, resourceFields)
            } catch (error) {
              if (fallbackKey && primaryKey && primaryKey !== fallbackKey) {
                return await getYandexResource(fallbackKey, resourceFields)
              }
              throw error
            }
          }

          let resource = await getResourceWithFallback()
          const hasValidResourcePath = Boolean(
            resource?.path && doc.filename && resource.path.endsWith(`/${doc.filename}`),
          )
          if (!hasValidResourcePath && fallbackKey && primaryKey && primaryKey !== fallbackKey) {
            resource = await getYandexResource(fallbackKey, resourceFields)
          }
          const publicKey = resource.public_key
          const publicUrl = publicKey ? (await getPublicDownloadUrl(publicKey)).href : undefined
          const nextPath = resource.path
          const hasValidPath = Boolean(nextPath && doc.filename && nextPath.endsWith(`/${doc.filename}`))
          if (hasValidPath && nextPath !== doc.yandexPath) {
            await payload.update({
              collection: 'media',
              id: doc.id,
              data: {
                yandexPath: nextPath,
                yandexPublicKey: publicKey ?? null,
                yandexPublicUrl: publicUrl ?? resource.public_url ?? null,
                yandexSha256: resource.sha256 ?? null,
                yandexCheckedAt: new Date().toISOString(),
                yandexError: null,
              },
              overrideAccess: true,
              context: { skipYandexSync: true },
            })
            payload.logger.info(`Updated Yandex path for media ${doc.id} -> ${nextPath}`)
          }
          const effectiveSize =
            typeof doc.filesize === 'number' && doc.filesize > 0 ? doc.filesize : resource.size || 0
          if (effectiveSize <= LOCAL_MAX_BYTES) {
            const localPath = path.join(mediaRoot, doc.filename)
            try {
              await fs.access(localPath)
            } catch {
              if (publicUrl) {
                await downloadToLocal(publicUrl, localPath)
                payload.logger.info(`Restored local media ${doc.id} from Yandex`)
              } else if (nextPath) {
                const download = await getDownloadUrl(nextPath)
                if (download?.href) {
                  await downloadToLocal(download.href, localPath)
                  payload.logger.info(`Restored local media ${doc.id} from Yandex`)
                }
              }
            }
          }
          continue
        } catch (error) {
          if (doc.yandexPublicKey) {
            try {
              const resource = await getPublicResource(doc.yandexPublicKey, [
                'path',
                'public_key',
                'public_url',
                'sha256',
                'md5',
                'size',
              ])
              const nextPath = resource.path
              const hasValidPath = Boolean(
                nextPath && doc.filename && nextPath.endsWith(`/${doc.filename}`),
              )
              await payload.update({
                collection: 'media',
                id: doc.id,
                data: {
                  yandexPath: hasValidPath ? nextPath : doc.yandexPath ?? null,
                  yandexPublicUrl: resource.public_url ?? doc.yandexPublicUrl ?? null,
                  yandexSha256: resource.sha256 ?? null,
                  yandexCheckedAt: new Date().toISOString(),
                  yandexError: null,
                },
                overrideAccess: true,
                context: { skipYandexSync: true },
              })
              const effectiveSize =
                typeof doc.filesize === 'number' && doc.filesize > 0 ? doc.filesize : resource.size || 0
              if (effectiveSize <= LOCAL_MAX_BYTES) {
                const localPath = path.join(mediaRoot, doc.filename)
                try {
                  await fs.access(localPath)
                } catch {
                  if (resource.public_url) {
                    await downloadToLocal(resource.public_url, localPath)
                    payload.logger.info(`Restored local media ${doc.id} from Yandex`)
                  }
                }
              }
              continue
            } catch (fallbackError) {
              payload.logger.warn(
                `Yandex public lookup failed for ${doc.id}: ${(fallbackError as Error).message}`,
              )
            }
          }
          payload.logger.warn(`Yandex resource lookup failed for ${doc.id}: ${(error as Error).message}`)
        }
      }

      if (!hasLocal) {
        payload.logger.warn(`Media missing locally: ${localPath}`)
        continue
      }

      const targetPath = getTargetPath(doc.id, doc.filename)
      try {
        await uploadLocalFileToYandex(localPath, targetPath)
        await publishYandexResource(targetPath)
        const resource = await getYandexResource(targetPath, [
          'path',
          'resource_id',
          'public_key',
          'public_url',
          'sha256',
          'md5',
          'size',
        ])
        const publicKey = resource.public_key
        const publicUrl = publicKey ? (await getPublicDownloadUrl(publicKey)).href : undefined
        await payload.update({
          collection: 'media',
          id: doc.id,
          data: {
            yandexPath: targetPath,
            yandexResourceId: resource.resource_id ?? null,
            yandexPublicKey: publicKey ?? null,
            yandexPublicUrl: publicUrl ?? resource.public_url ?? null,
            yandexSha256: resource.sha256 ?? null,
            yandexSyncedAt: new Date().toISOString(),
            yandexCheckedAt: new Date().toISOString(),
            yandexError: null,
          },
          overrideAccess: true,
          context: { skipYandexSync: true },
        })
        if (sizeBytes > LOCAL_MAX_BYTES) {
          const sizeFiles = doc.sizes ? (Object.values(doc.sizes) as Array<{ filename?: string }>) : []
          const toRemove = [
            localPath,
            ...sizeFiles.map((size) => path.join(mediaRoot, size?.filename || '')),
          ]
          for (const filePath of toRemove) {
            if (!filePath || filePath.endsWith('/')) continue
            try {
              await fs.rm(filePath)
            } catch {
              // Ignore local cleanup errors
            }
          }
        }
        payload.logger.info(`Synced media ${doc.id} -> ${targetPath}`)
      } catch (error) {
        const message = (error as Error).message
        await payload.update({
          collection: 'media',
          id: doc.id,
          data: {
            yandexError: message,
          },
          overrideAccess: true,
          context: { skipYandexSync: true },
        })
        payload.logger.error(`Failed to sync media ${doc.id}: ${message}`)
      }
    }

    page += 1
  }
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
