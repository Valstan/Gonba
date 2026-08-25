import { createHash } from 'crypto'

import 'server-only'

let warnedAboutFallback = false

/**
 * Соль для необратимого хеша IP.
 *
 * Читается на каждый вызов, а не на импорте модуля: vault-recovery
 * (`instrumentation.ts`) наполняет `process.env` до старта runtime, но уже после
 * того, как модули могли бы захватить значение в константу.
 *
 * Порядок: свой `IP_HASH_SALT` → `PAYLOAD_SECRET` (обязателен на проде, см.
 * `REQUIRED` в `server/secrets/bootstrap.ts`) → ошибка.
 *
 * **Здесь принципиально нет литерала-фолбэка.** Раньше он был
 * (`'gonba-default-salt'`), и 2026-08-25 выяснилось, чем это оборачивается:
 * `IP_HASH_SALT` на проде задан не был, репозиторий с 17.08 публичный — значит
 * соль знал кто угодно, а вход у хеша это IPv4, то есть 2^32 вариантов.
 * Проверить конкретный IP против конкретного `ipHash` — одна операция хеширования.
 * `ipHash` в таких условиях не псевдонимизирует ничего, но выглядит как хеш и
 * ничем не сигналит — фолбэк, неотличимый от успеха (#179).
 */
function resolveSalt(): string {
  const explicit = process.env.IP_HASH_SALT
  if (explicit) return explicit

  const payloadSecret = process.env.PAYLOAD_SECRET
  if (payloadSecret) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true
      console.warn(
        '[ip-hash] IP_HASH_SALT не задан — хеширую на PAYLOAD_SECRET. ' +
          'Работает, но соль общая с другими механизмами; задай отдельную.',
      )
    }
    return payloadSecret
  }

  throw new Error(
    '[ip-hash] нет ни IP_HASH_SALT, ни PAYLOAD_SECRET — хешировать IP нечем. ' +
      'Публично известной соли по умолчанию здесь нет намеренно: она делала бы ' +
      'хеш обратимым перебором, не подавая никакого сигнала.',
  )
}

export function hashIp(rawIp: string | null | undefined): string {
  const salt = resolveSalt()
  const ip = (rawIp || 'unknown').trim()
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export function getRequestIpHash(headers: Headers): string {
  const raw =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    null

  return hashIp(raw)
}
