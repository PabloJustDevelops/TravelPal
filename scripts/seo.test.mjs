import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Exercise the real checker against the built artifact and isolated corrupt copies.
const cases = [
  ['valid export', null, 0, 'SEO OK:'],
  ['missing robots', (dir) => unlink(path.join(dir, 'robots.txt')), 1, 'Missing robots.txt'],
  ['private sitemap URL', async (dir) => {
    const file = path.join(dir, 'sitemap.xml')
    await writeFile(file, (await readFile(file, 'utf8')).replace('/signin</loc>', '/dashboard</loc>'))
  }, 1, 'Unexpected sitemap URL:'],
  ['private child missing noindex', async (dir) => {
    const file = path.join(dir, 'expenses/new.html')
    await writeFile(file, (await readFile(file, 'utf8')).replace('content="noindex, follow"', 'content="index, follow"'))
  }, 1, '/expenses/new: missing noindex'],
  ['missing Open Graph image tag', async (dir) => {
    const file = path.join(dir, 'index.html')
    await writeFile(file, (await readFile(file, 'utf8')).replace(/<meta property="og:image"[^>]*>/g, ''))
  }, 1, '/: missing production og:image'],
]
for (const [name, mutate, status, message] of cases) {
  test(name, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'travelpal-seo-test-'))
    try {
      await cp('out', dir, { recursive: true, filter: (source) => !source.includes('/_next/') })
      if (mutate) await mutate(dir)
      const result = spawnSync(process.execPath, ['scripts/check-seo.mjs', dir], { encoding: 'utf8' })
      assert.equal(result.status, status, result.stderr)
      assert.ok((result.stdout + result.stderr).includes(message), result.stdout + result.stderr)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}
