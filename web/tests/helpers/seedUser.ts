import type { User } from '../../src/payload-types'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  roles: ['admin'] as User['roles'],
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100'
const secret = process.env.E2E_TEST_SECRET || 'local-e2e-secret'

const callSeedEndpoint = async (method: 'POST' | 'DELETE') => {
  let lastError: string | null = null

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/api/test/e2e-user`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-secret': secret,
        },
        body: JSON.stringify(testUser),
      })

      if (!response.ok) {
        const text = await response.text()
        lastError = `E2E seed endpoint failed (${response.status}): ${text}`
      } else {
        return
      }
    } catch (error) {
      lastError = (error as Error).message
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
  }

  throw new Error(lastError || 'E2E seed endpoint failed')
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  await callSeedEndpoint('POST')
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  await callSeedEndpoint('DELETE')
}
