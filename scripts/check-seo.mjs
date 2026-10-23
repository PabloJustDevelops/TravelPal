import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve(process.argv[2] ?? 'out')
const origin = 'https://travelpal.prg-dev.workers.dev'
const indexable = ['/', '/signin', '/signup', '/forgot-password', '/reset-password']
const privateRoutes = ['/dashboard', '/trips', '/trip', '/planning', '/tasks', '/expenses', '/notes', '/profile', '/settings', '/create-trip', '/expense-edit', '/travel-inspiration', '/auth/callback']
const failures = []
const fail = (message) => failures.push(message)
async function read(file) {
  return readFile(path.join(output, file), 'utf8').catch(() => { fail(`Missing ${file}`); return '' })
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), match[2]]))
}
const robots = await read('robots.txt')
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots.txt must reference the production sitemap')
for (const route of privateRoutes) {
  if (!robots.split(/\r?\n/).includes(`Disallow: ${route}`)) fail(`robots.txt must disallow ${route}`)
}
const sitemap = await read('sitemap.xml')
const locations = [...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => match[1])
if (locations.length !== indexable.length) fail('Unexpected sitemap URL count')
for (const location of locations) {
  const url = new URL(location)
  if (url.origin !== origin || !indexable.includes(url.pathname) || url.search || url.hash) fail(`Unexpected sitemap URL: ${location}`)
}
for (const route of indexable) {
  if (!locations.includes(`${origin}${route}`)) fail(`Sitemap missing ${route}`)
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  }))).flat()
}
const files = await walk(output).catch(() => { fail(`Missing export directory ${output}`); return [] })
const seen = new Set()
let pages = 0
for (const file of files.filter((file) => file.endsWith('.html'))) {
  const relative = path.relative(output, file).split(path.sep).join('/')
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/(?:\/index)?\.html$/, '')}`
  seen.add(route)
  const html = await readFile(file, 'utf8')
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]))
  const image = meta.find((tag) => tag.property === 'og:image')
  if (image?.content !== `${origin}/og-image.png`) fail(`${route}: missing production og:image`)
  const directives = meta.filter((tag) => tag.name === 'robots').map((tag) => tag.content).join(',').split(/\s*,\s*/)
  const isPublic = indexable.includes(route)
  if (!isPublic && !directives.includes('noindex')) fail(`${route}: missing noindex`)
  if (isPublic && (directives.includes('noindex') || !directives.includes('index'))) fail(`${route}: must allow indexing`)
  if (isPublic && !html.includes(`href="${origin}${route === '/' ? '' : route}"`)) fail(`${route}: missing canonical`)
  pages++
}
for (const route of [...indexable, ...privateRoutes]) {
  if (!seen.has(route)) fail(`Missing exported page ${route}`)
}
const png = await readFile(path.join(output, 'og-image.png')).catch(() => null)
if (!png || png.toString('hex', 0, 8) !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) fail('og-image.png must be a 1200x630 PNG')
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`SEO OK: ${pages} HTML pages, ${locations.length} sitemap URLs, private pages noindex, robots.txt and 1200x630 og:image verified.`)
}
