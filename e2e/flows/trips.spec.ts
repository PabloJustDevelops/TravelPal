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

test.describe('flujo de viajes', () => {
  let createdTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    acceptDialogs(page)
    await signIn(page)
  })

  // Corre aunque el test falle: el viaje no se queda en produccion.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
  })

  test('crear un viaje lo deja en la lista con sus datos', async ({ page }) => {
    const departure = new Date()
    departure.setHours(9, 0, 0, 0)

    const trip = {
      title: uniqueName('viaje'),
      origin: 'Madrid',
      destination: 'Lisboa',
      departure: toDateTimeLocal(departure),
    }
    createdTitle = trip.title

    // Alta desde el formulario; la app navega al detalle con lo ya guardado.
    await createTrip(page, trip)
    await expect(page.getByText(trip.origin, { exact: true })).toBeVisible()
    await expect(page.getByText(trip.destination, { exact: true })).toBeVisible()

    // Y en la lista, buscandolo por su titulo (no por totales: la cuenta del
    // usuario dedicado puede tener viajes de corridas anteriores).
    await page.goto('/trips')
    await page.getByPlaceholder('Buscar viajes...').fill(trip.title)

    await expect(page.getByRole('heading', { name: trip.title })).toBeVisible()
    await expect(
      page.getByText(`${trip.origin} → ${trip.destination}`, { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/^Salida:/).first()).toBeVisible()

    await expectNoCriticalA11yViolations(page, 'lista de viajes')
  })
})
