# Páginas legales y gestión de datos

Implementado y comprobado localmente el 22 de octubre de 2026, en el worktree
`legal-cuenta/travelpal`, rama `feat/legal-y-borrado`. Base `fceeec2`, coincidente con
`origin/main` tras `git fetch origin main` (salida 0). Sin push, PR ni despliegue.

## Implementación

- `/aviso-legal` y `/privacidad` son páginas del export estático, en español,
  con `PageTitle`, marca, footer y tokens Atlas existentes. No hay servidor,
  route handlers ni nuevas dependencias.
- Enlaces desde el footer de la landing y desde Ajustes.
- `src/lib/legal.ts` centraliza `TITULAR`, `CONTACTO`, `FECHA_ACTUALIZACION`
  e identificación/domicilio. Se conoce el nombre del responsable, persona física;
  NIF/domicilio, contacto y fecha de revisión quedan marcados explícitamente.
- La comprobación `legalPending` muestra un aviso visible y accesible en ambas
  páginas mientras haya marcadores. Se elige esta alternativa autorizada por el
  encargo para permitir verificar el export sin inventar datos ni romper los gates.
  El aviso dice expresamente que la información aún no es definitiva; no sustituye
  completar y validar estos datos antes de ofrecer el servicio con información legal definitiva.
- Los textos identifican finalidad/base jurídica por tratamiento, categorías,
  proveedores, conservación, derechos, AEPD y mecanismos técnicos del navegador.
  Contratos, transferencias, copias de seguridad y retenciones no acreditadas se
  marcan como pendientes; no se prometen plazos ni un DPO inexistente.

## Exportación

En Ajustes, «Exportar mis datos» genera `travelpal-datos-AAAA-MM-DD.json` en el
navegador. Consulta por SDK con sesión/RLS y filtro del usuario obtenido de auth,
sin aceptar un user_id desde la UI. Incluye identidad (sin tokens), `profiles`,
`trips`, `itinerary_activities`, `tasks`, `expenses`, `budgets`, `notes`,
`journal_entries`, `journal_photos`, `bookings` y `alerts`.

Lee todas las páginas de tablas (orden estable por id) y Storage; descarga los
objetos propios de `journal-photos` y `avatars` con el SDK y los incorpora como
Data URL/base64. Incluye también archivos propios huérfanos y avatares anteriores.
El listado se autoriza por RLS de `storage.objects`, no por un prefijo de key.
Los recursos externos como un avatar OAuth se conservan como URL; no se descargan
recursos arbitrarios de terceros. Si falla una lectura/descarga, no se entrega
un JSON parcial. El archivo completo se construye en memoria: una biblioteca de
fotos grande requiere memoria suficiente del dispositivo. No hay snapshot
transaccional entre consultas; conviene evitar cambios concurrentes al exportar.

## Supresión y hueco de auth

«Borrar mis datos» abre el diálogo existente y exige escribir exactamente
`ELIMINAR`, tanto en UI como en la función del flujo. Bloquea dobles operaciones
simultáneas en esta pantalla. Se informa antes de confirmar de que no es una baja
definitiva de la identidad de acceso.

Orden: comprobar sesión y lecturas; listar y borrar objetos propios de
`journal-photos` y `avatars`; borrar filas hijas; borrar `trips`; borrar `profiles`;
verificar por lectura que cada tabla queda vacía; cerrar sesión con el SDK. La
navegación completa lleva a `/privacidad#conservacion`, cuyo texto explica la
identidad pendiente. No se almacena un marcador de resultado en localStorage.
Un error detiene el flujo y se informa: no se simula una transacción entre Storage
y tablas. Puede quedar borrado parcial, reintentable; cerrar otras pestañas reduce
escrituras concurrentes pero no constituye un bloqueo de cuenta en backend.

### Inspección del SDK instalado

`@insforge/sdk` instalado: 1.5.2 (lockfile y package instalado).
`node_modules/@insforge/sdk/dist/client-DZHoCptg.d.ts:237-405` declara `Auth`;
la implementación en `dist/index.js` y sus declaraciones no tienen método de
auto-borrado. La búsqueda ejecutada:

```text
rg -n 'deleteUser|deleteAccount' node_modules/@insforge/sdk/dist/index.js node_modules/@insforge/sdk/dist/client-DZHoCptg.d.ts
(sin coincidencias; código 1)
```

Se usa `auth.signOut()`, sin inventar métodos ni introducir una clave administrativa.
Email, identificador y perfil de autenticación permanecen hasta que el responsable
complete la supresión. No se probó ni ejecutó borrado real de datos en producción.

### Política de profiles pendiente de aplicar

La base existente tiene SELECT/INSERT/UPDATE para `profiles`, pero no DELETE.
Se añade `migrations/20261022120000_allow-profile-owner-delete.sql`: DELETE solo
para authenticated cuando `auth.uid() = id`. La migración **no se ha aplicado a
InsForge**. Debe pasar por el proceso de migraciones antes de usar el flujo contra
ese backend. Sin ella, PostgREST puede devolver un DELETE sin error y cero filas:
la relectura detecta el perfil restante, muestra error de borrado incompleto y no
cierra sesión como si hubiera terminado. La migración está probada localmente.

### Edge function necesaria para una baja definitiva

Hace falta una función autenticada de InsForge que valide el JWT y derive su
`sub` en backend (nunca acepte el id de otro usuario como autorización), y que use
credenciales privilegiadas exclusivamente en el entorno de la función. Debe:

1. Requerir confirmación y una autenticación reciente para la operación destructiva.
2. Impedir nuevas escrituras del usuario durante la baja y ejecutar una limpieza
   idempotente de objetos propios, incluidos huérfanos y avatares antiguos.
3. Eliminar las filas y `auth.users` de ese mismo `sub` mediante una operación
   administrativa soportada por la versión del backend, verificando cascadas,
   revocación de sesiones/tokens y suscripciones OAuth que correspondan.
4. Registrar el estado mínimo necesario para reintentar fallos sin retener contenido
   borrado, y devolver un resultado verificable de baja completa al cliente.
5. Definir el tratamiento de logs y copias de seguridad, y documentarlo en privacidad.

No se inventa un endpoint administrativo: su contrato debe comprobarse contra el
backend antes de implementar la función. La app seguirá siendo estática y la
función se invocaría por el SDK. Esta función no está implementada en este encargo,
conforme a la alternativa explícita del usuario cuando el SDK carece de auto-borrado.

## Cookies y fuentes

No se añade banner: la app no tiene analítica ni cookies de seguimiento; `theme`
es una preferencia de apariencia elegida en localStorage. El SDK sí utiliza cookies
técnicas de sesión, por lo que los textos no afirman que no exista ninguna cookie.
La exención se limita a estos usos; debe revisarse si cambian.

Fuentes primarias consultadas el 22 de octubre de 2026:
[guía de cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf),
[derechos](https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos),
[derecho de información](https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion)
y [portabilidad](https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-la-portabilidad).
Se verificó la guía local de export estático de Next en
`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`.

## Pruebas y gates

Baseline antes de implementación: Jest, 73 suites y 548 pruebas pasan; lint,
0 errores y 13 avisos. Se instalaron las dependencias del lockfile con
`pnpm install --frozen-lockfile` (código 0); no se cambió el lockfile.
El sandbox impidió descargas y la captura de `tsc --showConfig` por Next/Jest;
las ejecuciones verificadas se hicieron con permisos de ejecución ampliados.

Entorno temporal usado para los gates:

```dotenv
NEXT_PUBLIC_INSFORGE_URL=https://sjdq7zsn.eu-central.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=placeholder
```

No se usan credenciales reales para los tests ni para compilar. `.env.local` se
retira al terminar; no se incorpora al commit.

Salidas finales reales:

```text
$ pnpm run type-check
$ tsc --noEmit
EXIT_CODE=0

$ pnpm run lint
✖ 13 problems (0 errors, 13 warnings)
EXIT_CODE=0

$ pnpm exec jest --runInBand --coverage=false
Test Suites: 76 passed, 76 total
Tests:       560 passed, 560 total
Snapshots:   0 total
EXIT_CODE=0

$ pnpm run build
✓ Compiled successfully in 457ms
○  (Static)  prerendered as static content
Generated out/_headers with 24 inline script hashes.
EXIT_CODE=0

$ pnpm run validate:static-export
Validated 193 static files and 13 critical routes; no private key markers found.
EXIT_CODE=0

$ pnpm run test:storybook
Test Files  13 passed (13)
Tests  63 passed (63)
EXIT_CODE=0
```

El build ejecuta el generador existente de `out/_headers`; no se modifican
`public/_headers` ni `scripts/`. Los 13 avisos de lint son los mismos del baseline.
Jest conserva mensajes de consola de pruebas existentes que simulan fallos.

Se detectaron y resolvieron durante la verificación: tipo opcional del mock en
TypeScript; rol ARIA inválido en el primer aviso; constante de bucket ausente en
el mock global de Storybook. Se repitieron los gates afectados completos.

Las pruebas nuevas son 12: ocho del SDK mockeado (exportación paginada y archivos,
confirmación exacta, orden, fallos de lectura/Storage/tablas/política/logout), dos
de controles UI y dos de RLS. El contrato ejecuta las políticas del repo en
Postgres embebido (PGlite), role authenticated y dos usuarios: DELETE ajeno devuelve
cero filas; DELETE sin filtro borra solo datos propios; tras cambiar al segundo
usuario sus filas siguen presentes en las 11 tablas y Storage.
Esto verifica el SQL del repositorio, no el estado de las políticas desplegadas.

## Inspección visual y revisión independiente

Storybook ejecuta las historias legales claras/oscuras, controles de datos y
confirmación escrita en Chromium, con axe sin infracciones. Las páginas exportadas
se sirvieron en localhost y se capturaron con Playwright a 1440px claro y 390px
oscuro: sin desbordamiento horizontal; aviso de datos pendientes visible en ambas
rutas. Se abrieron las capturas para comprobar marca, jerarquía, espaciado, texto
y enlaces. También se abrió la captura del diálogo de borrado a 390px:
texto legible, campo etiquetado y confirmación deshabilitada antes de escribir.
No equivale a una prueba de baja contra el backend real.

Revisor independiente `reviewer`, contexto separado y read-only: **«Sin hallazgos»**.
Su ejecución independiente:

```text
$ pnpm exec jest --runInBand --coverage=false src/lib/__tests__/account-data.test.ts src/lib/__tests__/account-delete-rls.test.ts src/components/settings/__tests__/AccountDataControls.test.tsx
Test Suites: 3 passed, 3 total
Tests:       12 passed, 12 total
Código de salida: 0
```

Su riesgo residual: no se ha verificado integración completa contra InsForge ni
navegación real tras borrar. Marcadores y permanencia de la identidad de auth son
limitaciones explícitas. No hay hallazgos con rutas/líneas que corregir.
