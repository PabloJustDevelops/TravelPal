import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const width of [390, 1487]) {
  for (const theme of ['light', 'dark']) {
    for (const route of ['/signup', '/signin']) {
      test(`mesa ${route} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1058 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.addInitScript(value => localStorage.setItem('theme', value), theme)
        await page.goto(route)
        await page.evaluate(() => document.fonts.ready)
        const artwork = page.getByRole('img', { name: /cuaderno/, includeHidden: true })
        if (width === 390) {
          await expect(artwork).toBeHidden()
          // No segunda pantalla promocional después de las acciones del formulario.
          await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeInViewport()
        } else {
          await expect(artwork).toBeVisible()
          await expect.poll(() => artwork.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
          const image = await artwork.boundingBox()
          const form = await page.locator('form').boundingBox()
          expect(image!.x + image!.width).toBeLessThanOrEqual(form!.x)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath('viewport.png') })
        await page.screenshot({ path: testInfo.outputPath('full.png'), fullPage: true })
        // Envío vacío: validación cliente; no se envían credenciales ni correos.
        await page.getByRole('button', { name: route === '/signup' ? 'Crear cuenta' : 'Iniciar sesión', exact: true }).click()
        const email = page.getByLabel('Email', { exact: true })
        await expect(email).toHaveAttribute('aria-invalid', 'true')
        await expect(email).toHaveAccessibleDescription('Ingresa un email válido')
        const password = page.getByLabel('Contraseña', { exact: true })
        await expect(password).toHaveAttribute('aria-invalid', 'true')
        await expect(page.getByRole('alert').first()).toBeVisible()
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        await page.screenshot({ path: testInfo.outputPath('validation.png'), fullPage: true })
        const toggle = page.getByRole('button', { name: 'Mostrar contraseña', exact: true })
        const bounds = await toggle.boundingBox()
        expect(bounds!.width).toBeGreaterThanOrEqual(44)
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
        await toggle.focus()
        await expect(toggle).toBeFocused()
        await page.keyboard.press('Space')
        await expect(password).toHaveAttribute('type', 'text')
      })
    }
  }
}

for (const theme of ['light', 'dark']) {
  test(`registro valida fortaleza y confirmación ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(value => localStorage.setItem('theme', value), theme)
    await page.goto('/signup')
    await page.getByLabel('Nombre completo', { exact: true }).fill('Viajero de prueba')
    await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
    await page.getByLabel('Contraseña', { exact: true }).fill('a')
    await expect(page.getByText('Débil', { exact: true })).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.getByLabel('Contraseña', { exact: true }).fill('Password1')
    await expect(page.getByText('Fuerte', { exact: true })).toBeVisible()
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill('Password2')
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
    await expect(page.getByLabel('Confirmar contraseña', { exact: true })).toHaveAccessibleDescription('Las contraseñas no coinciden')
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('mismatch.png'), fullPage: true })
  })
}
