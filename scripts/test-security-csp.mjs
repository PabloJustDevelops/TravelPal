import { chromium } from '@playwright/test'
const baseURL = process.argv[2] ?? 'http://127.0.0.1:8791'
const headerName = process.argv.includes('--report-only') ? 'content-security-policy-report-only' : 'content-security-policy'
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const route of ['/', '/signin', '/travel-inspiration', '/dashboard']) {
    const page = await browser.newPage()
    const consoleMessages = [], failedRequests = [], pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => consoleMessages.push({type: message.type(), text: message.text()}))
    page.on('requestfailed', request => failedRequests.push({url: request.url(), error: request.failure()?.errorText}))
    await page.addInitScript(() => {
      window.cspViolations = []
      document.addEventListener('securitypolicyviolation', event => window.cspViolations.push({directive: event.effectiveDirective, blocked: event.blockedURI, disposition: event.disposition, sample: event.sample}))
    })
    const response = await page.goto(baseURL + route)
    if (!response.headers()[headerName]?.includes("'sha256-")) throw new Error(`Missing hashes in ${headerName} on ${route}`)
    if (route === '/signin') {
      // A client-side validation error proves hydration and the Zod interpreter run.
      await page.locator('form button[type="submit"]').click()
      await page.locator('#email[aria-invalid="true"]').waitFor()
    }
    await page.waitForTimeout(1800)
    results.push({route, status: response.status(), finalURL: page.url(), violations: await page.evaluate(() => window.cspViolations), failedRequests, consoleMessages, pageErrors})
    await page.close()
  }
  if (headerName === 'content-security-policy') {
    const page = await browser.newPage()
    await page.goto(baseURL)
    const probe = await page.evaluate(() => new Promise(resolve => {
      document.addEventListener('securitypolicyviolation', event => {
        if (event.blockedURI === 'inline') resolve({ blocked: !window.cspInjectionRan, directive: event.effectiveDirective })
      })
      const script = document.createElement('script')
      script.textContent = 'window.cspInjectionRan = true'
      document.body.append(script)
      setTimeout(() => resolve({ blocked: false }), 2000)
    }))
    if (!probe.blocked) throw new Error('Unhashed inline script was not blocked')
    console.log(`Unhashed inline script blocked by ${probe.directive}.`)
    await page.close()
  }
  console.log(JSON.stringify(results, null, 2))
  console.log(`Checked ${results.length} routes; ${results.reduce((total, result) => total + result.violations.length, 0)} CSP violations.`)
} finally {
  await browser.close()
}
if (results.some(result => result.status !== 200 || result.violations.length || result.pageErrors.length)) process.exitCode = 1
