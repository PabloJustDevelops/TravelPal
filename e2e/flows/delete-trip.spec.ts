import { expect, test } from '@playwright/test'
import { createExpense, deleteExpense, deleteTrip } from '../support/cleanup'
import {
  createTrip,
  expectNoCriticalA11yViolations,
  hasCredentials,
  signIn,
  toDateTimeLocal,
  uniqueName,
} from '../support/flows'

test.describe('flujo de borrado de viajes', () => {
  let createdTitle = ''
  let createdExpenseTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    await signIn(page)
  })

  // Red de seguridad por si el borrado por UI no llegara a completarse: ni el
  // viaje ni su gasto se quedan en produccion.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
    if (createdExpenseTitle) {
      await deleteExpense(createdExpenseTitle)
      createdExpenseTitle = ''
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

    // El borrado se dispara desde el detalle, que es donde deja el alta.
    await page.getByRole('link', { name: 'Ver detalles' }).click()
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/)
    await page
      .getByRole('button', { name: `Eliminar el viaje ${title}` })
      .click()

    // El dialogo carga el impacto antes de dejar confirmar.
    const confirmar = page.getByRole('button', { name: 'Eliminar viaje' })
    await expect(confirmar).toBeEnabled()
    await confirmar.click()

    // Vuelve a la lista y el viaje ya no esta: buscarlo no devuelve su tarjeta.
    await expect(page).toHaveURL(/\/trips\/?$/)
    await page.getByPlaceholder('Buscar viajes...').fill(title)
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
    await expect(page.getByText('No tienes viajes registrados')).toBeVisible()
  })

  test('borrar el viaje deja el gasto huerfano sin viaje', async ({ page }) => {
    const departure = new Date()
    departure.setHours(9, 0, 0, 0)

    const title = uniqueName('huerfano')
    const expenseTitle = uniqueName('gasto')
    createdTitle = title
    createdExpenseTitle = expenseTitle

    await createTrip(page, {
      title,
      origin: 'Bilbao',
      destination: 'Oporto',
      departure: toDateTimeLocal(departure),
    })
    await createExpense({
      title: expenseTitle,
      amount: 42.5,
      category: 'food',
      tripTitle: title,
    })

    await page.goto('/trips')
    await page.getByPlaceholder('Buscar viajes...').fill(title)
    await page.getByRole('link', { name: 'Ver detalles' }).click()
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/)
    await page
      .getByRole('button', { name: `Eliminar el viaje ${title}` })
      .click()

    // El viaje tiene gastos, asi que aparecen los radios: con la opcion por
    // defecto el gasto se conserva y se queda sin viaje.
    const confirmar = page.getByRole('button', { name: 'Eliminar viaje' })
    await expect(confirmar).toBeEnabled()
    await expect(
      page.getByRole('radio', { name: 'Conservarlos sin viaje' }),
    ).toBeChecked()
    await confirmar.click()

    await expect(page).toHaveURL(/\/trips\/?$/)

    // El gasto sigue en la lista de gastos, ya sin viaje asociado.
    await page.goto('/expenses')
    await expect(page.getByText(expenseTitle, { exact: true })).toBeVisible()
  })
})
