import { createHash } from 'crypto'

import 'server-only'

const FALLBACK_SALT = 'gonba-default-salt'

export function hashIp(rawIp: string | null | undefined): string {
  const salt = process.env.IP_HASH_SALT || FALLBACK_SALT
  const ip = (rawIp || 'unknown').trim()
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export function getRequestIpHash(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const cf = headers.get('cf-connecting-ip')
  const raw = (forwarded?.split(',')[0] || realIp || cf || '').trim() || 'unknown'
  return hashIp(raw)
}
