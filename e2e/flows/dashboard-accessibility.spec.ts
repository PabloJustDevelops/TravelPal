import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hasCredentials, signIn } from '../support/flows';

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`panel y navegación ${theme} a ${width}px`, async ({ page }) => {
      test.skip(!hasCredentials, 'faltan credenciales E2E');
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await signIn(page);
      await expect(page.getByRole('heading', { name: /Bienvenido,/ })).toBeVisible();
      await page.getByText('Actividad y estadísticas', {exact:false}).click();
      await expect(page.getByLabel('Moneda:', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Rango de fechas:', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('button', { name: /Notificaciones/ }).click();
      const notificationPanel = page.getByRole('region', { name: 'Notificaciones' });
      await expect(notificationPanel).toBeVisible();
      const panelBox = await notificationPanel.boundingBox();
      expect(panelBox).not.toBeNull();
      const viewport = page.viewportSize();
      if (panelBox && viewport) {
        expect(panelBox.x).toBeGreaterThanOrEqual(0);
        expect(panelBox.y).toBeGreaterThanOrEqual(0);
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);
        expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await notificationPanel.getByRole('button', { name: 'Cerrar notificaciones' }).click();
      await expect(notificationPanel).toBeHidden();
      if (width < 1024) {
        await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
        // El nombre del enlace cambia con el idioma ("Panel" en es, "Dashboard" en en), asi que
        // se localiza por destino y no por copy.
        const current = page.locator('#mobile-menu a[href$="/dashboard"]');
        await expect(current).toHaveCount(1);
        await expect(current).toHaveAttribute('aria-current', 'page');
        await current.focus();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Abrir menú', exact: true })).toBeFocused();
      }
      await expect(page.locator('main [data-transition]')).toHaveCount(0);
      await page.screenshot({ path: `/tmp/travelpal-atlas-${theme}-${width}.png` });
      const result = await new AxeBuilder({ page }).include('nav').include('main').analyze();
      expect(result.violations).toEqual([]);
    });
  }
}
