import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { hasCredentials, signIn } from '../support/flows'

// Abrir y cerrar formularios no crea datos ni deja registros de QA en el backend.
for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`formularios accesibles ${theme} a ${width}px`, async ({ page }) => {
      test.skip(!hasCredentials, 'faltan E2E_USER_EMAIL y E2E_USER_PASSWORD')
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(value => localStorage.setItem('theme', value), theme)
      await signIn(page)

      await page.goto('/tasks')
      await page.getByRole('button', { name: 'Nueva Tarea' }).click()
      const taskDialog = page.getByRole('dialog', { name: 'Nueva Tarea' })
      for (const label of ['Título', 'Descripción', 'Estado', 'Prioridad', 'Fecha Límite']) {
        await expect(taskDialog.getByLabel(label, { exact: true })).toBeVisible()
      }
      await taskDialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(taskDialog.getByLabel('Título', { exact: true })).toHaveAttribute('aria-invalid', 'true')
      await expect(page.locator('[role="dialog"] [data-transition]')).toHaveCount(0)
      const taskResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(taskResults.violations).toEqual([])
      await page.keyboard.press('Escape')
      await expect(taskDialog).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Nueva Tarea' })).toBeFocused()

      await page.goto('/notes')
      await page.getByRole('button', { name: 'Nueva Nota', exact: true }).click()
      const noteDialog = page.getByRole('dialog', { name: 'Nueva Nota' })
      await expect(noteDialog.getByLabel('Contenido *', { exact: true })).toBeVisible()
      await expect(noteDialog.getByRole('group', { name: 'Categoría *' })).toBeVisible()
      await noteDialog.getByRole('radio', { name: 'General', exact: true }).focus()
      await page.keyboard.press('ArrowRight')
      await expect(noteDialog.getByRole('radio', { name: 'Itinerario', exact: true })).toBeChecked()
      await expect(page.locator('[role="dialog"] [data-transition]')).toHaveCount(0)
      const noteResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(noteResults.violations).toEqual([])
      await noteDialog.getByRole('button', { name: 'Cerrar editor de nota' }).click()
      await expect(noteDialog).not.toBeVisible()
    })
  }
}
