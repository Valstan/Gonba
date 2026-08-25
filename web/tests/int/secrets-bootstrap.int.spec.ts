import { describe, expect, it, vi } from 'vitest'

import { ACCEPTED_SECRET_KEYS, bootstrapSecretsFromVault } from '@/server/secrets/bootstrap'

describe('vault secrets bootstrap', () => {
  it('does no network work when required local env is intact', async () => {
    const fetchImpl = vi.fn()
    const result = await bootstrapSecretsFromVault(
      { DATABASE_URL: 'local-db', PAYLOAD_SECRET: 'local-secret' },
      fetchImpl as unknown as typeof fetch,
    )

    expect(result).toEqual({ recovered: 0, ignored: 0, reason: 'local-env-intact' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('recovers allowlisted keys, preserves local values and rejects injected keys', async () => {
    const env: Record<string, string | undefined> = {
      SECRETS_TOKEN: 'bootstrap-token',
      SECRETS_VAULT_URL: 'https://vault.test/api/secrets',
      CRON_SECRET: 'systemd-wins',
    }
    const fetchImpl = vi.fn(async (_url: unknown, _init?: unknown) =>
      new Response(JSON.stringify({ secrets: {
        DATABASE_URL: 'vault-db',
        PAYLOAD_SECRET: 'vault-payload',
        CRON_SECRET: 'vault-must-not-overwrite',
        NODE_OPTIONS: '--require=/tmp/evil.js',
        SECRETS_VAULT_URL: 'https://attacker.invalid',
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const result = await bootstrapSecretsFromVault(env, fetchImpl as unknown as typeof fetch)

    expect(result).toEqual({ recovered: 2, ignored: 2, reason: 'recovered' })
    expect(env.DATABASE_URL).toBe('vault-db')
    expect(env.PAYLOAD_SECRET).toBe('vault-payload')
    expect(env.CRON_SECRET).toBe('systemd-wins')
    expect(env.NODE_OPTIONS).toBeUndefined()
    // Комната не может переписать адрес, по которому её саму спрашивают:
    // локальное значение уцелело, подсунутое — отброшено.
    expect(env.SECRETS_VAULT_URL).toBe('https://vault.test/api/secrets')
    expect(fetchImpl.mock.calls[0][0]).toBe('https://vault.test/api/secrets')
  })

  it('skips recovery loudly when the vault address is not configured', async () => {
    // Регресс: раньше здесь стоял захардкоженный адрес комнаты, и при незаданной
    // переменной bootstrap-токен молча уехал бы туда — возможно, уже не туда.
    const fetchImpl = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await bootstrapSecretsFromVault(
      { SECRETS_TOKEN: 'bootstrap-token' },
      fetchImpl as unknown as typeof fetch,
    )

    expect(result).toEqual({ recovered: 0, ignored: 0, reason: 'no-vault-url' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('keeps bootstrap configuration outside the allowlist', () => {
    expect(ACCEPTED_SECRET_KEYS).toHaveLength(12)
    expect(ACCEPTED_SECRET_KEYS).toContain('DEEPSEEK_API_KEY')
    // OPENAI_API_KEY выведен из обихода вместе с переездом классификатора (D-024):
    // allowlist обязан описывать секреты, которые мы РЕАЛЬНО используем.
    expect(ACCEPTED_SECRET_KEYS).not.toContain('OPENAI_API_KEY')
    // Соль хеша IP — runtime-секрет: без неё после recovery хеширование ПДн
    // упало бы на PAYLOAD_SECRET (см. getRequestIpHash), а не на публичный литерал.
    expect(ACCEPTED_SECRET_KEYS).toContain('IP_HASH_SALT')
    expect(ACCEPTED_SECRET_KEYS).not.toContain('SECRETS_TOKEN')
    expect(ACCEPTED_SECRET_KEYS).not.toContain('SECRETS_VAULT_URL')
  })
})
