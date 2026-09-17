import { expect, test } from '@playwright/test'
import { deleteTrip } from '../support/cleanup'
import {
  acceptDialogs,
  createTrip,
  expectNoCriticalA11yViolations,
  hasCredentials,
  signIn,
  toDateTimeLocal,
  uniqueName,
} from '../support/flows'

test.describe('flujo de borrado de viajes', () => {
  let createdTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    acceptDialogs(page)
    await signIn(page)
  })

  // Red de seguridad por si el borrado por UI no llegara a completarse: el viaje
  // no se queda en produccion.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
  })

  test('borrar un viaje por la UI lo quita de la lista', async ({ page }) => {
    const departure = new Date()
    departure.setHours(9, 0, 0, 0)

    const title = uniqueName('borrado')
    createdTitle = title

    await createTrip(page, {
      title,
      origin: 'Sevilla',
      destination: 'Granada',
      departure: toDateTimeLocal(departure),
    })

    // Antes de borrar, la tarjeta esta en la lista con su accion de borrado.
    await page.goto('/trips')
    await page.getByPlaceholder('Buscar viajes...').fill(title)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await expectNoCriticalA11yViolations(page, 'lista de viajes')

    // El borrado se dispara desde el detalle, que es donde deja el alta; el
    // dialogo de confirmacion lo acepta `acceptDialogs`.
    await page.getByRole('link', { name: 'Ver detalles' }).click()
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/)
    await page
      .getByRole('button', { name: `Eliminar el viaje ${title}` })
      .click()

    // Vuelve a la lista y el viaje ya no esta: buscarlo no devuelve su tarjeta.
    await expect(page).toHaveURL(/\/trips\/?$/)
    await page.getByPlaceholder('Buscar viajes...').fill(title)
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
    await expect(page.getByText('No tienes viajes registrados')).toBeVisible()
  })
})
