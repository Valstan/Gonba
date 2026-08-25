import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Регресс на находку 2026-08-25: в `getRequestIpHash` стоял литерал-фолбэк
 * `'gonba-default-salt'`, а `IP_HASH_SALT` на проде задан не был. Репозиторий
 * публичный → соль знал кто угодно, вход у хеша — IPv4 (2^32), то есть `ipHash`
 * обращался перебором и ничего не псевдонимизировал, при этом выглядел как хеш
 * и ничем не сигналил (#179).
 *
 * Модуль читает env на каждый вызов, поэтому импортируем его заново под каждый
 * набор переменных — иначе значение застряло бы в кэше модуля.
 */
async function freshModule() {
  vi.resetModules()
  return import('@/utilities/getRequestIpHash')
}

// Восстанавливаем ТОЛЬКО свои ключи. Присваивание `process.env = {...}` целиком
// подменило бы объект на обычный — Node теряет его особую семантику, и соседние
// тестовые файлы в общем прогоне падают на своих же `delete process.env.X`.
const TOUCHED = ['IP_HASH_SALT', 'PAYLOAD_SECRET'] as const
const original = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of TOUCHED) {
    original.set(key, process.env[key])
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of TOUCHED) {
    const value = original.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  original.clear()
})

describe('hashIp — соль', () => {
  it('без IP_HASH_SALT и PAYLOAD_SECRET бросает, а не хеширует известной солью', async () => {
    const { hashIp } = await freshModule()
    expect(() => hashIp('203.0.113.7')).toThrowError(/IP_HASH_SALT/)
  })

  it('не использует прежний публичный литерал ни при каких env', async () => {
    process.env.PAYLOAD_SECRET = 'payload-secret-for-test'
    const { hashIp } = await freshModule()

    const { createHash } = await import('crypto')
    const leaked = createHash('sha256')
      .update('gonba-default-salt:203.0.113.7')
      .digest('hex')
      .slice(0, 32)

    expect(hashIp('203.0.113.7')).not.toBe(leaked)
  })

  it('IP_HASH_SALT сильнее PAYLOAD_SECRET', async () => {
    process.env.PAYLOAD_SECRET = 'payload-secret-for-test'
    process.env.IP_HASH_SALT = 'dedicated-salt'
    const { hashIp } = await freshModule()
    const withDedicated = hashIp('203.0.113.7')

    delete process.env.IP_HASH_SALT
    const { hashIp: hashIpFallback } = await freshModule()

    expect(withDedicated).not.toBe(hashIpFallback('203.0.113.7'))
  })

  it('падает на PAYLOAD_SECRET с предупреждением, но продолжает работать', async () => {
    process.env.PAYLOAD_SECRET = 'payload-secret-for-test'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { hashIp } = await freshModule()
    const first = hashIp('203.0.113.7')

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(warn).toHaveBeenCalledTimes(1)

    // предупреждение одноразовое — не засоряем лог на каждый запрос
    hashIp('203.0.113.8')
    expect(warn).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })

  it('детерминирован при одной соли и различает разные IP', async () => {
    process.env.IP_HASH_SALT = 'dedicated-salt'
    const { hashIp } = await freshModule()

    expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'))
    expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'))
  })
})

describe('getRequestIpHash — источник IP', () => {
  it('берёт первый адрес из x-forwarded-for, иначе x-real-ip', async () => {
    process.env.IP_HASH_SALT = 'dedicated-salt'
    const { getRequestIpHash, hashIp } = await freshModule()

    const forwarded = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })
    expect(getRequestIpHash(forwarded)).toBe(hashIp('203.0.113.7'))

    const real = new Headers({ 'x-real-ip': '203.0.113.9' })
    expect(getRequestIpHash(real)).toBe(hashIp('203.0.113.9'))

    // без заголовков — стабильное значение для 'unknown', не исключение
    expect(getRequestIpHash(new Headers())).toBe(hashIp(null))
  })
})
