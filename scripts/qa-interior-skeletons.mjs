import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// Arnés local de Storybook: páginas reales y SDK simulado; nunca toca el backend.
const baseURL = process.env.STORYBOOK_URL || 'http://127.0.0.1:6006'
const output = 'docs/qa/audits/2026-10-20-skeletons'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const screen of ['dashboard', 'trips', 'expenses', 'notes']) {
    for (const width of [1440, 390]) {
      for (const theme of ['light', 'dark']) {
       for (const fixture of ['empty', 'populated']) {
        console.log(`Midiendo ${screen} ${width} ${theme} ${fixture}`)
        const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.addInitScript(value => localStorage.setItem('theme', value), theme)
        await page.goto(`${baseURL}/iframe.html?id=interior-carga--${screen}-pending&viewMode=story&globals=theme:${theme}&args=fixture:${fixture}`)
        await page.getByTestId('page-skeleton').waitFor({ timeout: 45000 })
        await page.evaluate(() => document.fonts.ready)
        await page.locator('[data-qa-resolve]').evaluate(element => { element.style.visibility = 'hidden' })
        const before = await page.locator('[data-loading-frame]').evaluate(element => element.offsetHeight)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const animation = await page.getByTestId('skeleton').first().evaluate(element => getComputedStyle(element).animationName)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const allowedAnimation = await page.getByTestId('skeleton').first().evaluate(element => getComputedStyle(element).animationName)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        if (fixture === 'empty') await page.screenshot({ path: `${output}/${screen}-${width}-${theme}.png`, fullPage: true, animations: 'disabled' })
        await page.evaluate(() => {
          window.__skeletonShifts = []
          window.__skeletonObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.__skeletonShifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput })
          })
          window.__skeletonObserver.observe({ type: 'layout-shift' })
          // dispatchEvent evita excluir artificialmente los shifts como interacción reciente.
          document.querySelector('[data-qa-resolve]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await page.getByTestId('page-skeleton').waitFor({ state: 'detached' })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const after = await page.locator('[data-loading-frame]').evaluate(element => element.offsetHeight)
        const shifts = await page.evaluate(() => { window.__skeletonObserver.disconnect(); return window.__skeletonShifts })
        results.push({ screen, width, theme, fixture, before, after, delta: after - before, shifts, overflow, reducedMotionAnimation: animation, allowedMotionAnimation: allowedAnimation, errors })
        await page.close()
       }
      }
    }
  }
  await writeFile(`${output}/measurements.json`, `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
  if (results.some(result => result.shifts.some(shift => shift.value > 0) || result.overflow || result.errors.length || result.reducedMotionAnimation !== 'none' || result.allowedMotionAnimation === 'none')) process.exitCode = 1
} finally {
  await browser.close()
}
