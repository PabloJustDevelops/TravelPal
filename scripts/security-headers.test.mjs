import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const checker = fileURLToPath(new URL('./check-security-headers.mjs', import.meta.url))
const template = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
const generator = fileURLToPath(new URL('./build-security-headers.mjs', import.meta.url))

test('exported headers reject missing headers, Report-Only, stale hashes and unsafe scripts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'travelpal-headers-'))
  try {
    await mkdir(path.join(directory, 'public'))
    await mkdir(path.join(directory, 'out'))
    await writeFile(path.join(directory, 'public/_headers'), template)
    await writeFile(path.join(directory, 'out/index.html'), '<script>window.example = "ñ"</script>')
    await writeFile(
      path.join(directory, '.env.production.local'),
      'INSFORGE_HOST=backend.example.test\nNEXT_PUBLIC_INSFORGE_URL=https://${INSFORGE_HOST}/api\n',
    )
    const generated = spawnSync(process.execPath, [generator], {
      cwd: directory,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, NODE_ENV: 'test' },
    })
    assert.equal(generated.status, 0, generated.stderr)
    const original = await readFile(path.join(directory, 'out/_headers'), 'utf8')
    assert.match(original, /connect-src 'self' https:\/\/backend\.example\.test;/)

    const inherited = spawnSync(process.execPath, [generator], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        NEXT_PUBLIC_INSFORGE_URL: 'https://inherited.example.test',
      },
    })
    assert.equal(inherited.status, 0, inherited.stderr)
    const inheritedHeaders = await readFile(path.join(directory, 'out/_headers'), 'utf8')
    assert.match(inheritedHeaders, /connect-src 'self' https:\/\/inherited\.example\.test;/)

    const check = () => spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' })
    assert.equal(check().status, 0)
    const mutations = [
      [original.replace(/^\s+Strict-Transport-Security:.*\n/m, '\n'), /strict-transport-security/],
      [original.replace('Content-Security-Policy:', 'Content-Security-Policy-Report-Only:'), /Report-Only/],
      [original.replace(/ 'sha256-[^']+'/g, ''), /hashes do not cover/],
      [original.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"), /only self and SHA-256/],
      [original + `\n#${'x'.repeat(2000)}`, /2000 character/],
    ]
    for (const [headers, message] of mutations) {
      await writeFile(path.join(directory, 'out/_headers'), headers)
      const result = check()
      assert.equal(result.status, 1)
      assert.match(result.stderr, message)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
