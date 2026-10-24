import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('registro tiene marca coherente y controles accesibles', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('#password').locator('..').locator('button')).toBeVisible()
  await expect(
    page.locator('#confirmPassword').locator('..').locator('button'),
  ).toBeVisible()

  const passwordToggle = page.getByRole('button', { name: 'Mostrar contraseña' })
  await expect(passwordToggle).toHaveAttribute('aria-pressed', 'false')
  await passwordToggle.click()
  const hidePasswordToggle = page.getByRole('button', { name: 'Ocultar contraseña' })
  await expect(hidePasswordToggle).toHaveAttribute('aria-pressed', 'true')
  await hidePasswordToggle.click()

  const confirmationToggle = page.getByRole('button', {
    name: 'Mostrar confirmación de contraseña',
  })
  await expect(confirmationToggle).toHaveAttribute('aria-pressed', 'false')
  await confirmationToggle.click()
  const hideConfirmationToggle = page.getByRole('button', {
    name: 'Ocultar confirmación de contraseña',
  })
  await expect(hideConfirmationToggle).toHaveAttribute('aria-pressed', 'true')
  await hideConfirmationToggle.click()

  const results = await new AxeBuilder({ page }).analyze()
  const actual = {
    title: await page.title(),
    hasMainLandmark: (await page.getByRole('main').count()) > 0,
    passwordToggleName: await page
      .locator('#password')
      .evaluate((input) => input.parentElement?.querySelector('button')?.getAttribute('aria-label') ?? null),
    confirmationToggleName: await page
      .locator('#confirmPassword')
      .evaluate((input) => input.parentElement?.querySelector('button')?.getAttribute('aria-label') ?? null),
    violations: results.violations.map(({ id, impact }) => `${id} [${impact}]`),
  }

  expect(actual).toEqual({
    title: expect.stringMatching(/TravelPal/),
    hasMainLandmark: true,
    passwordToggleName: 'Mostrar contraseña',
    confirmationToggleName: 'Mostrar confirmación de contraseña',
    violations: [],
  })
})

test('rutas públicas de autenticación no introducen violaciones axe', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const route of ['/es/', '/signin', '/forgot-password', '/reset-password']) {
    await page.goto(route)
    if (route === '/es/') {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('img', { name: /Ilustración de un viajero siguiendo/ })).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath('portada-escritorio.png'),
      })
    }
    const results = await new AxeBuilder({ page }).analyze()

    expect(
      results.violations.map(({ id, impact }) => `${route}: ${id} [${impact}]`),
      JSON.stringify(results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      }))),
    ).toEqual([])
  }
})

test('portada mantiene su composición de viaje y no desborda en móvil', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/es/')

  await expect(page.getByRole('heading', { level: 1, name: 'Tu viaje, de principio a fin.' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: /Ilustración de un viajero siguiendo/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /Ilustración de un viajero siguiendo/ })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('portada-movil.png'),
  })

  const menuButton = page.getByRole('button', { name: 'Abrir menú' })
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await menuButton.click()
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Cerrar menú' }).click()

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth)

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map(({ id, impact }) => `${id} [${impact}]`)).toEqual([])
})

test('portada conserva contraste con el tema oscuro', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/es/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('img', { name: /Ilustración de un viajero siguiendo/ })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(16, 24, 39)')

  const results = await new AxeBuilder({ page }).include('section[aria-labelledby="home-heading"]').analyze()
  expect(
    results.violations.map(({ id, impact }) => `${id} [${impact}]`),
    JSON.stringify(results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }))),
  ).toEqual([])
})
