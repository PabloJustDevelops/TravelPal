import { expect, test } from '@playwright/test'

test('recuperación conserva el formulario y la navegación', async ({ page }) => {
  await page.goto('/es/forgot-password/')
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar enlace de recuperación' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute('href', '/es/signin')
})

test('una ruta inexistente devuelve el 404 y permite volver al idioma correspondiente', async ({ page }) => {
  const response = await page.goto('/en/a-page-that-does-not-exist/')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'It looks like the road ends here.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
