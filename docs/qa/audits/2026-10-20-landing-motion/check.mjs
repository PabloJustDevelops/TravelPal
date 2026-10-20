// Ejecutar desde la raíz con el export ya servido por `pnpm run preview --port 4173`.
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import assert from 'node:assert/strict';
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
const dir = 'docs/qa/audits/2026-10-20-landing-motion';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('main footer').count(), 0);
      await page.getByRole('contentinfo').waitFor();
      for (const section of await page.locator('section,footer').all()) await section.scrollIntoViewIfNeeded();
      const result = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(result.violations, []);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        links: [...document.querySelectorAll('header a,footer a')].filter(a => a.getBoundingClientRect().width > 0).map(a => ({ text: a.textContent, height: a.getBoundingClientRect().height })),
        motion: [...document.querySelectorAll('main section,footer a,main img')].map(e => ({ animation: getComputedStyle(e).animationName, transition: getComputedStyle(e).transitionDuration })),
      }));
      assert.equal(metrics.overflow, false);
      assert.ok(metrics.links.every(a => a.height >= 44));
      assert.ok(metrics.motion.every(e => e.animation === 'none' && e.transition === '0s'));
      console.log(JSON.stringify({ width, colorScheme, axeViolations: result.violations.length, overflow: metrics.overflow, minimumLinkHeight: Math.min(...metrics.links.map(a => a.height)), reducedMotion: 'none' }));
      // El foco se alcanza con teclado, no solo con la pseudoclase forzada.
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      await context.close();
    }

    for (const javaScriptEnabled of [true, false]) for (const width of [1024, 1100, 1200, 1280, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', javaScriptEnabled });
      const page = await context.newPage();
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      const grid = await page.locator('#features').evaluate(section => {
        const text = section.firstElementChild;
        const frame = section.lastElementChild;
        return {
          columns: getComputedStyle(section).gridTemplateColumns,
          textHeight: text.getBoundingClientRect().height,
          sectionHeight: section.getBoundingClientRect().height,
          imageHeight: frame.getBoundingClientRect().height,
          imageRight: frame.getBoundingClientRect().right,
          sectionRight: section.getBoundingClientRect().right,
          textBottom: text.querySelector('dl').getBoundingClientRect().bottom,
          sectionBottom: section.getBoundingClientRect().bottom,
        };
      });
      console.log(JSON.stringify({ width, javaScriptEnabled, grid }));
      assert.ok(Math.abs(grid.imageHeight - grid.sectionHeight) <= 1, 'La imagen debe cubrir toda la fila de escritorio');
      assert.ok(grid.textHeight <= grid.sectionHeight + 1, 'Features no debe recortar la columna de texto');
      assert.ok(grid.textBottom <= grid.sectionBottom + 1, 'La última descripción debe permanecer dentro de Features');
      assert.ok(grid.imageRight <= grid.sectionRight + 1, 'La imagen no debe desbordar su columna');
      await context.close();
    }

    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.addInitScript(() => {
        window.qaCLS = 0;
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.qaCLS += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.route('**/images/atlas/*.webp', async route => { await held; await route.continue(); });
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('img[data-loading="true"]').length === 2);
      await page.evaluate(() => document.fonts.ready);
      const rectangles = () => page.locator('main img').evaluateAll(images => images.map(i => {
        const { x, y, width, height } = i.parentElement.getBoundingClientRect();
        return { x: x + scrollX, y: y + scrollY, width, height };
      }));
      const before = await rectangles();
      assert.ok(before.every(r => r.width > 0 && r.height > 0));
      assert.equal(await page.getByRole('heading', { level: 1 }).isVisible(), true);
      await page.screenshot({ path: `${dir}/skeleton-${width}-light.png`, fullPage: true });
      release();
      for (const section of await page.locator('section').all()) await section.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0 && i.dataset.loading !== 'true'));
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      assert.deepEqual(await rectangles(), before);
      const behavior = await page.evaluate(() => ({
        cls: window.qaCLS,
        reveal: [...document.querySelectorAll('main section')].map(e => getComputedStyle(e).animationName),
        images: [...document.querySelectorAll('main img')].map(i => ({ loading: i.loading, state: i.dataset.loading })),
        preloadCount: document.querySelectorAll('link[rel="preload"][as="image"]').length,
      }));
      assert.equal(behavior.cls, 0);
      assert.ok(behavior.reveal.slice(1).some(name => name.includes('section-arrival')));
      assert.equal(behavior.reveal[0], 'none');
      assert.equal(behavior.images[1].loading, 'lazy');
      assert.equal(behavior.preloadCount, 1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => [...document.querySelectorAll('main section')].every(e => getComputedStyle(e).animationName === 'none'));
      console.log(JSON.stringify({ width, reservedRectanglesUnchanged: true, ...behavior, runtimeReducedMotion: 'none' }));
      await context.close();
    }

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { level: 1 }).isVisible(), true);
    assert.equal(await page.locator('main img').first().evaluate(i => getComputedStyle(i).opacity), '1');
    assert.equal(await page.locator('footer').textContent().then(t => /\b20\d{2}\b/.test(t)), false);
    console.log('Sin JavaScript: contenido e imagen visibles; copyright sin año de build congelado.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
