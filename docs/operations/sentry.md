# Sentry del navegador

TravelPal es un export estático de Next.js servido como assets-only Worker. Se usa
`@sentry/browser` 10.76.2, sin SDK de servidor, route handlers, túnel ni
`withSentryConfig`. `SentryInit` inicializa al evaluar el módulo cliente, antes del
primer render de React. `ErrorBoundary` y los eventos globales `error` y
`unhandledrejection` usan la misma captura. Un `WeakMap` evita enviar dos veces
el mismo objeto de error; el fallback muestra su `event_id`, incluso con un
fallback personalizado. Sin envío habilitado no se muestra una referencia ficticia.
Errores primitivos distintos no tienen identidad de objeto para deduplicarse.

## Privacidad

`sendDefaultPii: false`. No hay integraciones automáticas: ni breadcrumbs, sesiones,
replay, logs, métricas ni instrumentación de fetch/XHR o rendimiento. El muestreo
configurado queda disponible para instrumentación explícita futura; actualmente
`beforeSendTransaction` descarta todas las transacciones.

`beforeSend` reconstruye el evento con una lista permitida: ID, fecha, plataforma,
nivel, release, entorno, URL sin query/fragmento/credenciales, tipo de excepción y
ubicaciones de stack (archivo sin query, función, línea, columna, `in_app`).
Se conserva el mensaje de la excepción, que es lo que hace legible un issue, pero
saneado en el navegador: se sustituyen emails, `Bearer`, claves `sk_`/`pk_`/`rk_`,
tokens `sntry…`, JWT y secuencias de 9 o más dígitos por `[email]`, `[token]` o
`[num]`; se colapsan los espacios y se recorta a 200 caracteres. Si tras el saneado
queda vacío, se envía `Exception details omitted`. Se eliminan mensajes libres del
evento, variables de stack, contexto de aplicación, extras, breadcrumbs, cabeceras
(incluidas Authorization/Cookie), cuerpos y datos del usuario.
El único usuario enviado es `anon-<UUID>` generado en memoria por carga de página:
no es email, ID de InsForge ni una identidad persistente. La ruta permanece visible;
no añadas datos privados al pathname ni a nombres de funciones/tipos de excepción.
Sentry recibe además los metadatos de red inherentes al transporte HTTP; configura
la retención y el filtrado de IP en la cuenta del propietario.

El mensaje es el único texto libre que sale del navegador: si escribes un error con
datos del usuario dentro del `Error(...)`, acabarán en Sentry salvo que encajen en
los patrones anteriores. No metas nombres, direcciones ni contenido de notas en los
mensajes de error.

## Variables y CI

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN público de navegador, fijado durante build. Vacío: no inicializa, no instala handlers y no captura. Variable de repositorio GitHub `NEXT_PUBLIC_SENTRY_DSN` (no secret). |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Opcional; por defecto `production`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Opcional, entre 0 y 0.05; por defecto 0.01. No activa instrumentación automática. |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Lo calcula `next.config.js`: `GITHUB_SHA` válido o `git rev-parse HEAD`. Sin metadatos Git no se declara release. No introducir un valor inventado. |
| `SENTRY_AUTH_TOKEN` | Secreto GitHub exclusivo de los pasos build/mapas. Nunca público ni en el Worker. Su ausencia omite generación/subida de mapas. |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Variables GitHub opcionales para sobrescribir los slugs; CI usa `pabloorgs` / `travelpal` por defecto. El script de subida necesita ambos valores en su entorno. |

Cuenta/proyecto ya creados y verificados por el propietario: organización `pabloorgs`,
región `de`, proyecto `travelpal`, plataforma `javascript-nextjs`. DSN público:

```text
https://bb04fbea9212639a4cb2ab52d3a39540@o4511064837062656.ingest.de.sentry.io/4512299836047440
```

El DSN se consume desde `process.env.NEXT_PUBLIC_SENTRY_DSN` durante el build;
CI lo toma de `vars.NEXT_PUBLIC_SENTRY_DSN`, ya creada por el propietario.
El único origen permitido por la validación del DSN y exigido por la CSP es
`https://o4511064837062656.ingest.de.sentry.io`. No se permiten wildcards.
El propietario debe provisionar el secreto CI `SENTRY_AUTH_TOKEN` con permiso de
subida de artefactos (`org:ci` según Sentry). Este token de escritura es **distinto**
del token de lectura para agentes.

Solo con `CI=true` y token, Next genera mapas de navegador. Después del build, CI
ejecuta `node scripts/sentry-sourcemaps.mjs`: sin token informa y omite la subida;
con token exige org/proyecto/SHA/mapas y ejecuta:

```bash
pnpm exec sentry-cli sourcemaps upload --release "$GITHUB_SHA" \
  --url-prefix '~/_next/static' --validate out/_next/static
```

La asociación usa release + URL; no se inyectan debug IDs que alteren assets con
hash e immutable cache. El script elimina todos los `.map` de `out/` en `finally`,
incluso si la subida falla. CI falla si falla la subida y no entrega ese artefacto.
La validación y el artefacto consumidos por worker/e2e/deploy van después de esa
limpieza. No se añade otra vía de publicación. Fuera de CI no se generan mapas. Al probar varios builds, detener y reiniciar
`wrangler dev` después de cada build: el watcher puede conservar temporalmente
la plantilla `_headers` que Next copia antes de generar los hashes finales.

## CSP

`public/_headers` declara `https://o4511064837062656.ingest.de.sentry.io`
exclusivamente en `connect-src`. El generador mantiene esa fuente y añade los hashes
inline del export. El checker exige el host exacto y rechaza `*`, esquemas como
`https:`/`wss:`, `https://*` y cualquier subdominio wildcard, incluidos los patrones
Sentry genérico y alemán. No se permite código inline adicional ni scripts remotos.

## Acceso de agentes: MCP oficial de solo lectura

Servidor oficial: <https://mcp.sentry.dev/mcp>. El propietario crea un token personal
Sentry con **solo** `org:read`, `project:read`, `team:read`, `event:read` y acceso al
proyecto necesario. Nunca dar `event:write`, `project:write`, `org:write` ni el token
de CI a un agente. La cuenta del token también debe tener acceso limitado.
La opción `skills=inspect` expone herramientas de inspección; la restricción real
se refuerza con los scopes del token. No habilitar `triage` ni `project-management`.

El endpoint remoto distingue `Sentry-Bearer` (token Sentry explícito) de `Bearer`
(token MCP OAuth), según el [toolkit oficial](https://github.com/getsentry/toolkit#sentry-mcp).
El propietario provisiona las variables fuera del repositorio y de los mensajes
a agentes. No copiar un token real a estos ejemplos ni a Git.

Hermes, `~/.hermes/config.yaml`, sección `mcp_servers`: este objeto JSON exacto es
también YAML válido; fusionar la sección con las conexiones existentes:

```json
{
  "mcp_servers": {
    "sentry": {
      "url": "https://mcp.sentry.dev/mcp?skills=inspect",
      "headers": { "Authorization": "Sentry-Bearer ${SENTRY_ACCESS_TOKEN}" }
    }
  }
}
```

`SENTRY_ACCESS_TOKEN` contiene solo el token de lectura. Hermes admite interpolación
`${VAR}` en cabeceras: [referencia de configuración](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md#environment-variable-references).

Codex, `~/.codex/config.toml`:

```toml
[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp?skills=inspect"
env_http_headers = { Authorization = "SENTRY_MCP_AUTH" }
```

`SENTRY_MCP_AUTH` contiene la cabecera completa `Sentry-Bearer <token-de-lectura>`;
la [documentación oficial de Codex](https://developers.openai.com/codex/mcp) describe
`env_http_headers`. La URL es literal, sin interpolación de slugs. Estos fragmentos
son documentación: este cambio no modifica `~/.hermes` ni `~/.codex`.
La conexión autenticada queda pendiente de que el propietario provisione el token.

Ejemplos de peticiones al agente conectado (sustituir slugs/SHA/URL/UUID reales):

- «En travelpal, busca issues sin resolver de la release `<SHA real>`; muestra ID, ruta y stack». Filtro Sentry: `is:unresolved release:<SHA>`.
- «Busca errores cuyos eventos tengan URL `https://travelpal.prg-dev.workers.dev/trip` en las últimas 24 horas». Filtro: `url:"https://travelpal.prg-dev.workers.dev/trip"`.
- «Busca eventos del usuario anónimo `anon-<UUID>` y agrúpalos por issue». Filtro: `user.id:anon-<UUID>`. No buscar por email ni ID de InsForge: no se envían.
- «Busca el evento con la referencia visible `<event_id>` y muestra su release y stack». Solo consultar; no resolver, asignar ni comentar issues.

Con `sentry-cli` instalado en este repo (3.8.1), el propietario puede provisionar
`SENTRY_AUTH_TOKEN` **de lectura** para consultas en su entorno, además de
`SENTRY_ORG` y `SENTRY_PROJECT`, y ejecutar:

```bash
pnpm exec sentry-cli issues list --query 'is:unresolved release:<SHA-real>'
pnpm exec sentry-cli issues list --query 'url:"https://travelpal.prg-dev.workers.dev/trip"'
pnpm exec sentry-cli issues list --query 'user.id:anon-<UUID>'
```

La sintaxis se comprobó con `pnpm exec sentry-cli issues list --help`; las consultas
remotas requieren la cuenta y token del propietario. Nunca usar el token de subida
para estas consultas de agentes.

## Referencias de implementación

- Docs instaladas Next 16.3.8: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, `environment-variables.md` y `01-app/03-api-reference/05-config/01-next-config-js/productionBrowserSourceMaps.md`.
- README y declaraciones instaladas: `node_modules/@sentry/browser/README.md`, `build/npm/types/sdk.d.ts`, `build/npm/types/exports.d.ts`.
- [SDK browser exacto 10.76.2](https://github.com/getsentry/sentry-javascript/blob/10.76.2/packages/browser/src/sdk.ts): sin integraciones por defecto tampoco instala global handlers ni BrowserSession; aquí los handlers son propios.
- [Privacidad/configuración de JavaScript](https://docs.sentry.io/platforms/javascript/configuration/options/), [Next SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [permisos API](https://docs.sentry.io/api/permissions/).
