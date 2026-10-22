import { readFile } from 'node:fs/promises'
import { checkHeaderLimits, inlineScriptHashes } from './security-header-utils.mjs'

try {
  const headers = await readFile('out/_headers', 'utf8')
  checkHeaderLimits(headers)
  if (/content-security-policy-report-only\s*:/i.test(headers)) {
    throw new Error('CSP must be enforced, not Report-Only')
  }
  const globalRule = headers.split(/\r?\n/).reduce((state, line) => {
    if (/^\S/.test(line) && !line.startsWith('#')) state.active = line.trim() === '/*'
    if (state.active && /^\s+[^\s:]+:/.test(line)) {
      const separator = line.indexOf(':')
      const name = line.slice(0, separator).trim().toLowerCase()
      if (state.values.has(name)) throw new Error(`Duplicate global header: ${name}`)
      state.values.set(name, line.slice(separator + 1).trim())
    }
    return state
  }, { active: false, values: new Map() }).values
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
  const csp = globalRule.get('content-security-policy')
  if (!csp) throw new Error('Missing enforced Content-Security-Policy on /*')
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
    if (!required.every((value) => directives.get(name)?.includes(value))) {
      throw new Error(`Missing or unexpected CSP directive: ${name}`)
    }
  }
  const connectSources = directives.get('connect-src')
  if (connectSources.some((source) => source !== "'self'" && !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[0-9]+)?$/.test(source))) {
    throw new Error('connect-src must use explicit HTTPS origins without wildcards')
  }
  const scriptSources = directives.get('script-src')
  const imageSources = directives.get('img-src')
  if (imageSources.some((source) => source.toLowerCase() === 'https:')) {
    throw new Error('img-src must not contain the https: wildcard')
  }
  if (scriptSources.some((value) => value !== "'self'" && !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(value))) {
    throw new Error('script-src must contain only self and SHA-256 hashes')
  }
  const hashes = await inlineScriptHashes('out')
  if (!hashes.length || !hashes.every((hash) => scriptSources.includes(hash))) {
    throw new Error('CSP hashes do not cover every inline script in out/')
  }
  console.log(`Validated 7 global security headers and ${hashes.length} inline script hashes; CSP enforced.`)
} catch (error) {
  console.error(`Security headers check failed: ${error.message}`)
  process.exitCode = 1
}
