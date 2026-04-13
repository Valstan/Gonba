import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import {
  deleteYandexResource,
  getPublicDownloadUrl,
  getYandexResource,
  publishYandexResource,
  uploadLocalFileToYandex,
} from '../server/integrations/yandex-disk'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const LOCAL_MAX_MB = Number(process.env.YANDEX_DISK_LOCAL_MAX_MB || 50)
const LOCAL_MAX_BYTES = Number.isFinite(LOCAL_MAX_MB) ? LOCAL_MAX_MB * 1024 * 1024 : 50 * 1024 * 1024

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Медиафайл',
    plural: 'Медиа',
  },
  admin: {
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
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      //required: true,
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

        const applyPublicUrl = (url?: string | null) => {
          if (!url) return
          doc.url = url
          doc.thumbnailURL = url
          doc.sizes = undefined
        }
        const mediaRoot = path.resolve(dirname, '../../public/media')
        const localPath = doc.filename ? path.join(mediaRoot, doc.filename) : null
        const sizeBytes = typeof doc.filesize === 'number' ? doc.filesize : 0
        let hasLocal = false
        if (localPath) {
          try {
            await fs.access(localPath)
            hasLocal = true
          } catch {
            hasLocal = false
          }
        }
        const shouldServeYandex =
          Boolean(doc.yandexPublicUrl) && (sizeBytes > LOCAL_MAX_BYTES || !hasLocal)
        if (shouldServeYandex) {
          applyPublicUrl(doc.yandexPublicUrl)
        } else if (!hasLocal && doc.url) {
          doc.url = ''
          doc.thumbnailURL = ''
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
        const sizeBytes = typeof doc.filesize === 'number' ? doc.filesize : 0

        try {
          await fs.access(localPath)
        } catch {
          req.payload.logger.warn(`Yandex sync skipped: file missing at ${localPath}`)
          return
        }

        const mediaBaseRaw = process.env.YANDEX_DISK_MEDIA_PATH || '/media'
        const mediaBase = mediaBaseRaw.startsWith('/') ? mediaBaseRaw : `/${mediaBaseRaw}`
        const baseTrimmed = mediaBase.endsWith('/') ? mediaBase.slice(0, -1) : mediaBase
        const targetPath = `${baseTrimmed}/${doc.id}-${doc.filename}`

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

          if (sizeBytes > LOCAL_MAX_BYTES) {
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
                // Ignore local cleanup errors
              }
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
