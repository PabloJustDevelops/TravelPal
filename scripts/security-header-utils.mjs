import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// Hash the exact bytes the browser sees, including theme and Next hydration scripts.
export async function inlineScriptHashes(directory) {
  const hashes = new Set()
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const hash of await inlineScriptHashes(file)) hashes.add(hash)
    } else if (entry.name.endsWith('.html')) {
      for (const hash of await inlineScriptHashesForFile(file)) hashes.add(hash)
    }
  }
  return [...hashes].sort()
}

export async function inlineScriptHashesForFile(file) {
  const html = await readFile(file, 'utf8')
  const hashes = new Set()
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/i.test(match[1])) continue
    hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`)
  }
  return [...hashes].sort()
}

export function checkHeaderLimits(headers) {
  if (headers.split(/\r?\n/).some((line) => line.length > 2000)) {
    throw new Error('Security headers exceed Cloudflare’s 2000 character line limit')
  }
}
