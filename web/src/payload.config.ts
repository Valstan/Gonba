import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Bookings } from './collections/Bookings'
import { Categories } from './collections/Categories'
import { Events } from './collections/Events'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Products } from './collections/Products'
import { Projects } from './collections/Projects'
import { Orders } from './collections/Orders'
import { Services } from './collections/Services'
import { Users } from './collections/Users'
import { VkImportQueue } from './collections/VkImportQueue'
import { VkAutoSync } from './collections/VkAutoSync'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { HomeCarousel } from './HomeCarousel/config'
import { VkAutoSyncSettings } from './globals/VkAutoSyncSettings/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { translations } from '@payloadcms/translations/all'
import { getServerSideURL } from './utilities/getURL'
import { cleanupYandexTrash } from './server/integrations/yandex-disk'
import { syncAllVkSources } from './server/integrations/vk-auto-sync'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const TRASH_RETENTION_DAYS = Number(process.env.YANDEX_TRASH_RETENTION_DAYS || 10)
const TRASH_CLEANUP_INTERVAL_MS = Number(process.env.YANDEX_TRASH_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000)

export default buildConfig({
  onInit: async (payload) => {
    const globalKey = '__yadiskTrashInterval'
    if ((globalThis as Record<string, unknown>)[globalKey]) return

    if (!process.env.YANDEX_DISK_TOKEN) {
      payload.logger.info('Yandex trash cleanup is disabled: YANDEX_DISK_TOKEN is not configured')
      return
    }

    const runCleanup = async () => {
      try {
        await cleanupYandexTrash('/.trash', TRASH_RETENTION_DAYS, {
          onItemError: ({ code, message, path, status }) => {
            payload.logger.warn(
              `Yandex trash cleanup skipped item: path=${path}, status=${status ?? 'unknown'}, code=${code ?? 'unknown'}, error=${message}`,
            )
          },
        })
      } catch (error) {
        payload.logger.error(`Yandex trash cleanup failed: ${(error as Error).message}`)
      }
    }

    // Do not block app start with network cleanup.
    setTimeout(() => {
      void runCleanup()
    }, 0)
    const interval = setInterval(runCleanup, TRASH_CLEANUP_INTERVAL_MS)
    ;(globalThis as Record<string, unknown>)[globalKey] = interval
  },
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
      graphics: {
        Icon: '@/components/AdminIcon',
        Logo: '@/components/AdminLogo',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Телефон',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Планшет',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Компьютер',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: true,
  }),
  collections: [
    Pages,
    Posts,
    Projects,
    Events,
    Services,
    Products,
    Orders,
    Bookings,
    VkImportQueue,
    VkAutoSync,
    Media,
    Categories,
    Users,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, HomeCarousel, VkAutoSyncSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  i18n: {
    fallbackLanguage: 'ru',
    supportedLanguages: {
      ru: translations.ru,
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [
      {
        slug: 'vkAutoSync',
        handler: async ({ payload }) => {
          const results = await syncAllVkSources(payload)
          const imported = results.filter((r) => r.newPostId).length
          payload.logger.info(`VK Auto-Sync: ${results.length} sources checked, ${imported} posts imported`)
          return results
        },
      },
    ],
  },
})
