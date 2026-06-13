import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { adminOrEditor } from '../access/adminOrEditor'
import { anyone } from '../access/anyone'
import {
  deleteYandexResource,
  getPublicDownloadUrl,
  getYandexResource,
  moveYandexResource,
  publishYandexResource,
  uploadLocalFileToYandex,
} from '../server/integrations/yandex-disk'
import { preventDeleteIfInUse } from '../server/media-usage/preventDeleteHook'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Медиафайл',
    plural: 'Медиа',
  },
  admin: {
    // Встроенный поиск админ-списка: по умолчанию ищет только по useAsTitle
    // (filename) — расширяем на alt, чтобы находить картинки по описанию.
    listSearchableFields: ['filename', 'alt'],
    components: {
      views: {
        list: {
          Component: '@/components/Admin/MediaListView',
        },
      },
    },
  },
  folders: true,
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      // Phase C.2 UI — «где используется» + force-delete / replace, в сайдбаре
      // страницы правки медиафайла. См. web/src/components/Admin/MediaActions.
      name: 'mediaActions',
      type: 'ui',
      admin: {
        position: 'sidebar',
        // Виджет — только в сайдбаре страницы правки; в списке Media как колонка
        // («Media Actions / Без метки») не нужен.
        disableListColumn: true,
        components: {
          Field: '@/components/Admin/MediaActions',
        },
      },
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    {
      name: 'yandexPath',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexResourceId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexPublicKey',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexPublicUrl',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexSha256',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexSyncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexCheckedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'yandexError',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
  upload: {
    // Temporary local storage before sync to Yandex Disk
    staticDir: path.resolve(dirname, '../../public/media'),
    focalPoint: true,
    imageSizes: [],
  },
  hooks: {
    afterRead: [
      async ({ doc, context }) => {
        if (!doc) return doc
        if (context?.skipYandexCheck) return doc

        // If the document has a Yandex.Disk path, all reads go through our
        // proxy endpoint /api/media/file/[id]. The endpoint serves from local
        // cache when available (legacy public/media or new MEDIA_CACHE_DIR)
        // and falls back to streaming from Y.Disk on cache miss.
        //
        // Records without yandexPath (currently 0 in prod per baseline 2026-05-22,
        // but kept as a safety net) get the standard Payload staticDir URL untouched.
        if (doc.yandexPath || doc.yandexResourceId) {
          const proxyUrl = `/api/media/file/${doc.id}`
          doc.url = proxyUrl
          doc.thumbnailURL = proxyUrl
          doc.sizes = undefined
        }

        return doc
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipYandexSync) return
        if (!doc?.filename) return

        const filenameChanged =
          operation === 'create' || (previousDoc?.filename && previousDoc.filename !== doc.filename)
        if (!filenameChanged && doc.yandexPath) return

        const mediaRoot = path.resolve(dirname, '../../public/media')
        const localPath = path.join(mediaRoot, doc.filename)

        const mediaBaseRaw = process.env.YANDEX_DISK_MEDIA_PATH || '/media'
        const mediaBase = mediaBaseRaw.startsWith('/') ? mediaBaseRaw : `/${mediaBaseRaw}`
        const baseTrimmed = mediaBase.endsWith('/') ? mediaBase.slice(0, -1) : mediaBase
        const targetPath = `${baseTrimmed}/${doc.id}-${doc.filename}`

        let localFileExists = true
        try {
          await fs.access(localPath)
        } catch {
          localFileExists = false
        }

        if (!localFileExists) {
          // After Phase 3, Yandex-synced files are removed from local disk. So on a
          // RENAME (filenameChanged with no local copy), there's nothing to re-upload —
          // instead MOVE the resource on Y.Disk so yandexPath follows the new filename
          // (otherwise yandexPath drifts from doc.filename). Verified on prod 2026-06-13:
          // move keeps resource_id+sha256, re-publish regenerates the public link, the
          // old path 404s. move/publish are the same helpers the admin Y.Disk file
          // manager uses (battle-tested). Non-rename file-missing → warn + skip as before.
          if (
            operation === 'update' &&
            previousDoc?.yandexPath &&
            previousDoc.yandexPath !== targetPath
          ) {
            try {
              await moveYandexResource(previousDoc.yandexPath, targetPath)
              await publishYandexResource(targetPath)
              const resource = await getYandexResource(targetPath, [
                'path',
                'resource_id',
                'public_key',
                'public_url',
                'sha256',
              ])
              const publicKey = resource.public_key
              const publicUrl = publicKey ? (await getPublicDownloadUrl(publicKey)).href : undefined

              await req.payload.update({
                collection: 'media',
                id: doc.id,
                data: {
                  yandexPath: targetPath,
                  yandexResourceId: resource.resource_id ?? doc.yandexResourceId ?? null,
                  yandexPublicKey: publicKey ?? null,
                  yandexPublicUrl: publicUrl ?? resource.public_url ?? null,
                  yandexSha256: resource.sha256 ?? doc.yandexSha256 ?? null,
                  yandexCheckedAt: new Date().toISOString(),
                  yandexError: null,
                },
                overrideAccess: true,
                req,
                context: { skipYandexSync: true },
              })
            } catch (error) {
              const message = (error as Error).message
              req.payload.logger.error(`Yandex rename/move failed for media ${doc.id}: ${message}`)
              await req.payload.update({
                collection: 'media',
                id: doc.id,
                data: { yandexError: message },
                overrideAccess: true,
                req,
                context: { skipYandexSync: true },
              })
            }
            return
          }

          req.payload.logger.warn(`Yandex sync skipped: file missing at ${localPath}`)
          return
        }

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

          await req.payload.update({
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
            req,
            context: { skipYandexSync: true },
          })

          // Phase 3: Y.Disk is now primary. After a successful upload+publish
          // we always remove the local original (and any image-size derivatives,
          // if collection ever gains them). The `/api/media/file/[id]` proxy
          // serves from `MEDIA_CACHE_DIR` (populated lazily on cache miss) or
          // from this legacy `public/media/` dir while it still has the file —
          // for new uploads, this dir empties on each upload by design.
          //
          // If upload to Y.Disk fails (catch below), we DO NOT remove the local
          // copy — it stays as a fallback (Payload's default staticDir serves it
          // for records without yandexPath).
          const sizeFiles = doc.sizes
            ? (Object.values(doc.sizes) as Array<{ filename?: string }>)
            : []
          const toRemove = [
            localPath,
            ...sizeFiles.map((size) => path.join(mediaRoot, size?.filename || '')),
          ]
          for (const filePath of toRemove) {
            if (!filePath || filePath.endsWith('/')) continue
            try {
              await fs.rm(filePath)
            } catch {
              // Ignore local cleanup errors — file may already be gone or in use
            }
          }
        } catch (error) {
          const message = (error as Error).message
          req.payload.logger.error(`Yandex sync failed for media ${doc.id}: ${message}`)
          await req.payload.update({
            collection: 'media',
            id: doc.id,
            data: {
              yandexError: message,
            },
            overrideAccess: true,
            req,
            context: { skipYandexSync: true },
          })
        }
      },
    ],
    beforeDelete: [preventDeleteIfInUse],
    afterDelete: [
      async ({ doc, req, context }) => {
        if (context?.skipYandexDelete) return
        if (!doc?.yandexPath && !doc?.yandexResourceId) return

        try {
          let pathToDelete = doc.yandexPath
          if (!pathToDelete && doc.yandexResourceId) {
            const resource = await getYandexResource(doc.yandexResourceId, ['path'])
            pathToDelete = resource.path
          }
          if (pathToDelete) {
            await deleteYandexResource(pathToDelete)
          }
        } catch (error) {
          const message = (error as Error).message
          req.payload.logger.error(`Yandex delete failed for media ${doc.id}: ${message}`)
        }
      },
    ],
  },
}
