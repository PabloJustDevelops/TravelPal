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
      const noteEditor = page.getByRole('region', { name: 'Editor de nota' })
      await expect(noteEditor.getByLabel('Contenido *', { exact: true })).toBeVisible()
      await expect(noteEditor.getByRole('group', { name: 'Categoría *' })).toBeVisible()
      await noteEditor.getByLabel('Categoría de la nota').selectOption('itinerary')
      await expect(noteEditor.getByLabel('Categoría de la nota')).toHaveValue('itinerary')
      await expect(noteEditor.getByRole('status')).toHaveText('Cambios sin guardar')
      const noteResults = await new AxeBuilder({ page }).include('main').analyze()
      expect(noteResults.violations).toEqual([])
      page.once('dialog', dialog=>dialog.dismiss())
      await noteEditor.getByRole('button', { name: width === 390 ? 'Cerrar editor de nota' : 'Cancelar' }).click()
      await expect(noteEditor).toBeVisible()
      page.once('dialog', dialog=>dialog.accept())
      await noteEditor.getByRole('button', { name: width === 390 ? 'Cerrar editor de nota' : 'Cancelar' }).click()
      if (width === 390) await expect(noteEditor).not.toBeVisible()

    })
  }
}
