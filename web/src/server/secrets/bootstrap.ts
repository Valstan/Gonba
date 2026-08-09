const DEFAULT_VAULT_URL = 'https://831d0ce99bdf.vps.myjino.ru/api/secrets'

const REQUIRED = ['DATABASE_URL', 'PAYLOAD_SECRET'] as const

// Allowlist: новый runtime-секрет в .env.example добавлять сюда осознанно.
// SECRETS_TOKEN / SECRETS_VAULT_URL сюда не включать: vault не управляет
// bootstrap-конфигурацией собственного клиента.
export const ACCEPTED_SECRET_KEYS = [
  ...REQUIRED,
  'CRON_SECRET',
  'PREVIEW_SECRET',
  'YANDEX_DISK_TOKEN',
  'SARAFAN_GATEWAY_KEY',
  'OPENAI_API_KEY',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'UGC_IP_SALT',
  'UGC_OWNER_SALT',
] as const

const ACCEPTED = new Set<string>(ACCEPTED_SECRET_KEYS)

export type BootstrapReason = 'local-env-intact' | 'no-token' | 'recovered' | 'fetch-failed'

export async function bootstrapSecretsFromVault(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ recovered: number; ignored: number; reason: BootstrapReason }> {
  const missing = REQUIRED.filter((key) => !env[key])
  if (missing.length === 0) return { recovered: 0, ignored: 0, reason: 'local-env-intact' }

  const token = env.SECRETS_TOKEN
  if (!token) {
    console.warn(`[secrets] локальная env-копия неполна (${missing.join(', ')}), SECRETS_TOKEN не задан`)
    return { recovered: 0, ignored: 0, reason: 'no-token' }
  }

  try {
    const response = await fetchImpl(env.SECRETS_VAULT_URL ?? DEFAULT_VAULT_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`GET ${response.status}`)

    const body = (await response.json()) as { secrets?: Record<string, string> }
    const ignored: string[] = []
    let recovered = 0

    for (const [key, value] of Object.entries(body.secrets ?? {})) {
      if (!ACCEPTED.has(key)) {
        ignored.push(key)
        continue
      }
      if (env[key] !== undefined) continue
      env[key] = String(value)
      recovered += 1
    }

    if (ignored.length > 0) console.warn(`[secrets] вне allowlist, проигнорированы: ${ignored.join(', ')}`)
    console.warn(`[secrets] восстановлено из vault: ${recovered}`)
    return { recovered, ignored: ignored.length, reason: 'recovered' }
  } catch (error) {
    console.error(`[secrets] восстановление не удалось: ${(error as Error).message}`)
    return { recovered: 0, ignored: 0, reason: 'fetch-failed' }
  }
}
