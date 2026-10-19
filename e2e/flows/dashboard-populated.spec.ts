import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  createDashboardFixture,
  dashboardFixtureDates,
  deleteDashboardFixture,
} from '../support/cleanup'
import {
  createTrip,
  hasCredentials,
  signIn,
} from '../support/flows'

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`dashboard poblado ${theme} a ${width}px`, async ({ page }) => {
      test.skip(!hasCredentials, 'faltan credenciales E2E')
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(value => localStorage.setItem('theme', value), theme)
      await signIn(page)

      const token = `${width}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`
      const fixture = {
        tripTitle: `Lisboa QA ${token}`,
        activityTitle: `Paseo en Lisboa ${token}`,
        taskTitle: `Preparar documentos ${token}`,
        budgetName: `Presupuesto ${token}`,
      }
      const { departure, returnDate } = await dashboardFixtureDates()
      const date = departure.slice(0, 10)

      try {
        await createTrip(page, {
          title: fixture.tripTitle,
          origin: 'Madrid',
          destination: 'Lisboa',
          departure,
          returnDate,
        })
        await createDashboardFixture({ ...fixture, date })

        await page.goto('/dashboard')
        await expect(page.getByRole('heading', { name: fixture.tripTitle })).toBeVisible()
        await expect(page.getByText(fixture.activityTitle, { exact: true })).toBeVisible()
        await expect(page.getByText(fixture.taskTitle, { exact: true })).toBeVisible()
        const budget = page.getByRole('region', { name: 'Presupuesto del viaje' })
        await expect(budget).toContainText(fixture.budgetName)
        await expect(budget).toContainText(/83,50\s*€\s*de\s*500,00\s*€/)
        await expect(budget.getByRole('progressbar', { name: `Uso del presupuesto ${fixture.budgetName}` }))
          .toHaveAttribute('aria-valuenow', '17')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

        await page.getByText('Actividad y estadísticas', {exact:false}).click()
        const charts = page.getByTestId('trip-chart')
        await expect(charts).toHaveCount(2)
        const chartHeights = await charts.evaluateAll(elements =>
          elements.map(element => Math.round(element.getBoundingClientRect().height)),
        )
        if (width === 390) {
          expect(Math.max(...chartHeights)).toBeLessThanOrEqual(260)
        } else {
          expect(chartHeights).toEqual([350, 300])
        }

        const result = await new AxeBuilder({ page }).include('nav').include('main').analyze()
        expect(result.violations).toEqual([])
        await page.screenshot({ path: `/tmp/travelpal-atlas-populated-${theme}-${width}.png` })
        if (width === 390) {
          await page.screenshot({
            path: `/tmp/travelpal-atlas-populated-${theme}-${width}-full.png`,
            fullPage: true,
          })
        }
      } finally {
        await deleteDashboardFixture(fixture.tripTitle, fixture.taskTitle)
      }
    })
  }
}
