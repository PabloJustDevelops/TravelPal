import { expect, test } from '@playwright/test'

// El email lleva el prefijo e2e- y la marca de tiempo que pide el issue 72. No se
// borra al final: InsForge no expone endpoint para eliminar usuarios y el codigo
// se queda sin completar a proposito (no hay buzon legible al que ir a por el).
const password = process.env.E2E_SIGNUP_PASSWORD ?? 'Prueba-e2e-2026!'

test('el registro llega al paso de verificacion con el email pendiente', async ({
  page,
}) => {
  const email = `e2e-signup-${Date.now()}@example.com`

  await page.goto('/signup')

  await page.getByLabel('Nombre completo').fill('E2E Smoke')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // El flag de verificacion se tiraba (#67) y el registro mandaba al dashboard
  // sin cuenta detras: lo que se exige aqui es el paso del codigo, no la URL.
  await expect(
    page.getByRole('heading', { name: 'Verifica tu email' }),
  ).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByText('Hemos enviado un código de 6 dígitos')).toBeVisible()

  // El codigo no se completa: sin los seis digitos el boton sigue bloqueado.
  await expect(page.getByRole('button', { name: 'Verificar cuenta' })).toBeDisabled()
})
