import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
const script = fileURLToPath(new URL('./sentry-sourcemaps.mjs', import.meta.url))
test('skips upload without token and removes public maps even when configuration fails', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sentry-maps-'))
  try {
    await mkdir(join(cwd, 'out/_next/static'), { recursive: true })
    for (const token of ['', 'test-not-a-token']) {
      const map = join(cwd, 'out/_next/static/example.js.map')
      await writeFile(map, '{}')
      const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, SENTRY_AUTH_TOKEN: token } })
      assert.equal(result.status, token ? 1 : 0, result.stderr)
      assert.match(result.stdout, /Removed 1 source maps/)
      await assert.rejects(access(map))
      if (!token) assert.match(result.stdout, /skipping source map upload/)
      else assert.match(result.stderr, /SENTRY_ORG and SENTRY_PROJECT/)
    }
  } finally { await rm(cwd, { recursive: true, force: true }) }
})
