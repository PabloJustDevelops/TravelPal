#!/usr/bin/env node
// Guardia de la etapa 0 del issue #38: congela los caminos de datos.
//
// Recorre `src/app/**` y `src/components/**` (sin tests) y cuenta tres cosas:
//
//   - bff[dominio]: llamadas al BFF cuyo destino se puede leer del codigo, es
//       decir `fetch('<literal>')` o `useApiResource('<literal>')` donde el
//       literal empieza por `/api/<dominio>` y el dominio es de datos de
//       usuario (trips, expenses, tasks, notes, budget, planning, dashboard).
//       Un literal con interpolacion (`` `/api/expenses/${id}` ``) cuenta y se
//       le extrae el dominio; un literal a otro endpoint (p. ej.
//       `/api/auth/refresh`) NO cuenta: no es un dato de usuario.
//
//   - bffUnknown (bff sin dominio conocido): puntos del camino BFF cuyo destino
//       no se puede atribuir a un dominio de usuario de forma estatica:
//         * toda invocacion de `useApiResource(...)` cuya URL no sea un literal
//           de dominio de usuario (tipicamente una variable). El hook siempre
//           hace un `fetch` por debajo, asi que es un punto BFF.
//         * toda llamada `fetch(...)` cuyo primer argumento no sea un literal.
//       Es el punto ciego que el conteo de literales no veia: una pagina que
//       monta `useApiResource("/api/" + algo)` o `fetch(url)` no aparecia.
//
//   - sdk: puntos de uso del SDK de InsForge en el navegador
//       (`createInsforgeClient()` y `.database.from(...)`).
//
// Que NO cubre (limites conocidos):
//   - El generico de `useApiResource<...>` se lee con `[^>]*`: un tipo anidado
//     con `>` dentro (p. ej. `Map<string, number>`) cortaria el salto y la
//     invocacion se contaria como literal sin dominio. Hoy no ocurre.
//   - Los ficheros de test (`__tests__`, `*.test.*`, `*.spec.*`) quedan fuera.
//   - Solo mira `src/app` y `src/components`; `src/lib`, `src/hooks` y el
//     servidor no entran (el hook `useApiResource` en si no se cuenta).
//   - `sdk` se imprime como medicion: al migrar un dominio su subida es el
//     objetivo, no la deuda.
//
// Falla (exit 1) si sube, en cualquier fichero, un recuento de `bff` de
// cualquier dominio o el de `bffUnknown`. La bajada es libre (es lo que hace la
// migracion) y se refleja en el baseline con `--update`.
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

// Callees (solo la apertura de la llamada). El literal se mira aparte.
const FETCH_OPEN = /\bfetch\s*\(/g;
const LOADER_OPEN = /\buseApiResource\s*(?:<[^>]*>)?\s*\(/g;
// Apertura + literal de primer argumento.
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

// Primer argumento literal si, tras la apertura, solo hay espacios y una
// comilla (normal, doble o backtick).
function startsWithLiteral(line, openEnd) {
  return /^[`'"]/.test(line.slice(openEnd).replace(/^\s+/, ""));
}

function countMatches(text, regex) {
  let count = 0;
  regex.lastIndex = 0;
  while (regex.exec(text) !== null) count += 1;
  return count;
}

// Indices donde empieza cada linea, para traducir un index del texto a numero
// de linea sin volver a partir el fichero.
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function scan() {
  const files = {};
  const hits = [];
  const domains = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  let sdkTotal = 0;
  let bffTotal = 0;
  let unknownTotal = 0;

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
    const text = readFileSync(abs, "utf8");
    const starts = lineStarts(text);
    const entry = { bff: 0, bffUnknown: 0, sdk: 0 };
    const push = (index, domain, call) =>
      hits.push({
        file: rel,
        line: lineAt(starts, index),
        domain,
        call,
        snippet: text.slice(index, index + 60).replace(/\s+/g, " ").trim(),
      });

    // 1) Literales con dominio de usuario conocido.
    for (const regex of [FETCH_CALL, LOADER_CALL]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const call = regex === FETCH_CALL ? "fetch" : "useApiResource";
        const domain = domainOf(match[2]);
        if (!domain) continue;
        entry.bff += 1;
        domains[domain] += 1;
        bffTotal += 1;
        push(match.index, domain, call);
      }
    }

    // 2) Puntos BFF sin dominio conocido (URL en variable).
    for (const [regex, call] of [
      [FETCH_OPEN, "fetch"],
      [LOADER_OPEN, "useApiResource"],
    ]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (startsWithLiteral(text, match.index + match[0].length)) continue;
        entry.bffUnknown += 1;
        unknownTotal += 1;
        push(match.index, null, call);
      }
    }

    entry.sdk += countMatches(text, SDK_CLIENT);
    entry.sdk += countMatches(text, SDK_TABLE);
    sdkTotal += entry.sdk;

    if (entry.bff > 0 || entry.bffUnknown > 0 || entry.sdk > 0) {
      files[rel] = entry;
    }
  }

  return {
    files,
    hits,
    domains,
    totals: { bff: bffTotal, bffUnknown: unknownTotal, sdk: sdkTotal },
  };
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return { files: {}, domains: {}, totals: { bff: 0, bffUnknown: 0, sdk: 0 } };
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
  const unknownBase = baseline.totals?.bffUnknown ?? 0;
  const unknownFlag = current.totals.bffUnknown > unknownBase ? "  <-- sube" : "";
  console.log(
    `  ${pad("sin dominio", 12)}${current.totals.bffUnknown} / ${unknownBase}${unknownFlag}` +
      `   (useApiResource variable / fetch sin literal)`,
  );
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
    const base = baseline.files?.[file] ?? {};
    const bffRise = entry.bff > (base.bff ?? 0);
    const unknownRise = entry.bffUnknown > (base.bffUnknown ?? 0);
    if (bffRise || unknownRise) {
      offenders.set(file, { entry, base });
    }
  }

  if (offenders.size === 0) return true;

  console.error("\nFallo: aparecen puntos nuevos en el camino bff (/api).\n");
  for (const [file, { entry, base }] of offenders) {
    const parts = [];
    if (entry.bff > (base.bff ?? 0)) parts.push(`bff ${entry.bff} / ${base.bff ?? 0}`);
    if (entry.bffUnknown > (base.bffUnknown ?? 0)) {
      parts.push(`sin dominio ${entry.bffUnknown} / ${base.bffUnknown ?? 0}`);
    }
    console.error(`  ${file} (${parts.join(", ")})`);
    for (const hit of current.hits.filter((h) => h.file === file)) {
      const target = hit.domain ? `/api/${hit.domain}` : "dominio desconocido";
      console.error(`    ${hit.file}:${hit.line}  ${hit.call} -> ${target}`);
    }
  }
  console.error(
    "\nNo se anaden llamadas nuevas al BFF para datos de usuario (ni literales" +
      "\nni con la URL en variable). Si se ha borrado un endpoint y con el sus" +
      "\nllamadas, baja el baseline con:" +
      "\n  node scripts/check-data-paths.mjs --update",
  );
  return false;
}

const current = scan();

if (process.argv.includes("--update")) {
  const payload = {
    note:
      "Baseline de la etapa 0 del issue #38. 'bff' = fetch/useApiResource con " +
      "literal /api/<dominio>; 'bffUnknown' = useApiResource con URL variable o " +
      "fetch sin literal; 'sdk' informativo. Regenerar con --update solo al " +
      "bajar el camino bff.",
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
