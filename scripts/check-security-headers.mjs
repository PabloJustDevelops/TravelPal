import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { checkHeaderLimits, inlineScriptHashesForFile } from './security-header-utils.mjs'

try {
  const headers = await readFile('out/_headers', 'utf8')
  checkHeaderLimits(headers)
  if (/content-security-policy-report-only\s*:/i.test(headers)) {
    throw new Error('CSP must be enforced, not Report-Only')
  }
  const rules = new Map()
  const detachedHeaders = new Map()
  let activeRoute
  for (const line of headers.split(/\r?\n/)) {
    if (/^\S/.test(line) && !line.startsWith('#')) {
      activeRoute = line.trim()
      if (!rules.has(activeRoute)) rules.set(activeRoute, new Map())
      continue
    }
    if (!activeRoute) continue
    const detach = line.match(/^\s*!\s*([^\s:]+)\s*$/)
    if (detach) {
      if (!detachedHeaders.has(activeRoute)) detachedHeaders.set(activeRoute, new Set())
      detachedHeaders.get(activeRoute).add(detach[1].toLowerCase())
      continue
    }
    if (!/^\s+[^\s:]+:/.test(line)) continue
    const separator = line.indexOf(':')
    const name = line.slice(0, separator).trim().toLowerCase()
    const rule = rules.get(activeRoute)
    if (rule.has(name)) throw new Error(`Duplicate header ${name} on ${activeRoute}`)
    rule.set(name, line.slice(separator + 1).trim())
  }
  const globalRule = rules.get('/*')
  if (!globalRule) throw new Error('Missing global /* headers rule')
  const expected = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin-allow-popups',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
  }
  for (const [name, value] of Object.entries(expected)) {
    if (globalRule.get(name) !== value) throw new Error(`Missing or unexpected header: ${name}`)
  }
  const fallbackCsp = globalRule.get('content-security-policy')
  if (!fallbackCsp) throw new Error('Missing global CSP for the Cloudflare 404 fallback')
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
  const htmlFiles = (await walk('out')).filter((file) => file.endsWith('.html'))
  const notFound = htmlFiles.find((file) => path.relative('out', file).split(path.sep).join('/') === '404.html')
  if (!notFound) throw new Error('Missing 404.html fallback document')
  const fallbackHashes = await inlineScriptHashesForFile(notFound)
  const fallbackDirectives = new Map(fallbackCsp.split(';').filter((part) => part.trim()).map((part) => {
    const [name, ...values] = part.trim().split(/\s+/)
    return [name, values]
  }))
  const fallbackScripts = fallbackDirectives.get('script-src')
  if (!fallbackScripts || fallbackScripts.some((source) => source !== "'self'" && !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(source))) throw new Error('404 fallback script-src must contain only self and SHA-256 hashes')
  if (!fallbackHashes.every((hash) => fallbackScripts.includes(hash))) throw new Error('404 fallback CSP hashes do not cover every inline script')
  let inlineHashes = 0
  for (const file of htmlFiles) {
    const route = routeFor(file)
    const csp = rules.get(route)?.get('content-security-policy')
    if (!csp) throw new Error(`Missing route-specific Content-Security-Policy on ${route}`)
    if (!detachedHeaders.get(route)?.has('content-security-policy')) throw new Error(`Missing route-level detach for fallback CSP on ${route}`)
    const directives = new Map(csp.split(';').filter((part) => part.trim()).map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      return [name, values]
    }))
    for (const [name, required] of Object.entries({
      'default-src': ["'self'"], 'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'"],
      'connect-src': ["'self'", 'https://o4511064837062656.ingest.de.sentry.io', 'https://insforge-storage.s3.us-east-2.amazonaws.com'],
      'font-src': ["'self'"], 'frame-src': ["'none'"], 'object-src': ["'none'"],
      'frame-ancestors': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'self'"],
    })) {
      if (!required.every((value) => directives.get(name)?.includes(value))) throw new Error(`Missing or unexpected CSP directive: ${name} on ${route}`)
    }
    const connectSources = directives.get('connect-src')
    if (connectSources.some((source) => source !== "'self'" && !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[0-9]+)?$/.test(source))) throw new Error(`connect-src must use explicit HTTPS origins without wildcards on ${route}`)
    const scriptSources = directives.get('script-src')
    const imageSources = directives.get('img-src')
    if (imageSources.some((source) => source.toLowerCase() === 'https:')) throw new Error(`img-src must not contain the https: wildcard on ${route}`)
    if (scriptSources.some((value) => value !== "'self'" && !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(value))) throw new Error(`script-src must contain only self and SHA-256 hashes on ${route}`)
    const hashes = await inlineScriptHashesForFile(file)
    inlineHashes += hashes.length
    if (!hashes.every((hash) => scriptSources.includes(hash))) throw new Error(`CSP hashes do not cover every inline script on ${route}`)
  }
  if (rules.size > 100) throw new Error(`Generated _headers exceeds Cloudflare’s 100 rule limit (${rules.size})`)
  console.log(`Validated 7 global security headers and ${inlineHashes} route-scoped inline script hashes across ${htmlFiles.length} HTML pages; CSP enforced.`)
} catch (error) {
  console.error(`Security headers check failed: ${error.message}`)
  process.exitCode = 1
}
