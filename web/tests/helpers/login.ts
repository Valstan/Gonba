import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 */
export async function login({
  page,
  serverURL = 'http://localhost:3100',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`, { waitUntil: 'networkidle' })

  const dashboardArtifact = page.locator('a[href="/admin/logout"]').first()
  const emailField = page
    .locator('input[name="email"], input#email, input[type="email"], #field-email input')
    .first()
  const passwordField = page
    .locator('input[name="password"], input#password, input[type="password"], #field-password input')
    .first()

  const initialState = await Promise.race<'dashboard' | 'login' | 'unknown'>([
    dashboardArtifact
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => 'dashboard' as const)
      .catch(() => 'unknown' as const),
    emailField
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => 'login' as const)
      .catch(() => 'unknown' as const),
  ])

  if (initialState === 'dashboard') {
    return
  }

  const apiResponse = await page.request
    .post(`${serverURL}/api/users/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    })
    .catch(() => null)

  if (apiResponse && apiResponse.ok()) {
    const setCookie = apiResponse.headers()['set-cookie']
    if (setCookie) {
      const match = setCookie.match(/^([^=]+)=([^;]+)/)
      if (match) {
        await page.context().addCookies([
          {
            name: match[1],
            value: match[2],
            url: serverURL,
          },
        ])
        await page.goto(`${serverURL}/admin`, { waitUntil: 'networkidle' })
        if (await dashboardArtifact.first().isVisible().catch(() => false)) {
          return
        }
      }
    }
  }

  await expect(emailField).toBeVisible({ timeout: 180000 })
  await emailField.fill(user.email)
  await passwordField.fill(user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${serverURL}/admin`, { timeout: 180000 })

  await expect(dashboardArtifact).toBeVisible()
}
