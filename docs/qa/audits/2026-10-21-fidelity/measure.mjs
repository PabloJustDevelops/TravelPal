import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Páginas reales, SDK simulado y reloj de red controlado por el botón del arnés.
// Ejecutar con Storybook local ya iniciado; nunca consulta datos de producción.
const output = fileURLToPath(new URL('./', import.meta.url))
const browser = await chromium.launch({ headless: true })
const results = []
try {
  const screens = process.env.FIDELITY_SCREENS?.split(',') || ['dashboard', 'expenses', 'trips', 'planning', 'tasks', 'notes']
  for (const screen of screens) {
    for (const width of [390, 768, 1440]) {
      for (const fixture of ['empty', 'populated', 'long']) {
       for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.addInitScript(value => localStorage.setItem('theme', value), theme)
        await page.goto(`${process.env.STORYBOOK_URL || 'http://127.0.0.1:6006'}/iframe.html?id=interior-carga--${screen}-pending&viewMode=story&args=fixture:${fixture}&globals=theme:${theme}`)
        await page.getByTestId('page-skeleton').waitFor()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(1200)
        const measure = () => page.locator('[data-loading-frame]').evaluate(frame => ({
          main: frame.closest('main').getBoundingClientRect().height,
          slots: Object.fromEntries([...frame.querySelectorAll('[data-loading-slot]')].map(el => {
            const rect = el.getBoundingClientRect()
            return [el.dataset.loadingSlot, { height: rect.height, top: rect.top + scrollY }]
          })),
        }))
        await page.locator('[data-qa-resolve]').evaluate(element => { element.style.visibility = 'hidden' })
        const before = await measure()
        const reducedAnimation = await page.getByTestId('skeleton').first().evaluate(el => getComputedStyle(el).animationName)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const animation = await page.getByTestId('skeleton').first().evaluate(el => getComputedStyle(el).animationName)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        if (fixture === 'long' && width === 390 && theme === 'light') await page.screenshot({ path: `${output}/${screen}-loading.png`, fullPage: true })
        // Verifica también fuera del primer viewport, sin excluir los shifts por input reciente.
        await page.evaluate(() => {
          scrollTo(0, document.documentElement.scrollHeight)
          window.fidelityShifts = []
          window.fidelityObserver = new PerformanceObserver(list => window.fidelityShifts.push(...list.getEntries().map(entry => entry.value)))
          window.fidelityObserver.observe({ type: 'layout-shift' })
          document.querySelector('[data-qa-resolve]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await page.getByTestId('page-skeleton').waitFor({ state: 'detached' })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const after = await measure()
        const shifts = await page.evaluate(() => { window.fidelityObserver.disconnect(); return window.fidelityShifts })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const slotErrors = Object.entries(before.slots).filter(([key, rect]) => !after.slots[key] || Math.abs(after.slots[key].height - rect.height) > 1 || Math.abs(after.slots[key].top - rect.top) > 1).map(([key]) => key)
        const delta = after.main - before.main
        const pass = Math.abs(delta) <= before.main * .05 && slotErrors.length === 0 && shifts.every(value => value === 0) && !overflow && !errors.length && reducedAnimation === 'none' && animation !== 'none'
        results.push({ screen, width, fixture, theme, before, after, delta, slotErrors, shifts, overflow, reducedAnimation, animation, errors, pass })
        console.log(`${pass ? 'PASS' : 'FAIL'} ${screen} ${width} ${fixture} ${theme}: ${before.main} → ${after.main}; bloques: ${slotErrors.join(',') || 'sin diferencias'}`)
        if (fixture === 'long' && width === 390 && theme === 'light') {
          await page.evaluate(() => scrollTo(0, 0))
          await page.screenshot({ path: `${output}/${screen}-loaded.png`, fullPage: true })
        }
        await page.close()
       }
      }
    }
  }
  await writeFile(`${output}/${process.env.FIDELITY_SCREENS ? 'after-review' : 'after'}.json`, `${JSON.stringify(results, null, 2)}\n`)
  if (results.some(result => !result.pass)) process.exitCode = 1
} finally {
  await browser.close()
}
