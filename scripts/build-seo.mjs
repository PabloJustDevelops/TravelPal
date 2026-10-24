import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

// Next already depends on Sharp; resolve it from Next's dependency tree under pnpm.
const require = createRequire(import.meta.resolve('next'))
const sharp = require('sharp')
const origin = 'https://travelpal.prg-dev.workers.dev'
// Callback is public for authentication, but intentionally excluded from discovery.
const publicRoutes = ['/', '/signin', '/signup', '/forgot-password', '/reset-password', '/aviso-legal', '/privacidad']
const routes = publicRoutes.flatMap((route) => ['es', 'en'].map((locale) => ({ locale, route, url: `${origin}/${locale}${route === '/' ? '' : route}` })))
// No authoritative per-page modification dates exist: use this build's timestamp.
const lastmod = new Date().toISOString()
await writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${routes.map(({ route, url }) => {
  const alternates = ['es', 'en'].map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${origin}/${locale}${route === '/' ? '' : route}"/>`).join('\n')
  return `  <url>\n    <loc>${url}</loc>\n${alternates}\n    <lastmod>${lastmod}</lastmod>\n  </url>`
}).join('\n')}\n</urlset>\n`)

const panorama = await sharp('public/images/atlas/coastal-panorama.webp').resize(1200, 600).toBuffer()
// Reuse the published TP ligature with explicit light-theme colors for raster output.
const lockup = (await readFile('public/brand/travelpal-lockup.svg', 'utf8'))
  .replace(/<style>[\s\S]*?<\/style>/, '')
  .replace('fill="currentColor"', 'fill="#0759d3"')
  .replace('fill="currentColor"', 'fill="#101828"')
const brand = await sharp(Buffer.from(lockup)).resize(366, 96).png().toBuffer()
const copy = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="64" y="190" fill="#101828" font-family="DejaVu Sans, sans-serif" font-size="54" font-weight="600">Todos tus planes,</text>
  <text x="64" y="250" fill="#0759d3" font-family="DejaVu Sans, sans-serif" font-size="54" font-weight="600">un solo viaje.</text>
  <text x="66" y="292" fill="#475467" font-family="DejaVu Sans, sans-serif" font-size="21">Itinerarios, reservas y gastos en un solo lugar.</text>
</svg>`)
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#f7f4ed' } })
  .composite([{ input: panorama, top: 30, left: 0 }, { input: brand, top: 36, left: 54 }, { input: copy, top: 0, left: 0 }])
  .png().toFile('public/og-image.png')
console.log(`Generated sitemap.xml (${routes.length} URLs, build timestamp ${lastmod}) and og-image.png (1200x630).`)
