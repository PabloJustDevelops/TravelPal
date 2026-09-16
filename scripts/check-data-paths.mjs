#!/usr/bin/env node
// Guardia de la etapa 0 del issue #38: congela los dos caminos de datos.
//
// Cuenta, en `src/app/**` y `src/components/**`:
//   - bff: puntos que pegan al BFF por un endpoint de datos de usuario
//          (`fetch('/api/<dominio>...')` y `useApiResource('/api/<dominio>...')`).
//   - sdk: puntos de uso del SDK de InsForge en el navegador
//          (`createInsforgeClient()` y `.database.from(...)`).
//
// Falla (exit 1) solo si sube un recuento del camino `bff`. El recuento de `sdk`
// se imprime como medicion: al migrar un dominio su subida es el objetivo, no la
// deuda, asi que no rompe el build.
//
// Uso:
//   node scripts/check-data-paths.mjs            # verifica contra el baseline
//   node scripts/check-data-paths.mjs --update   # reescribe el baseline

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BASELINE_PATH = path.join(HERE, "data-paths-baseline.json");

// Endpoints de datos de usuario que el BFF no debe seguir sirviendo.
const DOMAINS = [
  "trips",
  "expenses",
  "tasks",
  "notes",
  "budget",
  "planning",
  "dashboard",
];

const SCAN_DIRS = ["src/app", "src/components"];
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;

const FETCH_CALL = /\bfetch\s*\(\s*([`'"])([^`'"]*)\1/g;
const LOADER_CALL = /\buseApiResource\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]*)\1/g;
const SDK_CLIENT = /createInsforgeClient\s*\(/g;
const SDK_TABLE = /\.database\.from\s*\(/g;

function isScannable(file) {
  if (!SOURCE_EXT.test(file)) return false;
  if (/(^|[\\/])__tests__([\\/]|$)/.test(file)) return false;
  if (/\.(test|spec)\./.test(file)) return false;
  return true;
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (isScannable(full)) {
      out.push(full);
    }
  }
  return out;
}

function domainOf(url) {
  const match = /^\/api\/([a-z0-9-]+)/.exec(url);
  if (!match) return null;
  return DOMAINS.includes(match[1]) ? match[1] : null;
}

function countMatches(line, regex) {
  let count = 0;
  regex.lastIndex = 0;
  while (regex.exec(line) !== null) count += 1;
  return count;
}

function scan() {
  const files = {};
  const hits = [];
  const domains = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  let sdkTotal = 0;
  let bffTotal = 0;

  const paths = SCAN_DIRS.flatMap((dir) => {
    const abs = path.join(ROOT, dir);
    try {
      return walk(abs, []);
    } catch {
      return [];
    }
  }).sort();

  for (const abs of paths) {
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    const lines = readFileSync(abs, "utf8").split(/\r?\n/);
    const entry = { bff: 0, sdk: 0 };

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      for (const regex of [FETCH_CALL, LOADER_CALL]) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          const call = regex === FETCH_CALL ? "fetch" : "useApiResource";
          const domain = domainOf(match[2]);
          if (!domain) continue;
          entry.bff += 1;
          domains[domain] += 1;
          bffTotal += 1;
          hits.push({ file: rel, line: lineNo, domain, call, snippet: line.trim() });
        }
      }

      entry.sdk += countMatches(line, SDK_CLIENT);
      entry.sdk += countMatches(line, SDK_TABLE);
    });

    sdkTotal += entry.sdk;

    if (entry.bff > 0 || entry.sdk > 0) {
      files[rel] = entry;
    }
  }

  return { files, hits, domains, totals: { bff: bffTotal, sdk: sdkTotal } };
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return { files: {}, domains: {}, totals: { bff: 0, sdk: 0 } };
  }
}

function writeBaseline(data) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

function report(current, baseline) {
  console.log("Caminos de datos (actual / baseline)\n");
  console.log(`  ${pad("dominio", 12)}bff`);
  for (const domain of DOMAINS) {
    const actual = current.domains[domain] ?? 0;
    const base = baseline.domains?.[domain] ?? 0;
    const flag = actual > base ? "  <-- sube" : "";
    console.log(`  ${pad(domain, 12)}${actual} / ${base}${flag}`);
  }
  console.log(
    `\n  puntos bff: ${current.totals.bff} / ${baseline.totals?.bff ?? 0}` +
      `   (ficheros: ${Object.keys(current.files).length})`,
  );
  console.log(
    `  puntos sdk: ${current.totals.sdk} / ${baseline.totals?.sdk ?? 0}   (informativo)`,
  );
}

function check(current, baseline) {
  const offenders = new Map();

  for (const [file, entry] of Object.entries(current.files)) {
    const base = baseline.files?.[file]?.bff ?? 0;
    if (entry.bff > base) offenders.set(file, { base, actual: entry.bff });
  }

  if (offenders.size === 0) return true;

  console.error("\nFallo: aparecen puntos nuevos en el camino bff (/api).\n");
  for (const [file, info] of offenders) {
    console.error(`  ${file} (${info.actual} / ${info.base})`);
    for (const hit of current.hits.filter((h) => h.file === file)) {
      console.error(`    ${hit.file}:${hit.line}  ${hit.call} -> /api/${hit.domain}`);
    }
  }
  console.error(
    "\nNo se anaden fetch nuevos a /api para datos de usuario. Si se ha borrado" +
      "\nun endpoint y con el sus llamadas, baja el baseline con:" +
      "\n  node scripts/check-data-paths.mjs --update",
  );
  return false;
}

const current = scan();

if (process.argv.includes("--update")) {
  const payload = {
    note: "Baseline de la etapa 0 del issue #38. Regenerar con --update solo al bajar el camino bff.",
    domains: current.domains,
    files: current.files,
    totals: current.totals,
  };
  writeBaseline(payload);
  console.log(`Baseline actualizado en ${path.relative(ROOT, BASELINE_PATH)}`);
  report(current, payload);
  process.exit(0);
}

const baseline = readBaseline();
report(current, baseline);

if (!check(current, baseline)) {
  process.exit(1);
}

console.log("\nOK: sin puntos nuevos en el camino bff.");
