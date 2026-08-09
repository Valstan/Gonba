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

  test('redirects projects catalog to the homepage showcase', async ({ page }) => {
    const response = await page.goto('/projects')
    await expect(page).toHaveURL(/\/#projects$/)
    expect(response?.status()).toBeLessThan(400)
    await expect(page.locator('#projects')).toBeVisible()
  })

  test('can navigate from homepage showcase to a project page', async ({ page }) => {
    await page.goto('/#projects')
    // Берём первую ссылку «Войти в проект» (на плашке проекта).
    // Если на главной ещё нет ни одного активного проекта — тест пропускаем
    // (это не регресс приложения, а пустая БД, типично для CI).
    const enterLink = page.getByRole('link', { name: /Войти в проект/i }).first()
    const count = await enterLink.count()
    test.skip(count === 0, 'На главной нет активных проектов — нечего открывать')
    await enterLink.click()
    await expect(page).toHaveURL(/\/projects\/[^/]+(\/.*)?$/)
    // На странице проекта должен быть либо h1 с названием, либо табы (feed/lavka/chat/...)
    const headingOrTabs = page.locator('h1, [role="tab"]').first()
    await expect(headingOrTabs).toBeVisible({ timeout: 10000 })
  })
})
