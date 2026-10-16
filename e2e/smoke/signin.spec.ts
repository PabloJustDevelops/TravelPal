import { expect, test } from '@playwright/test'
import { hasCredentials, signIn } from '../support/flows'

test('tras iniciar sesion el dashboard se ve con contenido', async ({ page }) => {
  // En local, sin las variables, el caso se marca omitido en vez de fallar. En
  // CI el job exige los secrets antes de lanzar la suite.
  test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')

  await signIn(page)

  // El fallo de #71 dejaba la URL correcta y la pantalla en blanco: aqui se
  // exige contenido real del dashboard, no solo la ruta.
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /^Bienvenido,/ })).toBeVisible()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Tareas' }),
  ).toBeVisible()
})

test('el dashboard autenticado abre por URL directa y conserva contenido tras recargar', async ({ page }) => {
  test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')

  await signIn(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /^Bienvenido,/ })).toBeVisible()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Tareas' }),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /^Bienvenido,/ })).toBeVisible()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Tareas' }),
  ).toBeVisible()
})
