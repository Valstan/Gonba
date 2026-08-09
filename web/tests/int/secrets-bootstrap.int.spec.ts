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
      CRON_SECRET: 'systemd-wins',
    }
    const fetchImpl = vi.fn(async () =>
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
    expect(env.SECRETS_VAULT_URL).toBeUndefined()
  })

  it('keeps bootstrap configuration outside the allowlist', () => {
    expect(ACCEPTED_SECRET_KEYS).toHaveLength(11)
    expect(ACCEPTED_SECRET_KEYS).toContain('OPENAI_API_KEY')
    expect(ACCEPTED_SECRET_KEYS).not.toContain('SECRETS_TOKEN')
    expect(ACCEPTED_SECRET_KEYS).not.toContain('SECRETS_VAULT_URL')
  })
})
