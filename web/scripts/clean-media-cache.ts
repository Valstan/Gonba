import 'dotenv/config'

import fs from 'fs/promises'
import path from 'path'

/**
 * Media cache cleanup — removes files older than TTL from MEDIA_CACHE_DIR.
 *
 * The `/api/media/file/[id]` proxy endpoint populates this directory lazily
 * on cache miss (cf. `docs/plans/media-to-yadisk.md`, Phase 1+4). When a file
 * is read from cache, its `atime` is bumped via `utimes`. This script removes
 * entries whose `atime` (or `mtime` fallback) is older than `--ttl-days`.
 *
 * On Linux with default `relatime` mount option, `atime` is updated at most
 * once per day, which is precise enough for a daily 30-day cleanup. On
 * `noatime` mounts the script falls back to `mtime` automatically.
 *
 * Usage:
 *   tsx scripts/clean-media-cache.ts [--dir <path>] [--ttl-days <N>] [--dry]
 *
 * Defaults:
 *   --dir       process.env.MEDIA_CACHE_DIR or ./public/media-cache
 *   --ttl-days  30
 *   --dry       false (actually remove)
 */

type Args = {
  dir: string
  ttlDays: number
  dry: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const idx = argv.indexOf(name)
    if (idx === -1 || idx === argv.length - 1) return undefined
    return argv[idx + 1]
  }

  const dirArg = get('--dir') || process.env.MEDIA_CACHE_DIR || './public/media-cache'
  const ttlArg = get('--ttl-days')
  const ttlDays = ttlArg !== undefined ? Number(ttlArg) : 30
  if (!Number.isFinite(ttlDays) || ttlDays < 0) {
    console.error(`Invalid --ttl-days: ${ttlArg}`)
    process.exit(2)
  }
  return {
    dir: path.resolve(dirArg),
    ttlDays,
    dry: argv.includes('--dry'),
  }
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2)
}

async function main() {
  const { dir, ttlDays, dry } = parseArgs(process.argv.slice(2))
  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000

  console.log(`media-cache-clean: dir=${dir} ttl-days=${ttlDays} dry=${dry}`)
  console.log(`  cutoff: files last accessed before ${new Date(cutoffMs).toISOString()}`)

  try {
    const st = await fs.stat(dir)
    if (!st.isDirectory()) {
      console.error(`Not a directory: ${dir}`)
      process.exit(1)
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      console.log(`Cache dir does not exist — nothing to clean.`)
      return
    }
    throw err
  }

  let scanned = 0
  let eligible = 0
  let removed = 0
  let scannedBytes = 0
  let freedBytes = 0

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    // Skip subdirectories and special entries — flat layout by design.
    // Also skip .tmp.<...> writer artefacts (atomic-rename leftovers, rare).
    if (!entry.isFile()) continue
    if (entry.name.includes('.tmp.')) continue

    scanned += 1
    const full = path.join(dir, entry.name)
    let st: Awaited<ReturnType<typeof fs.stat>>
    try {
      st = await fs.stat(full)
    } catch (err) {
      console.warn(`  stat failed for ${entry.name}: ${(err as Error).message}`)
      continue
    }
    scannedBytes += st.size

    // Use atime; if fs is mounted noatime, atime stays at file creation —
    // mtime is then a better signal. Use whichever is more recent.
    const accessMs = Math.max(st.atimeMs || 0, st.mtimeMs || 0)
    if (accessMs >= cutoffMs) continue

    eligible += 1
    freedBytes += st.size
    if (dry) {
      console.log(
        `  [dry] would remove ${entry.name} (${st.size}B, accessed ${new Date(accessMs).toISOString()})`,
      )
      continue
    }
    try {
      await fs.rm(full)
      removed += 1
    } catch (err) {
      console.error(`  failed to remove ${entry.name}: ${(err as Error).message}`)
    }
  }

  console.log(
    `done: scanned=${scanned} (${fmtMB(scannedBytes)} MB), ` +
      `eligible=${eligible}, ` +
      `${dry ? `would free` : `removed=${removed},`} ${fmtMB(freedBytes)} MB`,
  )
}

main().catch((err) => {
  console.error(`media-cache-clean: ${err instanceof Error ? err.stack || err.message : err}`)
  process.exit(1)
})
