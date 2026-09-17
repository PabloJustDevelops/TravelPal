import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Usuario dedicado de e2e (issue 72). La suite nunca crea usuarios: entra
// siempre con el mismo y las credenciales vienen del entorno, como en el smoke.
export const email = process.env.E2E_USER_EMAIL ?? ''
export const password = process.env.E2E_USER_PASSWORD ?? ''
export const hasCredentials = Boolean(email && password)

// Todo registro que crea un test lleva este prefijo y la marca de tiempo, para
// poder distinguir lo propio de lo que ya vivia en la cuenta del usuario.
export function uniqueName(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}`
}

// Los `confirm()` de la app (borrados) se auto-descartan si nadie los atiende:
// con esto el test los acepta y el borrado sigue.
export function acceptDialogs(page: Page): void {
  page.on('dialog', (dialog) => dialog.accept())
}

export async function signIn(page: Page): Promise<void> {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

// `datetime-local` espera la fecha en local sin zona: 'YYYY-MM-DDTHH:mm'.
export function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

// Una fecha de este mes y ya pasada, para que el viaje tenga el diario abierto
// (isPast) sin salirse de la pagina del calendario, que es de donde se borra.
export function pastDateThisMonth(): Date {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return yesterday >= firstOfMonth ? yesterday : firstOfMonth
}

export interface TripFixture {
  title: string
  origin: string
  destination: string
  departure: string
}

// Crea el viaje desde /trips/new. Al guardar la app navega al detalle, asi que
// el propio test comprueba que el alta llego a persistir y a pintarse.
export async function createTrip(page: Page, trip: TripFixture): Promise<void> {
  await page.goto('/trips/new')
  await page.getByLabel('Título del Viaje *').fill(trip.title)
  await page.getByLabel('Origen *').fill(trip.origin)
  await page.getByLabel('Destino *').fill(trip.destination)
  await page.getByLabel('Fecha de Salida *').fill(trip.departure)
  await page.getByRole('button', { name: 'Crear Viaje' }).click()
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: trip.title })).toBeVisible()
}

// Accesibilidad de la pantalla que toca el flujo. Solo bloquean las violaciones
// `critical` y `serious`: el resto se deja tal cual, sin silenciar reglas.
export async function expectNoCriticalA11yViolations(
  page: Page,
  screen: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )

  expect(
    blocking.map((violation) => {
      const targets = violation.nodes
        .map((node) => JSON.stringify(node.target))
        .join(', ')
      return `${screen}: ${violation.id} [${violation.impact}] ${violation.help} -> ${targets}`
    }),
  ).toEqual([])
}
