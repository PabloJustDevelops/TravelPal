# Fidelidad de skeletons y regresión de temporizadores (#110)

Medición local del 21 de octubre de 2026 sobre `4483868` en `fix/calidad-interior`.
Páginas reales en Storybook, SDK simulado, datos sintéticos y espera de 1200 ms.
No se consultó el backend ni se publicó nada.

Los JSON `before.json` y `before-long.json` contienen las alturas ejecutadas antes de
cambiar los estilos. `after.json` conserva la geometría de cada bloque, el alto de
`main`, layout shifts, overflow y animación con/sin movimiento reducido.
El fixture largo incluye 12 movimientos, 3 presupuestos, 3 tareas y 3 actividades;
en la regresión final también incluye 12 viajes y 12 notas. Los resultados no son
una nueva medición de producción: los +205/+1316 px del encargo son la referencia
externa aportada por el usuario, no cifras reproducidas aquí.

## Reserva compartida

`interiorSlots.module.css` se aplica tanto al placeholder como al bloque real.
Las alturas se redondean hacia arriba a partir de las medidas del contenido;
las listas usan una región desplazable accesible, de tamaño reservado. Así su
longitud, los textos que envuelven líneas y los resultados vacíos no desplazan los
bloques posteriores. Los informes plegables recuperan altura automática al abrirse.
El estado vacío de gastos ocupa la región de movimientos.

Medidas originales relevantes (px):

| Bloque | 390 | 768 | 1440 |
| --- | ---: | ---: | ---: |
| Dashboard: cabecera | 129.5 | 84.109375 | 84.109375 |
| Dashboard: hero con viaje | 316 | 284 | 288 |
| Dashboard: 3 actividades | 430 | 390 | 390 |
| Dashboard: 3 tareas | 290 | 308 | 290 |
| Dashboard: 3 presupuestos | 308 | 308 | 268 |
| Dashboard: informe cerrado | 126 | 86 | 86 |
| Gastos: cabecera con acciones | 211.09375 | 156.21875 | 84.109375 |
| Gastos: movimientos con 1 gasto | 434 | 378 | 258 |
| Gastos: tarjeta de presupuesto | 363 | 307 | 307 |
| Gastos: título de presupuestos | 48 | 48 | 48 |
| Gastos: informe cerrado | 65 | 65 | 65 |
| Viajes: cabecera con acción | 155.09375 | 84.109375 | 84.109375 |
| Viajes: filtros | 162 | 110 | 110 |
| Viajes: contenido con 1 viaje | 307.5 | 327 | 343 |
| Notas: filtros | 189 | 189 | 69 |
| Notas: espacio vacío / editor | 358.53125 | 352.140625 | 744 |
| Planificación: cabecera | 139.5 | 154.109375 | 84.109375 |
| Planificación: calendario | 2903 | 894 | 894 |
| Planificación: resumen sin estirar | 252 | 252 | 252 |
| Tareas: cabecera | 171.40625 | 127.421875 | 84.109375 |
| Tareas: filtros | 104 | 44 | 44 |
| Tareas: lista | 352 | 352 | 405 |

La región de presupuestos reserva título + una tarjeta. A partir de xl, ambas
columnas de gastos comparten esa altura mínima. Viajes reserva filtros + 28 px de
separación + su tarjeta. El mínimo de viewport existente del shell se mantiene.

## Reproducir geometría

```bash
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=placeholder pnpm run storybook
node docs/qa/audits/2026-10-21-fidelity/measure.mjs
```

El comando mide estados vacío, poblado y largo, a 390/768/1440 px y en temas claro
y oscuro. Exige ±5 % en `main`, como máximo 1 px por altura/posición de bloque,
cero layout shifts incluso desplazado al final de la página, ningún overflow
horizontal ni error de navegador y respeto de `prefers-reduced-motion`.
Las capturas `*-loading.png` y `*-loaded.png` muestran el fixture largo móvil.
Las siete stories `*Fidelity` ejecutan además las aserciones de geometría con
`pnpm run test:storybook`. El umbral de 119/120 ms y la cancelación del timeout
siguen cubiertos por `src/hooks/__tests__/useDelayedLoading.test.tsx`.

## #110

Los tests de vencimiento usan una fecha fija y `advanceTimersByTimeAsync` dentro
de `act` para resolver promesas y avanzar los 500/800/1000 ms exactos. Las
aserciones son síncronas tras cada avance; `afterEach` restaura el reloj real.
También se elimina el polling en el caso de cooldown que usaba fake timers.

La revisión independiente detectó que el overflow de la cabecera podía recortar
el menú Exportar. La cabecera conserva `overflow: visible`; su story abre el
menú y comprueba con `elementFromPoint` que JSON y PDF reciben eventos.

## Alturas de main: antes y después

Viewport de 844 px de alto. Resultado final idéntico para vacío, poblado y largo,
y para ambos temas (108 casos). Las alturas están en px.

| Pantalla | Ancho | Antes: skeleton → poblado | Después: skeleton → contenido |
| --- | ---: | ---: | ---: |
| dashboard | 390 | 1168 → 1352.5 | 1749 → 1749 |
| dashboard | 768 | 1140 → 1039.11 | 1310 → 1310 |
| dashboard | 1440 | 920 → 955.109 | 1186 → 1186 |
| expenses | 390 | 1078 → 906.094 | 1270 → 1270 |
| expenses | 768 | 1050 → 811.219 | 1119 → 1119 |
| expenses | 1440 | 844 → 844 | 844 → 844 |
| trips | 390 | 893 → 780 | 780 → 780 |
| trips | 768 | 865 → 796 | 796 → 796 |
| trips | 1440 | 869 → 844 | 844 → 844 |
| planning | 390 | 918 → 3402.5 | 3403 → 3403 |
| planning | 768 | 970 → 1424.11 | 1425 → 1425 |
| planning | 1440 | 844 → 1090.11 | 1091 → 1091 |
| tasks | 390 | 895 → 812 | 812 → 812 |
| tasks | 768 | 807 → 828 | 828 → 828 |
| tasks | 1440 | 844 → 844 | 844 → 844 |
| notes | 390 | 817 → 780 | 820 → 820 |
| notes | 768 | 796 → 796 | 796 → 796 |
| notes | 1440 | 844 → 1033.11 | 1034 → 1034 |

Con el fixture largo original a 390 px:
- dashboard: 1168 → 1748.5 px (delta +580.5).
- expenses: 1078 → 3920.09 px (delta +2842.09).

Regresión final: 108/108 PASS, delta máximo de main 0 px, cero shifts,
cero errores de navegador y cero diferencias de altura/posición por bloque.

## Gates ejecutados

Todos los comandos finales siguientes devolvieron **código de salida 0**.
El build usó exclusivamente el `.env.local` temporal con
`NEXT_PUBLIC_INSFORGE_URL=https://example.invalid` y
`NEXT_PUBLIC_INSFORGE_ANON_KEY=placeholder`. El fichero se eliminó después del
build. Storybook recibió esas mismas variables públicas en el entorno del proceso.

| Comando | Salida real relevante |
| --- | --- |
| `pnpm run type-check` | `$ tsc --noEmit` (sin diagnósticos) |
| `pnpm run lint` | `✖ 13 problems (0 errors, 13 warnings)` |
| `pnpm exec jest --runInBand --coverage=false` | `Test Suites: 71 passed, 71 total` · `Tests: 526 passed, 526 total` |
| `pnpm run build` | `○  (Static)  prerendered as static content` · `Generated out/_headers with 22 inline script hashes.` |
| `pnpm run validate:static-export` | `Validated 182 static files and 13 critical routes; no private key markers found.` |
| `pnpm run test:storybook` | `Test Files  11 passed (11)` · `Tests  57 passed (57)` |

Lint de referencia: también 13 warnings, 0 errores, salida 0. El primer intento de
Storybook dio 55 pruebas aprobadas y 1 fallida: la story `NextTrip.Empty` exigía
que el itinerario vacío midiese menos de 220 px. Esa condición anterior era
incompatible con reservar el mismo bloque al cargar y al resolver. Se sustituyó
por la aserción del mensaje vacío y se añadió `DashboardEmptyFidelity`, que exige
la misma geometría con datos vacíos. Se repitió la suite completa: 57/57 aprobadas.

Prueba inestable, comando exacto repetido 20 veces sin fallos:

```bash
pnpm exec jest src/components/trips/__tests__/FlightInspiration.test.tsx --runInBand --coverage=false
```

20/20 ejecuciones consecutivas, cada una con código 0, 1 suite y 12 pruebas
aprobadas. Las 20 salidas individuales están en `flight-20.txt`.

```text
pnpm exec jest --runInBand --coverage=false --detectOpenHandles
Test Suites: 71 passed, 71 total
Tests:       526 passed, 526 total
Snapshots:   0 total
Time:        52.046 s, estimated 54 s
Ran all test suites.
código de salida: 0
```

No se emitió aviso de handles abiertos. También se ejecutó el fichero específico
con `--detectOpenHandles`: 12/12 pruebas y salida 0.

```text
node docs/qa/audits/2026-10-21-fidelity/measure.mjs
108/108 PASS; delta máximo main: 0px; shifts: 0; errores navegador: 0
código de salida: 0
```

La segunda línea resume `after.json`, comprobado con Python. Después de corregir
el menú se repitió el dashboard con
`FIDELITY_SCREENS=dashboard node docs/qa/audits/2026-10-21-fidelity/measure.mjs`:
18/18 PASS, salida 0; datos en `after-review.json`.

## Revisión independiente y entrega

Informe final del subagente `reviewer`: **«Sin hallazgos. Revisado el diff final
completo. overflow: visible resuelve el recorte del menú y las nuevas aserciones
comprueban que JSON/PDF reciben clics. No aparecen otras regresiones concretas.»**

El fallo P2 inicial del menú se corrigió en un tercer contexto y se volvió a
revisar. `git diff --check` y `git diff --cached --check` terminaron con salida 0.
No hay cambios en `public/_headers`, `scripts/`, `src/app/profile/`, `package.json`
ni el lockfile. No se añadió ninguna dependencia ni servidor/ruta de backend.
Sin push, PR ni deploy.
