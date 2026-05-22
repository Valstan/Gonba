import 'dotenv/config'

import configPromise from '@payload-config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'

import {
  getPublicDownloadUrl,
  getYandexResource,
  publishYandexResource,
  uploadLocalFileToYandex,
} from '@/server/integrations/yandex-disk'

/**
 * One-shot migration: upload Media records that don't have `yandexPath`
 * to Yandex.Disk and fill the `yandex*` metadata fields.
 *
 * Per baseline 2026-05-22, this is effectively a no-op for GONBA (all 333
 * records already have `yandexPath`). Kept as a **safety net** for:
 * - new uploads where Payload's `afterChange` hook silently failed
 * - records imported from elsewhere bypassing the hook
 * - fresh deploys before phase-3 was active
 *
 * Idempotent: records already with `yandexPath` are skipped.
 * Plan reference: docs/plans/media-to-yadisk.md → Фаза 5.
 *
 * Usage:
 *   tsx scripts/migrate-media-to-yandex.ts [--dry] [--limit N] [--id <id>]
 *
 * Options:
 *   --dry        Don't upload, just print what would happen.
 *   --limit N    Process at most N records per page (default 50).
 *   --id <id>    Process only this specific Media record (good for PoC).
 *   --max N      Stop after processing N total (across pages). Useful for
 *                "first 10" smoke testing on prod.
 *
 * Does NOT remove local files — that's the job of the afterChange hook
 * after Phase 3 lands. For records migrated here, the next `update` on
 * the doc (e.g. editing alt text) will trigger afterChange → re-upload
 * is skipped (yandex_path present), and the file stays on disk as a
 * passive legacy. Use the `/api/media/file/[id]` proxy and let TTL
 * cron eventually clean it up if it goes unused.
 */

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const mediaRoot = path.resolve(dirname, '../public/media')

type Args = {
  dry: boolean
  limit: number
  id: number | string | null
  max: number | null
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const idx = argv.indexOf(name)
    if (idx === -1 || idx === argv.length - 1) return undefined
    return argv[idx + 1]
  }
  const limit = Number(get('--limit') ?? 50)
  const max = get('--max') !== undefined ? Number(get('--max')) : null
  const idRaw = get('--id')
  let id: number | string | null = null
  if (idRaw !== undefined) {
    const asNum = Number(idRaw)
    id = Number.isFinite(asNum) ? asNum : idRaw
  }
  return {
    dry: argv.includes('--dry'),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    id,
    max: max !== null && Number.isFinite(max) && max > 0 ? max : null,
  }
}

function targetPathFor(id: number | string, filenameValue: string): string {
  const baseRaw = process.env.YANDEX_DISK_MEDIA_PATH || '/media'
  const base = baseRaw.startsWith('/') ? baseRaw : `/${baseRaw}`
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${id}-${filenameValue}`
}

async function run() {
  const { dry, limit, id, max } = parseArgs(process.argv.slice(2))
  const payload = await getPayload({ config: configPromise })

  payload.logger.info(
    `migrate-media-to-yandex: dry=${dry} limit=${limit} id=${id ?? '(all)'} max=${max ?? '(none)'}`,
  )

  let processed = 0
  let migrated = 0
  let skipped = 0
  let failed = 0
  let missingLocal = 0

  // Single-id mode: just fetch that one doc.
  if (id !== null) {
    let doc
    try {
      doc = await payload.findByID({
        collection: 'media',
        id,
        depth: 0,
        overrideAccess: true,
        context: { skipYandexCheck: true },
      })
    } catch (err) {
      payload.logger.error(`Could not load media id=${id}: ${(err as Error).message}`)
      return { processed, migrated, skipped, failed, missingLocal }
    }
    if (!doc) {
      payload.logger.error(`No media doc with id=${id}`)
      return { processed, migrated, skipped, failed, missingLocal }
    }
    const result = await processDoc(payload, doc, { dry })
    processed += 1
    if (result === 'migrated') migrated += 1
    else if (result === 'skipped') skipped += 1
    else if (result === 'missing-local') missingLocal += 1
    else failed += 1
    return { processed, migrated, skipped, failed, missingLocal }
  }

  // Bulk mode: paginate through records WHERE yandex_path IS NULL.
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const result = await payload.find({
      collection: 'media',
      where: {
        yandexPath: { exists: false },
      } as never,
      sort: 'id',
      limit,
      page,
      overrideAccess: true,
      depth: 0,
      context: { skipYandexCheck: true },
    })
    totalPages = result.totalPages || 1
    if (page === 1) {
      payload.logger.info(`Found ${result.totalDocs} candidate media records without yandexPath`)
      if (result.totalDocs === 0) {
        payload.logger.info(`Nothing to migrate — exiting clean.`)
        break
      }
    }

    for (const doc of result.docs) {
      if (max !== null && processed >= max) {
        payload.logger.info(`Reached --max ${max}, stopping.`)
        page = totalPages + 1 // break outer
        break
      }
      const outcome = await processDoc(payload, doc, { dry })
      processed += 1
      if (outcome === 'migrated') migrated += 1
      else if (outcome === 'skipped') skipped += 1
      else if (outcome === 'missing-local') missingLocal += 1
      else failed += 1
    }
    page += 1
  }

  return { processed, migrated, skipped, failed, missingLocal }
}

type Outcome = 'migrated' | 'skipped' | 'missing-local' | 'failed'

async function processDoc(
  payload: Awaited<ReturnType<typeof getPayload>>,
  // Doc type from Local API is wide; we destructure the few fields we need.
  doc: { id: number | string; filename?: string | null; yandexPath?: string | null },
  opts: { dry: boolean },
): Promise<Outcome> {
  const { id, filename: filenameValue, yandexPath } = doc

  if (yandexPath) {
    payload.logger.info(`[${id}] skip — yandexPath already set: ${yandexPath}`)
    return 'skipped'
  }
  if (!filenameValue) {
    payload.logger.error(`[${id}] no filename — record looks broken`)
    return 'failed'
  }

  const localPath = path.join(mediaRoot, filenameValue)
  try {
    await fs.access(localPath)
  } catch {
    payload.logger.warn(`[${id}] missing local file: ${localPath}`)
    return 'missing-local'
  }

  const target = targetPathFor(id, filenameValue)
  if (opts.dry) {
    payload.logger.info(`[${id}] [dry] would upload ${localPath} → ${target}`)
    return 'migrated'
  }

  try {
    await uploadLocalFileToYandex(localPath, target)
    await publishYandexResource(target)
    const resource = await getYandexResource(target, [
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
      id,
      data: {
        yandexPath: target,
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
    payload.logger.info(`[${id}] uploaded ${localPath} → ${target} (size=${resource.size ?? '?'})`)
    return 'migrated'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    payload.logger.error(`[${id}] failed: ${message}`)
    try {
      await payload.update({
        collection: 'media',
        id,
        data: { yandexError: message },
        overrideAccess: true,
        context: { skipYandexSync: true },
      })
    } catch {
      // ignore secondary failure
    }
    return 'failed'
  }
}

run()
  .then(({ processed, migrated, skipped, failed, missingLocal }) => {
    console.log(
      `\nSummary: processed=${processed}, migrated=${migrated}, skipped=${skipped}, ` +
        `missing-local=${missingLocal}, failed=${failed}`,
    )
    process.exit(failed > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
