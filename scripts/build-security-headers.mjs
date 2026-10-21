import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { checkHeaderLimits, inlineScriptHashes } from './security-header-utils.mjs'

const require = createRequire(import.meta.resolve('next'))
const { loadEnvConfig } = require('@next/env')
process.env.NODE_ENV = 'production'
loadEnvConfig(process.cwd(), false)

const headers = await readFile('public/_headers', 'utf8')
const hashes = await inlineScriptHashes('out')
if (hashes.length === 0) throw new Error('No inline scripts found in static export')
if (!/script-src 'self';/.test(headers)) throw new Error('Missing script-src template')
const backendOrigin = new URL(process.env.NEXT_PUBLIC_INSFORGE_URL ?? 'https://sjdq7zsn.eu-central.insforge.app').origin
if (!backendOrigin.startsWith('https://')) throw new Error('CSP backend origin must use HTTPS')
const template = headers.replace(
  "img-src 'self' https://sjdq7zsn.eu-central.insforge.app",
  `img-src 'self' ${backendOrigin}`,
).replace(
  "connect-src 'self' https://sjdq7zsn.eu-central.insforge.app",
  `connect-src 'self' ${backendOrigin}`,
)
const generated = template.replace("script-src 'self';", `script-src 'self' ${hashes.join(' ')};`)
checkHeaderLimits(generated)
await writeFile('out/_headers', generated)
console.log(`Generated out/_headers with ${hashes.length} inline script hashes.`)
