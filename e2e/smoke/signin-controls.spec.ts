import { expect, test } from '@playwright/test'
import { fillSignInForm } from '../support/flows'

test('rellena el acceso sin confundir el campo con el control de visibilidad', async ({ page }) => {
  await page.goto('/signin')
  const showPassword = page.getByRole('button', { name: 'Mostrar contraseña', exact: true })
  await expect(showPassword).toBeVisible()

  // Datos sintéticos: no se envía el formulario ni se crea una sesión.
  await fillSignInForm(page, 'qa@example.invalid', 'qa-placeholder')
  const passwordField = page.getByLabel('Contraseña', { exact: true })
  await expect(passwordField).toHaveValue('qa-placeholder')
  await expect(passwordField).toHaveAttribute('type', 'password')

  await showPassword.click()
  await expect(passwordField).toHaveAttribute('type', 'text')
  const hidePassword = page.getByRole('button', { name: 'Ocultar contraseña', exact: true })
  await expect(hidePassword).toHaveAttribute('aria-pressed', 'true')
  await hidePassword.click()
  await expect(passwordField).toHaveAttribute('type', 'password')
  await expect(showPassword).toHaveAttribute('aria-pressed', 'false')
})
