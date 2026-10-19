import { expect, test, type Page } from '@playwright/test'
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

// El planificador no tiene boton de guardar: cada alta escribe su fila al
// momento. Para ver una actividad hay que elegir el viaje y expandir su dia,
// que arranca colapsado; se repite la navegacion entera tras recargar.
async function openTripItinerary(page: Page, tripTitle: string): Promise<void> {
  await page.goto('/planning')
  await page.getByRole('button', { name: 'Itinerario' }).click()
  const tripId = await page.locator('#planning-trip option').filter({hasText:tripTitle}).getAttribute('value')
  await page.getByLabel('Viaje para planificar').selectOption(tripId!)
  await expect(
    page.getByRole('combobox', { name: 'Viaje para planificar' }),
  ).toBeVisible()
}

async function expandFirstDay(page: Page): Promise<void> {
  await page.getByRole('heading', { name: /^Día 1/ }).click()
}

test.describe('flujo de planning', () => {
  let createdTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    acceptDialogs(page)
    await signIn(page)
  })

  // El viaje se lleva por delante sus actividades en la misma limpieza.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
  })

  test('una actividad del itinerario persiste tras recargar', async ({ page }) => {
    const token = uniqueName('planning')
    const tripTitle = `${token}-viaje`
    const activityTitle = `${token}-actividad`
    createdTitle = tripTitle

    const departure = new Date()
    departure.setHours(9, 0, 0, 0)
    await createTrip(page, {
      title: tripTitle,
      origin: 'Oporto',
      destination: 'Braga',
      departure: toDateTimeLocal(departure),
    })

    await openTripItinerary(page, tripTitle)

    // Alta: el boton del dia abre el modal y el modal escribe la fila.
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Nueva Actividad' }),
    ).toBeVisible()
    await page.getByPlaceholder('Nombre de la actividad').fill(activityTitle)
    // El boton del dia y el del modal se llaman igual: se limita al modal.
    await page
      .locator('div.fixed')
      .filter({ hasText: 'Nueva Actividad' })
      .getByRole('button', { name: 'Agregar', exact: true })
      .click()

    await expandFirstDay(page)
    await expect(page.getByRole('heading', { name: activityTitle })).toBeVisible()

    await expectNoCriticalA11yViolations(page, 'planificador de itinerario')

    // Y sigue ahi tras recargar: se vuelve a leer de la base, no de estado local.
    await page.reload()
    await openTripItinerary(page, tripTitle)
    await expandFirstDay(page)
    await expect(page.getByRole('heading', { name: activityTitle })).toBeVisible()
    await page.getByRole('button',{name:'Agregar',exact:true}).click()
    await page.getByPlaceholder('Nombre de la actividad').fill(`${activityTitle}-segundo`)
    await page.getByRole('dialog').getByRole('button',{name:'Agregar',exact:true}).click()
    await expect(page.getByRole('heading',{name:`${activityTitle}-segundo`,exact:true})).toBeVisible()
    const reorder=page.waitForResponse(response=>response.request().method()==='PATCH'&&response.url().includes('/itinerary_activities'))
    await page.getByRole('button',{name:`Bajar ${activityTitle}`,exact:true}).click()
    expect((await reorder).ok()).toBe(true)
    await expect(page.getByRole('button',{name:`Subir ${activityTitle}`,exact:true})).toBeEnabled()
    await page.reload()
    await openTripItinerary(page,tripTitle)
    const headings=await page.locator('h4').allTextContents()
    expect(headings.indexOf(`${activityTitle}-segundo`)).toBeLessThan(headings.indexOf(activityTitle))
  })
})
