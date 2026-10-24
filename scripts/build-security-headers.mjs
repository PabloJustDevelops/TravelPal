import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { checkHeaderLimits, inlineScriptHashesForFile } from './security-header-utils.mjs'

const require = createRequire(import.meta.resolve('next'))
const { loadEnvConfig } = require('@next/env')
process.env.NODE_ENV = 'production'
loadEnvConfig(process.cwd(), false)

const headers = await readFile('public/_headers', 'utf8')
if (/content-security-policy\s*:/i.test(headers)) throw new Error('CSP must be generated per HTML route, not globally')
if (!/^\/\*\r?\n/.test(headers)) throw new Error('Missing global /* rule in public/_headers')
const backendOrigin = new URL(process.env.NEXT_PUBLIC_INSFORGE_URL ?? 'https://sjdq7zsn.eu-central.insforge.app').origin
if (!backendOrigin.startsWith('https://')) throw new Error('CSP backend origin must use HTTPS')

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

const pages = (await walk('out')).filter((file) => file.endsWith('.html'))
const notFound = pages.find((file) => path.relative('out', file).split(path.sep).join('/') === '404.html')
if (!notFound) throw new Error('Static export is missing 404.html')

function cspFor(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trimEnd(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' ${backendOrigin} https://insforge-storage.s3.us-east-2.amazonaws.com`,
    `connect-src 'self' https://o4511064837062656.ingest.de.sentry.io ${backendOrigin} https://insforge-storage.s3.us-east-2.amazonaws.com`,
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' ${backendOrigin} https://accounts.google.com`,
  ].join('; ')
}

// Cloudflare applies _headers to the requested path during its 404 fallback,
// not to 404.html. Use that page's hashes for the catch-all, then detach this
// policy in each exact static page rule and set that page's own strict hashes.
const fallbackCsp = cspFor(await inlineScriptHashesForFile(notFound))
const withFallbackCsp = headers.replace(/^\/\*\r?\n/, `/*\n  Content-Security-Policy: ${fallbackCsp}\n`)
const routeRules = []
for (const file of pages) {
  const hashes = await inlineScriptHashesForFile(file)
  routeRules.push(`${routeFor(file)}\n  ! Content-Security-Policy\n  Content-Security-Policy: ${cspFor(hashes)}`)
}
if (routeRules.length + 2 > 100) throw new Error('Generated _headers exceeds Cloudflare’s 100 rule limit')
const generated = `${withFallbackCsp.trimEnd()}\n\n${routeRules.join('\n\n')}\n`
checkHeaderLimits(generated)
await writeFile('out/_headers', generated)
console.log(`Generated out/_headers with a 404 fallback CSP and exact CSP for ${pages.length} HTML pages.`)
