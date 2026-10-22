import { execFileSync } from 'node:child_process'
import { readdir, rm } from 'node:fs/promises'

async function mapsIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? mapsIn(`${directory}/${entry.name}`)
    : entry.name.endsWith('.map') ? [`${directory}/${entry.name}`] : []))
  return nested.flat()
}

const maps = await mapsIn('out')
try {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    console.log('SENTRY_AUTH_TOKEN absent: skipping source map upload.')
  } else {
    if (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) throw new Error('SENTRY_ORG and SENTRY_PROJECT are required for source map upload')
    const release = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    if (!/^[a-f0-9]{40,64}$/.test(release)) throw new Error('A real git SHA is required for the Sentry release')
    if (!maps.length) throw new Error('No source maps found; build with SENTRY_AUTH_TOKEN first')
    // Release + URL matching avoids modifying content-hashed Next.js assets.
    execFileSync('pnpm', ['exec', 'sentry-cli', 'sourcemaps', 'upload', '--release', release,
      '--url-prefix', '~/_next/static', '--validate', 'out/_next/static'], { stdio: 'inherit' })
  }
} finally {
  await Promise.all(maps.map((file) => rm(file)))
  console.log(`Removed ${maps.length} source maps from the public export.`)
}
