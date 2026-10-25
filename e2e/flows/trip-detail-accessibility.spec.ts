import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deleteTrip } from '../support/cleanup';
import { acceptDialogs, createTrip, hasCredentials, signIn, toDateTimeLocal, uniqueName } from '../support/flows';

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`detalle e itinerario ${theme} a ${width}px`, async ({ page }) => {
      test.skip(!hasCredentials, 'faltan credenciales E2E');
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await signIn(page);
      acceptDialogs(page);
      const title = uniqueName(`atlas-${theme}-${width}`);
      const departure = new Date();
      departure.setDate(departure.getDate() + 2);
      departure.setHours(9, 0, 0, 0);
      try {
        await createTrip(page, { title, origin: 'Madrid', destination: 'Lisboa', departure: toDateTimeLocal(departure) });
        await expect(page.getByRole('heading', { name: 'Planificador de Itinerario' })).toBeVisible();
        await expect(page.getByText('Sin gastos ni reservas todavía')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const add = page.getByRole('button', { name: 'Agregar', exact: true }).first();
        await add.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Nueva Actividad' })).toBeVisible();
        await expect(dialog.getByLabel('Título *', { exact: true })).toBeVisible();
        const dialogAxe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
        expect(dialogAxe.violations).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(add).toBeFocused();
        await add.click();
        const activity = `${title}-paseo`;
        await dialog.getByLabel('Título *', { exact: true }).fill(activity);
        await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
        await expect(dialog).toBeHidden();
        await page.getByRole('heading', { name: /^Día 1/ }).click();
        await expect(page.getByRole('heading', { name: activity, exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Planificador de Itinerario' })).toBeVisible();
        await page.getByRole('heading', { name: /^Día 1/ }).click();
        await expect(page.getByRole('heading', { name: activity, exact: true })).toBeVisible();
        await expect(page.getByText('Sin gastos ni reservas todavía')).toBeVisible();
        const result = await new AxeBuilder({ page }).include('main').analyze();
        expect(result.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        for (const action of ['Editar', 'Eliminar']) {
          const box = await page.getByRole('button', { name: `${action} ${activity}`, exact: true }).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
        await page.screenshot({ path: `/tmp/travelpal-trip-${theme}-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: `Editar ${activity}`, exact: true }).click();
        const edited = `${activity}-editado`;
        await dialog.getByLabel('Título *', { exact: true }).fill(edited);
        await dialog.getByRole('button', { name: 'Actualizar', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible();
        await page.reload();
        await page.getByRole('heading', { name: /^Día 1/ }).click();
        await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible();
        await page.getByRole('button', { name: `Eliminar ${edited}`, exact: true }).click();
        await expect(page.getByRole('heading', { name: edited, exact: true })).toBeHidden();
        await expect(page.getByRole('heading', { name: 'Tu itinerario empieza aquí' })).toBeVisible();
      } finally {
        await deleteTrip(title);
      }
    });
  }
}
