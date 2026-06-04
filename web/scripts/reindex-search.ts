import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Reindex search — пересохраняет ОПУБЛИКОВАННЫЕ документы индексируемых коллекций,
 * чтобы afterChange-хук @payloadcms/plugin-search пересинхронизировал их в
 * служебную коллекцию `search`.
 *
 * Нужен когда:
 *   - расширился набор индексируемых коллекций (FTS Phase 2: +pages, +projects) —
 *     плагин синкает только при save, поэтому ранее существующие документы
 *     отсутствуют в `search`;
 *   - поменялась логика beforeSync (Phase 2 деривирует meta.image из heroImage и
 *     описание из excerpt/summary) — старые записи `search` надо обновить.
 *
 * Пересохраняет title→title (контент не меняется) только на published-документах,
 * сохраняя статус. Ревалидацию страниц глушим через context.disableRevalidate
 * (хуки revalidate* её уважают) — синк поиска при этом всё равно отрабатывает.
 * Идемпотентно. Запускать ПОСЛЕ деплоя + миграции 20260604_120000.
 *
 * Usage:
 *   corepack pnpm tsx scripts/reindex-search.ts [--collections posts,pages,projects] [--dry]
 */

const ALL = ['posts', 'pages', 'projects'] as const
type Coll = (typeof ALL)[number]

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dry = argv.includes('--dry')
  const collFlagIdx = argv.indexOf('--collections')
  const collections: Coll[] =
    collFlagIdx !== -1 && argv[collFlagIdx + 1]
      ? (argv[collFlagIdx + 1]
          .split(',')
          .map((c) => c.trim())
          .filter((c): c is Coll => (ALL as readonly string[]).includes(c)))
      : [...ALL]

  const payload = await getPayload({ config: configPromise })

  for (const collection of collections) {
    let page = 1
    let processed = 0
    let failed = 0
    let totalDocs = 0

    for (;;) {
      const res = await payload.find({
        collection,
        where: { _status: { equals: 'published' } },
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
        select: { title: true },
      })
      totalDocs = res.totalDocs

      for (const doc of res.docs) {
        if (dry) {
          processed++
          continue
        }
        try {
          await payload.update({
            collection,
            id: doc.id,
            data: { title: (doc as { title?: string }).title ?? '' },
            overrideAccess: true,
            context: { disableRevalidate: true },
          })
          processed++
        } catch (err) {
          failed++
          payload.logger.error(
            `[reindex-search] ${collection}#${doc.id} failed: ${(err as Error).message}`,
          )
        }
      }

      if (!res.hasNextPage) break
      page++
    }

    payload.logger.info(
      `[reindex-search] ${collection}: ${dry ? 'would reindex' : 'reindexed'} ${processed}/${totalDocs} published docs` +
        (failed ? ` (${failed} failed)` : ''),
    )
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
