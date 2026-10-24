import { expect, test } from '@playwright/test'

test('un enlace de recuperación expirado muestra el error y permite volver al acceso', async ({ page }) => {
  await page.goto('/reset-password?insforge_status=error&insforge_error=otp_expired')

  await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible()
  await expect(page.getByText('otp_expired', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver al inicio de sesión' })).toBeVisible()
})

test('el estado ready de un enlace de recuperación muestra el formulario de nueva contraseña', async ({ page }) => {
  await page.goto('/reset-password?token=e2e-placeholder&insforge_status=ready')

  await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible()
  await expect(page.getByLabel('Nueva contraseña')).toBeVisible()
  await expect(page.getByLabel('Confirmar contraseña')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actualizar contraseña' })).toBeEnabled()
})

test('la denegación OAuth vuelve al acceso con un mensaje de fallo observable', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=e2e-denial')

  await expect(page).toHaveURL(/\/es\/signin(?:\?|$)/)
  await expect(page.getByRole('heading', { name: 'Inicia sesión en tu cuenta' })).toBeVisible()
  await expect(
    page.getByText('No se pudo iniciar sesión con Google. Inténtalo de nuevo.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('e2e-denial', { exact: true })).toHaveCount(0)
})
