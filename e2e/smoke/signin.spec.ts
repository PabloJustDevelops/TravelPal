import { expect, test } from '@playwright/test'

// Usuario dedicado y ya verificado en produccion (issue 72): la suite entra
// siempre con el, nunca crea usuarios. Las credenciales vienen del entorno.
const email = process.env.E2E_USER_EMAIL ?? ''
const password = process.env.E2E_USER_PASSWORD ?? ''
const hasCredentials = Boolean(email && password)

test('tras iniciar sesion el dashboard se ve con contenido', async ({ page }) => {
  // En local, sin las variables, el caso se marca omitido en vez de fallar. En
  // CI el job exige los secrets antes de lanzar la suite.
  test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')

  await page.goto('/signin')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // El fallo de #71 dejaba la URL correcta y la pantalla en blanco: aqui se
  // exige contenido real del dashboard, no solo la ruta.
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /^Bienvenido,/ })).toBeVisible()
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Tareas' }),
  ).toBeVisible()
})
