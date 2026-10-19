import { describe, expect, it } from 'vitest'

import { clientIp } from '@/server/ugc/ugc'
import { extractClientIp } from '@/utilities/clientIp'
import { getRequestIpHash, hashIp } from '@/utilities/getRequestIpHash'
import { rateLimit } from '@/server/ugc/rateLimit'

/**
 * IP клиента берётся **с доверенного хопа**, а не с того, который назвал сам клиент.
 *
 * Прод-схема: один nginx, который собирает `X-Forwarded-For` из того, что прислал клиент,
 * и дописывает реальный peer. Значит **первый** элемент списка подконтролен атакующему, а
 * последний — адрес, дописанный нашим прокси. До аудита 2026-10-18 код брал первый элемент,
 * поэтому аноним подставлял новый «IP» в каждый запрос и обнулял разом лимиты UGC/чата/заявок,
 * дедуп жалоб и порог авто-скрытия, а `ipHash` перестал что-либо значить (класс G413).
 */

const salt = 'test-salt-audit-2026-10-18'
process.env.IP_HASH_SALT = salt
process.env.UGC_IP_SALT = salt

const headers = (init: Record<string, string>) => new Headers(init)

describe('extractClientIp: доверенный хоп', () => {
  it('X-Real-IP (ставит наш nginx) важнее подделанного X-Forwarded-For', () => {
    const ip = extractClientIp(
      headers({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '203.0.113.10' }),
    )
    expect(ip).toBe('203.0.113.10')
  })

  it('цепочка XFF из нескольких хопов → берётся последний (дописанный прокси)', () => {
    const ip = extractClientIp(
      headers({ 'x-forwarded-for': '127.0.0.1, 10.0.0.5, 203.0.113.10' }),
    )
    expect(ip).toBe('203.0.113.10')
  })

  it('одиночный XFF → он сам; пробелы обрезаются', () => {
    expect(extractClientIp(headers({ 'x-forwarded-for': ' 203.0.113.10 ' }))).toBe('203.0.113.10')
  })

  it('пустой X-Real-IP не блокирует XFF-цепочку', () => {
    const ip = extractClientIp(headers({ 'x-real-ip': '   ', 'x-forwarded-for': 'a, 203.0.113.10' }))
    expect(ip).toBe('203.0.113.10')
  })

  it('заголовков нет → null (все клиенты в одном бакете — честнее, чем верить первому встречному)', () => {
    expect(extractClientIp(headers({}))).toBeNull()
    expect(extractClientIp(headers({ 'x-forwarded-for': ' ,  ' }))).toBeNull()
  })

  it('clientIp: подстановка первого хопа больше не даёт свежую корзину', () => {
    const request = headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.10' })
    expect(clientIp(request)).toBe('203.0.113.10')

    // Один и тот же клиент с разным первым хопом = один и тот же ключ лимита.
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.10' }))).toBe('203.0.113.10')
  })

  it('clientIp: без заголовков — "unknown" (поведение сохранено)', () => {
    expect(clientIp(headers({}))).toBe('unknown')
  })
})

describe('hashIp / getRequestIpHash', () => {
  it('хеш детерминирован и зависит от соли', () => {
    const before = hashIp('203.0.113.10')
    expect(before).toBe(hashIp('203.0.113.10'))
    expect(before).toHaveLength(32)

    const previous = process.env.IP_HASH_SALT
    process.env.IP_HASH_SALT = `${salt}-other`
    expect(hashIp('203.0.113.10')).not.toBe(before)
    process.env.IP_HASH_SALT = previous
  })

  it('хеш берёт доверенный хоп, а не подделанный первый', () => {
    const spoofed = getRequestIpHash(
      headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.10' }),
    )
    const honest = getRequestIpHash(headers({ 'x-forwarded-for': '203.0.113.10' }))
    expect(spoofed).toBe(honest)
    expect(spoofed).not.toBe(getRequestIpHash(headers({ 'x-forwarded-for': '6.6.6.6' })))
  })

  it('заголовки отсутствуют → хеш "unknown" (как и раньше)', () => {
    expect(getRequestIpHash(headers({}))).toBe(hashIp(null))
  })
})

describe('rateLimit: подстановка IP больше не растягивает окно', () => {
  const key = `ip-trust-${Date.now()}`
  const window = 60_000

  it('шесть запросов с шестью разными подставленными IP — один бакет, шестой отклонён', () => {
    const results = []
    for (let i = 0; i < 6; i += 1) {
      const request = headers({ 'x-forwarded-for': `6.6.6.${i}, 203.0.113.10` })
      results.push(rateLimit(`${key}:${clientIp(request)}`, 5, window).ok)
    }
    expect(results).toEqual([true, true, true, true, true, false])
  })
})
