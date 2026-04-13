import { test, expect, Page } from '@playwright/test'

test.describe('Frontend', () => {
  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000)
    const context = await browser.newContext()
    page = await context.newPage()
  })

  test('can load homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ГОНЬБА|Жемчужина Вятки/i)
    const heading = page.locator('h1').first()
    await expect(heading).not.toHaveText('')
  })

  test('can load posts archive page', async ({ page }) => {
    await page.goto('/posts')
    await expect(page).toHaveURL(/\/posts$/)
    await expect(page.locator('h1').first()).toContainText(/Посты/i)
  })

  test('can load paginated posts route', async ({ page }) => {
    await page.goto('/posts/page/1')
    await expect(page).toHaveURL(/\/posts\/page\/1$/)
    await expect(page.locator('h1').first()).toContainText(/Посты/i)
  })

  test('can load search page', async ({ page }) => {
    await page.goto('/search')
    await expect(page).toHaveURL(/\/search$/)
    await expect(page.locator('h1').first()).toContainText(/Поиск/i)
    await expect(page.locator('input#search, input[placeholder="Поиск"]').first()).toBeVisible()
  })
})
