import path from 'node:path'
import { expect, test } from '@playwright/test'
import { deleteTrip } from '../support/cleanup'
import {
  acceptDialogs,
  createTrip,
  expectNoCriticalA11yViolations,
  hasCredentials,
  pastDateThisMonth,
  signIn,
  toDateTimeLocal,
  uniqueName,
} from '../support/flows'

const PHOTO_FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'e2e-photo.png')

test.describe('flujo de fotos del diario', () => {
  let createdTitle = ''

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
    acceptDialogs(page)
    await signIn(page)
  })

  // La limpieza quita la foto del bucket y del diario antes de borrar el viaje.
  test.afterEach(async () => {
    if (createdTitle) {
      await deleteTrip(createdTitle)
      createdTitle = ''
    }
  })

  test('subir una foto la pinta con URL firmada', async ({ page }) => {
    const token = uniqueName('diario')
    const tripTitle = `${token}-viaje`
    createdTitle = tripTitle

    // Un viaje ya pasado para que el diario este abierto.
    await createTrip(page, {
      title: tripTitle,
      origin: 'Bilbao',
      destination: 'San Sebastián',
      departure: toDateTimeLocal(pastDateThisMonth()),
    })

    // El diario solo se abre en viajes pasados: lo prueba el bloque de fotos.
    await expect(page.getByText('Todavia no hay fotos del viaje')).toBeVisible()

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Anadir foto' }).click(),
    ])
    await chooser.setFiles(PHOTO_FIXTURE)

    // La imagen se pide firmada; el hueco con role="img" del fallback no vale.
    await expect(
      page.getByRole('img', { name: 'Foto del diario', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', {
        name: 'Foto del diario no disponible',
        exact: true,
      }),
    ).toHaveCount(0)

    await expectNoCriticalA11yViolations(page, 'detalle del viaje con diario')
  })
})
