import { chromium } from '@playwright/test'
import { readFile, readdir } from 'node:fs/promises'

async function javascriptIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? javascriptIn(`${directory}/${entry.name}`) : entry.name.endsWith('.js') ? [`${directory}/${entry.name}`] : []))).flat()
}
(async () => {
  const enabled = process.argv[2] === 'enabled';
  const files = await javascriptIn('out')
  const bundles = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n')
  const containsDsn = bundles.includes('https://bb04fbea9212639a4cb2ab52d3a39540@o4511064837062656.ingest.de.sentry.io/4512299836047440')
  if (containsDsn !== enabled) throw new Error('Unexpected test DSN presence in exported JavaScript')
  console.log(`Test DSN in bundle: ${containsDsn}`)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests = [];
  await page.route('https://o4511064837062656.ingest.de.sentry.io/**', async route => {
    requests.push(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('http://127.0.0.1:8787/signin?redirectTo=TOP_SECRET#AUTH_TOKEN');
  await page.getByRole('button', { name: /iniciar sesión/i }).first().waitFor();
  await page.waitForFunction(() => document.querySelector('input'));
  // React has hydrated: input focus/click and a task ensure client chunks loaded.
  await page.locator('input').first().fill('probe@example.test');
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const error = new Error('private@example.test TOP_SECRET');
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
    // The same object is reported again by a second global handler and must be deduplicated.
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: error });
    window.dispatchEvent(rejection);
    const rejectionError = new Error('private@example.test another secret');
    const distinctRejection = new Event('unhandledrejection');
    Object.defineProperty(distinctRejection, 'reason', { value: rejectionError });
    window.dispatchEvent(distinctRejection);
  });
  await page.waitForTimeout(1000);
  if (requests.length !== (enabled ? 2 : 0)) throw new Error(`Expected ${enabled ? 2 : 0} envelopes, got ${requests.length}`);
  if (enabled) {
    const events = requests.map(envelope => envelope.split(/\r?\n/)
      .map(line => { try { return JSON.parse(line); } catch { return undefined; } })
      .find(item => item?.exception));
    if (events.some(event => !event)) throw new Error('Missing event payload in Sentry envelope');
    const mechanisms = events.map(event => event.exception?.values?.[0]?.mechanism);
    const expected = [
      { type: 'onerror', handled: false },
      { type: 'onunhandledrejection', handled: false },
    ];
    for (const mechanism of expected) {
      if (!mechanisms.some(actual => actual?.type === mechanism.type && actual.handled === mechanism.handled)) {
        throw new Error(`Missing unhandled mechanism ${mechanism.type}`);
      }
    }
    for (const envelope of requests) {
      for (const privateValue of ['TOP_SECRET', 'another secret', 'AUTH_TOKEN', 'redirectTo', 'private@example.test', 'probe@example.test', 'Authorization']) {
        if (envelope.includes(privateValue)) throw new Error(`Privacy leak: ${privateValue}`);
      }
    }
    if (!requests.every(envelope => envelope.includes('anon-'))) throw new Error('Missing anonymous id');
  }
  console.log(`${enabled ? 'DSN enabled' : 'No DSN'}: ${requests.length} envelope(s) from 2 distinct errors; same-object duplicate suppressed; global mechanisms and privacy checked.`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
