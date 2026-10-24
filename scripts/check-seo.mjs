import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve(process.argv[2] ?? 'out')
const origin = 'https://travelpal.prg-dev.workers.dev'
const publicPaths = ['/', '/signin', '/signup', '/forgot-password', '/reset-password', '/aviso-legal', '/privacidad']
const indexable = publicPaths.flatMap((route) => ['es', 'en'].map((locale) => `/${locale}${route === '/' ? '' : route}`))
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
if (locations.length !== indexable.length) fail(`Unexpected sitemap URL count: ${locations.length}, expected ${indexable.length}`)
for (const location of locations) {
  const url = new URL(location)
  if (url.origin !== origin || !indexable.includes(url.pathname) || url.search || url.hash) fail(`Unexpected sitemap URL: ${location}`)
}
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1])
for (const entry of sitemapEntries) {
  const location = entry.match(/<loc>\s*([^<]+)\s*<\/loc>/)?.[1] ?? ''
  const url = new URL(location)
  const locale = url.pathname.split('/')[1]
  for (const alternateLocale of ['es', 'en']) {
    const alternatePath = url.pathname.replace(/^\/(es|en)(?=\/|$)/, `/${alternateLocale}`)
    const alternate = `${origin}${alternatePath}`
    if (!entry.includes(`hreflang="${alternateLocale}" href="${alternate}"`)) fail(`${location}: sitemap missing ${alternateLocale} alternate`)
  }
  if (!['es', 'en'].includes(locale)) fail(`Unexpected sitemap locale: ${location}`)
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
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/, '').replace(/\.html$/, '')}`
  seen.add(route)
  const html = await readFile(file, 'utf8')
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]))
  const image = meta.find((tag) => tag.property === 'og:image')
  if (image?.content !== `${origin}/og-image.png`) fail(`${route}: missing production og:image`)
  const directives = meta.filter((tag) => tag.name === 'robots').map((tag) => tag.content).join(',').split(/\s*,\s*/)
  const publicRoute = route
  const isPublic = indexable.includes(publicRoute)
  if (!isPublic && !directives.includes('noindex')) fail(`${route}: missing noindex`)
  if (isPublic && (directives.includes('noindex') || !directives.includes('index'))) fail(`${route}: must allow indexing`)
  if (isPublic) {
    if (!html.includes(`href="${origin}${publicRoute}"`)) fail(`${publicRoute}: missing canonical`)
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]))
    for (const locale of ['es', 'en']) {
      const alternatePath = publicRoute.replace(/^\/(es|en)(?=\/|$)/, `/${locale}`)
      if (!links.some((tag) => tag.rel === 'alternate' && tag.hreflang === locale && tag.href === `${origin}${alternatePath}`)) fail(`${publicRoute}: missing ${locale} hreflang alternate`)
    }
  }
  pages++
}
for (const route of [...indexable, ...privateRoutes]) {
  const exportedRoute = route.endsWith('/') && route !== '/' ? route.slice(0, -1) : route
  if (!seen.has(route) && !seen.has(exportedRoute)) fail(`Missing exported page ${route}`)
}
const png = await readFile(path.join(output, 'og-image.png')).catch(() => null)
if (!png || png.toString('hex', 0, 8) !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) fail('og-image.png must be a 1200x630 PNG')
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`SEO OK: ${pages} HTML pages, ${locations.length} localized sitemap URLs, reciprocal hreflang, private pages noindex, robots.txt and 1200x630 og:image verified.`)
}
