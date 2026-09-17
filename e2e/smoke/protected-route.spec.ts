import { expect, test } from '@playwright/test'

test('una ruta protegida sin sesion acaba en el formulario de acceso', async ({
  page,
}) => {
  await page.goto('/dashboard')

  // Sin bucle y sin pantalla vacia: la URL se queda en /signin y el formulario
  // esta en pantalla, en vez de rebotar contra el middleware (#71).
  await expect(page).toHaveURL(/\/signin/)
  await expect(
    page.getByRole('heading', { name: 'Inicia sesión en tu cuenta' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()

  // El destino que se pedia se conserva para volver a el tras acceder.
  await expect(page).toHaveURL(/redirectTo=%2Fdashboard/)
})
