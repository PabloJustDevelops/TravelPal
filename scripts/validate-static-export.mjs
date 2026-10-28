import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = path.resolve(process.argv[2] ?? 'out')
const criticalRoutes = [
  '/',
  ...['es', 'en'].flatMap((locale) => ['', 'signin', 'signup', 'forgot-password', 'reset-password', 'aviso-legal', 'privacidad'].map((route) => `/${locale}${route ? `/${route}` : ''}`)),
  '/auth/callback',
  '/create-trip',
  '/travel-inspiration',
  '/dashboard',
  '/trips',
  '/trip',
  '/expenses',
  '/expense-edit',
]
const privateMarkers = [
  'INSFORGE_API_KEY',
  'INSFORGE_PRIVATE_API_KEY',
  'INSFORGE_SECRET_KEY',
]

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(entryPath)))
    else if (entry.isFile()) files.push(entryPath)
  }

  return files
}

const outputStats = await stat(outputDirectory).catch(() => null)
if (!outputStats?.isDirectory()) {
  console.error(`Static export directory not found: ${outputDirectory}`)
  process.exit(1)
}

const files = await walk(outputDirectory)
const relativeFiles = new Set(
  files.map((file) => path.relative(outputDirectory, file).split(path.sep).join('/')),
)
const missingRoutes = criticalRoutes.filter((route) => {
  if (route === '/') return !relativeFiles.has('index.html')

  const routePath = route.slice(1)
  return !relativeFiles.has(`${routePath}/index.html`) && !relativeFiles.has(`${routePath}.html`)
})

if (!relativeFiles.has('404.html')) {
  console.error('Static export is missing 404.html')
  process.exitCode = 1
}

if (!relativeFiles.has('_redirects')) {
  console.error('Static export is missing public/_redirects')
  process.exitCode = 1
} else {
  const redirects = await readFile(path.join(outputDirectory, '_redirects'), 'utf8')
  for (const route of ['/signin', '/signup', '/forgot-password', '/reset-password', '/aviso-legal', '/privacidad']) {
    for (const source of [route, `${route}/`]) {
      if (!redirects.split(/\r?\n/).some((line) => line.trim() === `${source} /es${route} 301`)) {
        console.error(`Static export is missing the Spanish compatibility redirect: ${source} -> /es${route}`)
        process.exitCode = 1
      }
    }
  }
}

if (missingRoutes.length > 0) {
  console.error(`Static export is missing critical route assets: ${missingRoutes.join(', ')}`)
  process.exitCode = 1
}

const leakedMarkers = new Set()
for (const file of files) {
  const contents = await readFile(file)
  for (const marker of privateMarkers) {
    if (contents.includes(marker)) leakedMarkers.add(marker)
  }
}

if (leakedMarkers.size > 0) {
  console.error(`Static export contains private API key markers: ${[...leakedMarkers].join(', ')}`)
  process.exitCode = 1
}

if (process.exitCode) process.exit()
console.log(`Validated ${files.length} static files and ${criticalRoutes.length} critical routes; no private key markers found.`)
