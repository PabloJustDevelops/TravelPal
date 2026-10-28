import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { checkHeaderLimits, inlineScriptHashesForFile } from './security-header-utils.mjs'

const require = createRequire(import.meta.resolve('next'))
const { loadEnvConfig } = require('@next/env')
process.env.NODE_ENV = 'production'
loadEnvConfig(process.cwd(), false)

const headers = await readFile('public/_headers', 'utf8')
if (/content-security-policy\s*:/i.test(headers)) throw new Error('CSP must be generated, not declared in public/_headers')
if (!/^\/\*\r?\n/.test(headers)) throw new Error('Missing global /* rule in public/_headers')
const backendUrl = new URL(process.env.NEXT_PUBLIC_INSFORGE_URL ?? 'https://sjdq7zsn.eu-central.insforge.app')
const backendOrigin = backendUrl.origin
if (!backendOrigin.startsWith('https://')) throw new Error('CSP backend origin must use HTTPS')
// Las funciones Edge se sirven desde otro host que el API: <ref>.function2.insforge.app. Sin esto el
// navegador bloquea toda llamada a funciones (inspiracion de vuelos y de tren/bus) aunque el backend
// este permitido.
const projectRef = backendUrl.hostname.split('.')[0]
const functionsOrigin = backendUrl.hostname.endsWith('.insforge.app')
  ? `https://${projectRef}.function2.insforge.app`
  : backendOrigin

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  }))).flat()
}

function routeFor(file) {
  const relative = path.relative('out', file).split(path.sep).join('/')
  if (relative === 'index.html') return '/'
  return `/${relative.replace(/index\.html$/, '').replace(/\.html$/, '')}`
}

function cspFor(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trimEnd(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' ${backendOrigin} https://insforge-storage.s3.us-east-2.amazonaws.com`,
    `connect-src 'self' https://o4511064837062656.ingest.de.sentry.io ${backendOrigin} ${functionsOrigin} https://insforge-storage.s3.us-east-2.amazonaws.com`,
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' ${backendOrigin} https://accounts.google.com`,
  ].join('; ')
}

// El CSP NO va en la regla global `/*`. Cloudflare aplica esa regla a toda peticion y
// no aplica el detach (`! Content-Security-Policy`) en la raiz, asi que `/` recibia dos
// cabeceras CSP y el navegador aplicaba la interseccion: los scripts en linea de la
// landing quedaban bloqueados y la pagina no hidrataba. Cada HTML tiene ahora su propia
// regla con su CSP exacto, y ninguna ruta puede heredar otro.
const pages = (await walk('out')).filter((file) => file.endsWith('.html'))
if (pages.length === 0) throw new Error('Static export has no HTML pages')
const notFound = pages.find((file) => path.relative('out', file).split(path.sep).join('/') === '404.html')
if (!notFound) throw new Error('Static export is missing 404.html')

const routeRules = []
for (const file of pages) {
  const hashes = await inlineScriptHashesForFile(file)
  routeRules.push(`${routeFor(file)}\n  Content-Security-Policy: ${cspFor(hashes)}`)
}
if (routeRules.length + 1 > 100) throw new Error('Generated _headers exceeds Cloudflare’s 100 rule limit')

const generated = `${headers.trimEnd()}\n\n${routeRules.join('\n\n')}\n`
checkHeaderLimits(generated)
await writeFile('out/_headers', generated)
console.log(`Generated out/_headers with exact CSP per HTML route (${pages.length} pages); the global rule carries no CSP.`)
