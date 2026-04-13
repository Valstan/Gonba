import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  test.setTimeout(180000)
  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180000)
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
    await page.context().close()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin(\/)?$/)
    const dashboardArtifact = page.locator('a[href="/admin/logout"]').first()
    await expect(dashboardArtifact).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to users list', async () => {
    await page.goto('/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users$/)
    const listViewArtifact = page.locator('h1').first()
    await expect(listViewArtifact).toBeVisible({ timeout: 10000 })
    await expect(listViewArtifact).toHaveText(/Users|Пользователи/i)
  })

  test('can open yadisk cloud manager and toggle controls', async () => {
    await page.goto('/admin/yadisk')
    await expect(page).toHaveURL(/\/admin\/yadisk$/)

    await expect(page.getByRole('heading', { name: /Общая медиабиблиотека/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /Файловое облако Жемчужины|Выберите изображение из Облака/i })).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Таблица' }).click()
    await expect(page.locator('.yadisk__table')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Список' }).click()
    await expect(page.locator('.yadisk__list')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Превью' }).click()
    await expect(page.locator('.yadisk__grid')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'По имени' }).click()
    await page.getByRole('button', { name: '↑' }).click()
    await page.getByRole('button', { name: 'Пропустить' }).click()
    await page.getByRole('button', { name: 'Перезаписать' }).click()
  })

  test('can navigate to page create form', async () => {
    await page.goto('/admin/collections/pages/create')
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/(create|[a-zA-Z0-9-_]+)/)
    const editViewArtifact = page.locator('input[name="title"]')
    await expect(editViewArtifact).toBeVisible({ timeout: 10000 })
  })
})
