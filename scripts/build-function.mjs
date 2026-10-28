#!/usr/bin/env node
// El CLI de InsForge despliega UN fichero: si la función importa un módulo hermano
// (`./contract.ts`), el despliegue falla porque ese fichero no viaja. Este script aplana la
// función en un único .ts antes de desplegarla, sin duplicar la fuente: el contrato sigue
// viviendo en `contract.ts` y aquí solo se pega.
//
// Uso: node scripts/build-function.mjs insforge/functions/travel-inspiration [salida.ts]
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [dirArg, outArg] = process.argv.slice(2)
if (!dirArg) {
  console.error('Uso: node scripts/build-function.mjs <carpeta-de-la-funcion> [salida.ts]')
  process.exit(2)
}

const dir = path.resolve(dirArg)
const entry = path.join(dir, 'index.ts')
const out = path.resolve(outArg ?? path.join(dir, '.deploy', 'index.ts'))

const entrySource = await readFile(entry, 'utf8')
const IMPORT_RE = /^import\s+\{([^}]+)\}\s+from\s+["']\.\/([\w.-]+)["'];?\s*$/gm

const localImports = [...entrySource.matchAll(IMPORT_RE)]
if (localImports.length === 0) {
  console.log(`sin imports locales: ${entry} ya es autocontenido`)
  process.exit(0)
}

let bundled = entrySource
for (const [full, names, file] of localImports) {
  const modulePath = path.join(dir, file)
  let moduleSource = await readFile(modulePath, 'utf8')
  // El módulo inlinado no puede exportar: sus nombres pasan al ámbito del entrypoint.
  moduleSource = moduleSource.replace(/^export\s+(?=(interface|type|const|function|class|enum)\b)/gm, '')
  // Tipos importados del propio módulo no necesitan nada más; se comprueba que los nombres existan.
  for (const name of names.split(',').map((n) => n.trim()).filter(Boolean)) {
    if (!new RegExp(`\\b${name}\\b`).test(moduleSource)) {
      throw new Error(`${modulePath} no define "${name}", que ${path.basename(entry)} importa`)
    }
  }
  bundled = bundled.replace(full, moduleSource.trimEnd())
}

if (/from\s+["']\.\//.test(bundled)) throw new Error('quedan imports locales sin aplanar')
if (/\bexport\s+default\s+/.test(bundled) === false) throw new Error('el bundle no exporta un handler por defecto')

await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, bundled)
console.log(`empaquetado: ${path.relative(process.cwd(), out)} (${bundled.split('\n').length} líneas)`)
