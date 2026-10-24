import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// QA pública: no envía formularios ni necesita un usuario o backend real.
for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const route of ['/es/', '/signin', '/signup', '/forgot-password', '/reset-password']) {
      test(`landing y acceso ${route} ${theme} ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 1024 })
        await page.addInitScript(value => localStorage.setItem('theme', value), theme)
        await page.goto(route)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByRole('main')).toHaveCount(1)
        const artwork = page.getByRole('img', { name: /Ilustración/ })
        for (const image of await artwork.all()) {
          await image.scrollIntoViewIfNeeded()
          await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        if (route === '/es/' && width === 390) {
          await page.getByRole('button', { name: 'Abrir menú' }).click()
          await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
          await page.getByRole('navigation', { name: 'Menú móvil' }).getByRole('link', { name: 'Cómo funciona' }).click()
          await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
        }
        if (route === '/es/') await page.goto('/es/')
        await page.evaluate(async () => {
          await document.fonts.ready
          document.documentElement.style.scrollBehavior = 'auto'
          window.scrollTo({ top: 0, behavior: 'instant' })
        })
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
        await page.screenshot({ path: testInfo.outputPath('viewport.png') })
        await page.screenshot({ path: testInfo.outputPath('layout.png'), fullPage: true })
      })
    }
  }
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`ejemplo navegable por teclado con movimiento ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/es/')
    await page.getByRole('link', { name: 'Ver un ejemplo' }).click()
    const arrival = page.getByRole('tab', { name: /^Llegada/ })
    await arrival.focus()
    await page.keyboard.press('End')
    await expect(page.getByRole('tab', { name: /^Alojamiento/ })).toBeFocused()
    await expect(page.getByRole('tabpanel')).toContainText('La reserva, localizada')
    await page.keyboard.press('Home')
    await expect(arrival).toHaveAttribute('aria-selected', 'true')
    if (reducedMotion === 'reduce') {
      const duration = await page.getByRole('tabpanel').evaluate(el => parseFloat(getComputedStyle(el).animationDuration))
      expect(duration).toBeLessThanOrEqual(0.001)
    }
  })
}
