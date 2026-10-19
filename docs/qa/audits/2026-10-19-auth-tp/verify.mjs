import fs from 'node:fs'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
;(async () => {
  const dir = 'docs/qa/audits/2026-10-19-auth-tp'
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  let count = 0
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
    await context.addInitScript(value => localStorage.setItem('theme', value), theme)
    // Fixture explícita: visitante sin sesión, sin tráfico al backend real.
    await context.route('https://example.invalid/**', route => route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 401,
      headers: {
        'access-control-allow-origin': 'http://localhost:3010',
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': route.request().headers()['access-control-request-headers'] || '*',
      },
      contentType: 'application/json',
      body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify({ message: 'No session', statusCode: 401 }),
    }))
    const page = await context.newPage()
    for (const route of ['signin', 'signup', 'forgot-password', 'reset-password']) {
      await page.goto('http://localhost:3010/' + route)
      await page.evaluate(() => document.fonts.ready)
      const brand = page.getByRole('link', { name: 'TravelPal', exact: true })
      await expect(brand).toBeVisible()
      await expect(brand).toHaveAttribute('href', '/')
      const mark = brand.locator('span')
      const colors = await mark.evaluate(el => ({ mask: getComputedStyle(el).maskImage, fill: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el.parentElement).color }))
      if (!colors.mask.includes('/brand/travelpal-mark.svg') || colors.fill !== colors.ink) throw Error(JSON.stringify(colors))
      const response = await page.request.get('http://localhost:3010/brand/travelpal-mark.svg')
      expect(response.status()).toBe(200)
      expect((await new AxeBuilder({ page }).include('a[href="/"]').analyze()).violations).toEqual([])
      await brand.focus()
      await expect(brand).toBeFocused()
      if (route === 'signup') {
        await page.screenshot({ path: `${dir}/${route}-${theme}-${width}.png`, fullPage: false })
        await brand.screenshot({ path: `${dir}/brand-${theme}-${width}.png` })
      }
      count++
    }
    await context.close()
  }
  await browser.close()
  console.log(`${count} auth route/theme/viewport checks passed; logo HTTP 200; currentColor, accessible home link, focus and scoped axe passed`)
})().catch(err => { console.error(err); process.exit(1) })
