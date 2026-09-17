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

test.describe('flujo de gastos', () => {
  let createdTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    acceptDialogs(page)
    await signIn(page)
  })

  // El viaje se lleva por delante su gasto en la misma limpieza.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
  })

  test('registrar un gasto lo lista y lo suma al resumen del viaje', async ({
    page,
  }) => {
    const token = uniqueName('gastos')
    const tripTitle = `${token}-viaje`
    const expenseTitle = `${token}-cena`
    const expenseNotes = `${token}-notas`
    createdTitle = tripTitle

    const departure = new Date()
    departure.setHours(9, 0, 0, 0)
    await createTrip(page, {
      title: tripTitle,
      origin: 'Roma',
      destination: 'Nápoles',
      departure: toDateTimeLocal(departure),
    })
    const tripUrl = page.url()

    await page.goto('/expenses/new')
    await page.getByLabel('Descripción *').fill(expenseTitle)
    await page.getByLabel('Monto *').fill('42.50')
    await page.locator('select[name="trip_id"]').selectOption({ label: tripTitle })
    await page.getByPlaceholder('Añade detalles adicionales sobre este gasto...').fill(expenseNotes)
    await page.getByRole('button', { name: 'Registrar Gasto' }).click()

    // Listado: aparece la tarjeta del gasto, no solo la redireccion.
    await expect(page).toHaveURL(/\/expenses$/)
    await page
      .getByRole('textbox', { name: 'Buscar gastos y presupuestos' })
      .fill(token)
    await expect(page.getByText(expenseTitle, { exact: true })).toBeVisible()
    await expect(page.getByText(/42,50\s*€/).first()).toBeVisible()

    await expectNoCriticalA11yViolations(page, 'lista de gastos')

    // Y en el resumen del viaje, que agrega los gastos de ese `trip_id`.
    await page.goto(tripUrl)
    await expect(
      page.getByRole('heading', { name: 'Resumen del viaje' }),
    ).toBeVisible()
    await expect(page.getByText('Sin gastos ni reservas todavia')).toHaveCount(0)
    await expect(page.getByText(/42,50\s*€/).first()).toBeVisible()
  })
})
