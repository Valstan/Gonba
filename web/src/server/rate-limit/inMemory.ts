import 'server-only'

type Bucket = {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()
let cleanerStarted = false

function ensureCleaner(windowMs: number) {
  if (cleanerStarted) return
  cleanerStarted = true
  // Раз в окно чистим старые записи, чтобы Map не рос вечно.
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs * 2) {
        buckets.delete(key)
      }
    }
  }, windowMs).unref?.()
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetMs: number }
  | { allowed: false; remaining: 0; resetMs: number; retryAfterSec: number }

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  ensureCleaner(windowMs)
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, resetMs: now + windowMs }
  }
  if (bucket.count >= limit) {
    const resetMs = bucket.windowStart + windowMs
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - now) / 1000))
    return { allowed: false, remaining: 0, resetMs, retryAfterSec }
  }
  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, resetMs: bucket.windowStart + windowMs }
}
