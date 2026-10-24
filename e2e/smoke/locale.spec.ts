import { expect, test } from '@playwright/test'

test('English browser preference opens English and an explicit choice persists', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'en-US' })
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US', 'en'] })
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(page.getByRole('heading', { name: 'Your trip, from start to finish.' })).toBeVisible()
  const selector = page.getByRole('combobox', { name: 'Select language' })
  await selector.selectOption('es')
  await expect(page).toHaveURL(/\/es\/?$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/es\/?$/)
  await page.reload()
  await expect(page).toHaveURL(/\/es\/?$/)
  await expect(page.getByRole('heading', { name: 'Tu viaje, de principio a fin.' })).toBeVisible()
})

test('a direct Spanish locale link loads the localized landing page', async ({ page }) => {
  await page.goto('/es/')
  await expect(page.getByRole('heading', { name: 'Tu viaje, de principio a fin.' })).toBeVisible()
})
