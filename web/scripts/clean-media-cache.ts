import 'dotenv/config'

import fs from 'fs/promises'
import path from 'path'

/**
 * Media cache cleanup — removes files unused for TTL days from the on-disk
 * media directories on the VPS.
 *
 * The `/api/media/file/[id]` proxy endpoint serves media from two on-disk
 * locations and falls back to streaming from Yandex.Disk on a miss:
 *   1. MEDIA_CACHE_DIR (new lazy cache, default `public/media-cache`) —
 *      populated on cache miss.
 *   2. LEGACY `public/media` — Payload's original `staticDir`, where all
 *      pre-Yandex-migration files still live.
 *
 * On every read (from EITHER location) the proxy bumps the file's `atime` via
 * `utimes` (see route.ts → `bumpAtime`). So "demand" is recorded uniformly as
 * access time, and this script rotates BOTH directories by the same rule:
 * remove entries whose `atime` (or `mtime` fallback) is older than `--ttl-days`.
 * Hot files (recently served) keep a fresh atime and survive; cold files age
 * out and are re-fetched from Yandex into MEDIA_CACHE_DIR on their next request.
 *
 * Why legacy is rotated too: every Media doc with a `yandexPath` (all of prod
 * as of 2026-06-03) is served via the proxy and backed on Yandex, so a cold
 * legacy copy is pure redundancy — safe to evict. Orphan files in `public/media`
 * with no DB record are never served (proxy looks up by id), so they never get
 * an atime bump and drain out within the TTL window. Pass `--no-legacy` to scan
 * only the cache dir.
 *
 * Safety: a file is eligible only when BOTH atime and mtime are older than the
 * cutoff, so a fresh upload transiently sitting in `public/media` (mtime=now,
 * before the afterChange hook uploads + removes it) is never touched.
 *
 * On Linux with default `relatime` mount option, automatic `atime` updates
 * happen at most once per day, but the proxy's explicit `utimes` is not subject
 * to that throttle. On `noatime` mounts the script falls back to `mtime`.
 *
 * Usage:
 *   tsx scripts/clean-media-cache.ts [--dir <path>]... [--ttl-days <N>] [--dry] [--no-legacy]
 *
 * Defaults:
 *   dirs        [MEDIA_CACHE_DIR | ./public/media-cache, MEDIA_LEGACY_DIR | ./public/media]
 *               (explicit --dir flags, repeatable, override the default pair)
 *   --ttl-days  30
 *   --dry       false (actually remove)
 */

type Args = {
  dirs: string[]
  ttlDays: number
  dry: boolean
}

function parseArgs(argv: string[]): Args {
  const getAll = (name: string): string[] => {
    const out: string[] = []
    for (let i = 0; i < argv.length - 1; i += 1) {
      if (argv[i] === name) out.push(argv[i + 1])
    }
    return out
  }
  const getOne = (name: string): string | undefined => {
    const idx = argv.indexOf(name)
    if (idx === -1 || idx === argv.length - 1) return undefined
    return argv[idx + 1]
  }

  const cacheDir = process.env.MEDIA_CACHE_DIR || './public/media-cache'
  const legacyDir = process.env.MEDIA_LEGACY_DIR || './public/media'

  const explicitDirs = getAll('--dir')
  let dirInputs: string[]
  if (explicitDirs.length > 0) {
    dirInputs = explicitDirs
  } else if (argv.includes('--no-legacy')) {
    dirInputs = [cacheDir]
  } else {
    dirInputs = [cacheDir, legacyDir]
  }

  // Resolve + dedupe (env/default could collapse to the same path).
  const dirs = Array.from(new Set(dirInputs.map((d) => path.resolve(d))))

  const ttlArg = getOne('--ttl-days')
  const ttlDays = ttlArg !== undefined ? Number(ttlArg) : 30
  if (!Number.isFinite(ttlDays) || ttlDays < 0) {
    console.error(`Invalid --ttl-days: ${ttlArg}`)
    process.exit(2)
  }
  return {
    dirs,
    ttlDays,
    dry: argv.includes('--dry'),
  }
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2)
}

type DirResult = {
  scanned: number
  eligible: number
  removed: number
  scannedBytes: number
  freedBytes: number
}

async function cleanDir(dir: string, cutoffMs: number, dry: boolean): Promise<DirResult> {
  const result: DirResult = {
    scanned: 0,
    eligible: 0,
    removed: 0,
    scannedBytes: 0,
    freedBytes: 0,
  }

  try {
    const st = await fs.stat(dir)
    if (!st.isDirectory()) {
      console.error(`  not a directory, skipping: ${dir}`)
      return result
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      console.log(`  ${dir}: does not exist — nothing to clean.`)
      return result
    }
    throw err
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    // Skip subdirectories and special entries — flat layout by design.
    // Also skip .tmp.<...> writer artefacts (atomic-rename leftovers, rare).
    if (!entry.isFile()) continue
    if (entry.name.includes('.tmp.')) continue

    result.scanned += 1
    const full = path.join(dir, entry.name)
    let st: Awaited<ReturnType<typeof fs.stat>>
    try {
      st = await fs.stat(full)
    } catch (err) {
      console.warn(`  stat failed for ${entry.name}: ${(err as Error).message}`)
      continue
    }
    result.scannedBytes += st.size

    // Use the most recent of atime/mtime. atime tracks demand (proxy bumps it
    // on every serve); mtime is the fallback on noatime mounts. A file is
    // eligible only when BOTH are older than the cutoff — protects fresh
    // uploads transiently present in legacy public/media (mtime=now).
    const accessMs = Math.max(st.atimeMs || 0, st.mtimeMs || 0)
    if (accessMs >= cutoffMs) continue

    result.eligible += 1
    result.freedBytes += st.size
    if (dry) {
      console.log(
        `  [dry] would remove ${entry.name} (${st.size}B, accessed ${new Date(accessMs).toISOString()})`,
      )
      continue
    }
    try {
      await fs.rm(full)
      result.removed += 1
    } catch (err) {
      console.error(`  failed to remove ${entry.name}: ${(err as Error).message}`)
    }
  }

  console.log(
    `  ${dir}: scanned=${result.scanned} (${fmtMB(result.scannedBytes)} MB), ` +
      `eligible=${result.eligible}, ` +
      `${dry ? `would free` : `removed=${result.removed},`} ${fmtMB(result.freedBytes)} MB`,
  )
  return result
}

async function main() {
  const { dirs, ttlDays, dry } = parseArgs(process.argv.slice(2))
  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000

  console.log(`media-cache-clean: dirs=[${dirs.join(', ')}] ttl-days=${ttlDays} dry=${dry}`)
  console.log(`  cutoff: files last accessed before ${new Date(cutoffMs).toISOString()}`)

  const totals: DirResult = {
    scanned: 0,
    eligible: 0,
    removed: 0,
    scannedBytes: 0,
    freedBytes: 0,
  }

  for (const dir of dirs) {
    const r = await cleanDir(dir, cutoffMs, dry)
    totals.scanned += r.scanned
    totals.eligible += r.eligible
    totals.removed += r.removed
    totals.scannedBytes += r.scannedBytes
    totals.freedBytes += r.freedBytes
  }

  console.log(
    `done: scanned=${totals.scanned} (${fmtMB(totals.scannedBytes)} MB), ` +
      `eligible=${totals.eligible}, ` +
      `${dry ? `would free` : `removed=${totals.removed},`} ${fmtMB(totals.freedBytes)} MB`,
  )
}

main().catch((err) => {
  console.error(`media-cache-clean: ${err instanceof Error ? err.stack || err.message : err}`)
  process.exit(1)
})
