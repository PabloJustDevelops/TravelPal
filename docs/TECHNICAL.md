# 🛠️ Documentación Técnica

> Guía técnica y configuración de TravelPal (repo `PabloJustDevelops/TravelPal`).

Para el contexto de dominio y el modelo de datos, ver [CONTEXT.md](../CONTEXT.md). Para la
arquitectura, [ARCHITECTURE.md](./ARCHITECTURE.md). Para las decisiones, [DECISIONS/](./DECISIONS/).

---

## Requisitos

| Componente | Versión | Descripción |
|------------|---------|-------------|
| Node.js | 22.22.3+ o 24.8+ | CI fija 22.22.3; requerido por Tester Army |
| pnpm | 12.3.4 | Gestor de paquetes (repo con `pnpm-lock.yaml`) |
| Proyecto InsForge | - | Postgres + Auth + Storage |

---

## Dependencias principales

- `next` 16.3.8, `react`/`react-dom` 19
- `@insforge/sdk` (datos, auth, storage)
- `wrangler` para servir y publicar el export estático en Cloudflare Workers Assets
- `@opennextjs/cloudflare` permanece como dependencia de desarrollo/configuración heredada, pero
  no interviene en `build`, `preview` ni en la publicación actual
- `typescript`, `eslint`, `jest` + Testing Library

Consulta `package.json` para las versiones exactas.

---

## Instalación

```bash
git clone https://github.com/PabloJustDevelops/TravelPal.git
cd TravelPal
pnpm install --frozen-lockfile
cp .env.example .env.local   # y rellena los valores
pnpm run dev
```

La app queda en `http://localhost:3000`.

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `pnpm run dev` | Servidor de desarrollo |
| `pnpm run lint` | ESLint |
| `pnpm run type-check` | `tsc --noEmit` |
| `pnpm run test:ci` | Jest (CI) |
| `pnpm run test:e2e` | Playwright: flujos con datos |
| `pnpm run test:tester` | Tester Army: acceso público en dos viewports |
| `pnpm run build` | `next build`; `next.config.js` exporta el sitio estático en `out/` |
| `pnpm run validate:static-export` | Comprueba las rutas y assets críticos del export y que no incluya claves privadas |
| `pnpm run check:headers` | Comprueba CSP efectiva, hashes inline y las siete cabeceras globales de `out/_headers` |
| `pnpm run preview` | `wrangler dev`; sirve el `out/` existente, no lo construye |
| `pnpm run deploy` | Ejecuta build, validación y `wrangler deploy --no-autoconfig` |
| `pnpm run upload` | Ejecuta build, validación y el dry-run de Wrangler; no publica |

Para una vista previa local, ejecuta `pnpm run build`, `pnpm run validate:static-export` y después
`pnpm run preview`. La configuración `wrangler.jsonc` solo apunta el binding de assets al directorio
`out/`; no define un entrypoint de aplicación.

### Cabeceras de seguridad

`public/_headers` contiene la política base y HSTS. Tras `next build`,
`scripts/build-security-headers.mjs` añade a `out/_headers` los hashes SHA-256 de todos los
scripts inline del HTML exportado (incluidos tema e hidratación). No se permite `unsafe-inline`
ni `unsafe-eval` en scripts; Zod usa `jitless` en `src/lib/public-env.ts` para evitar generación
dinámica de código. `style-src` permite estilos inline y `img-src https:` mantiene los avatares
con URL externa. No se habilitan `data:` ni `blob:` para recursos sin usos que los necesiten.

El generador carga el entorno con `@next/env` en modo producción, igual que Next: considera
`.env.production.local`, `.env.local`, `.env.production` y `.env`, y expande referencias entre
variables. Las variables ya exportadas conservan prioridad. Así, `connect-src` usa el mismo valor
de `NEXT_PUBLIC_INSFORGE_URL` que el cliente compilado. Sin variable usa el host de producción
declarado en la plantilla. Por ello el build de prueba con `https://example.invalid` no altera la
política de producción ni necesita excepciones permanentes para pruebas.

Después de construir, ejecuta `pnpm run check:headers`. Falla si falta una cabecera global,
si CSP vuelve a Report-Only, si permite scripts arbitrarios, si faltan hashes del HTML actual o
si una línea supera los 2.000 caracteres admitidos por Cloudflare. Si el sitio crece y alcanza ese
límite, habrá que dividir la política por rutas; no se degrada automáticamente a `unsafe-inline`.
No publiques el `_headers` sin procesar de `public/`: usa siempre el `out/` del build completo.

Para comprobarlo con navegador sin backend real:

```bash
pnpm exec wrangler dev --ip 127.0.0.1 --port 8791 --inspector-port 9291
# En otra terminal, con Chromium de Playwright instalado:
node scripts/test-security-csp.mjs http://127.0.0.1:8791
```

La prueba recoge consola, peticiones fallidas y eventos `securitypolicyviolation` en `/`,
`/signin`, `/travel-inspiration` y `/dashboard`; también comprueba la validación del formulario
para confirmar hidratación. Con el backend ficticio se esperan errores DNS, no infracciones CSP.
El informe inicial y las limitaciones están en [cabeceras-2026-10-20.md](security/cabeceras-2026-10-20.md).

---

## Variables de entorno

`.env.local` (nunca se versiona):

```bash
# InsForge (obligatorias)
NEXT_PUBLIC_INSFORGE_URL=https://<appkey>.<region>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<anon key>

# Requerida por la validación de entorno de pnpm run dev; no se incluye en el export
INSFORGE_API_KEY=<api key>

# Logging (opcional): debug | info | warn | error
NEXT_PUBLIC_LOG_LEVEL=info

```

`NEXT_PUBLIC_*` se incorporan al export durante el build. `pnpm run dev` carga `src/lib/env.ts` a
través de `src/instrumentation.ts`, por lo que requiere `INSFORGE_API_KEY`; el build estático y el
Worker no la necesitan ni la reciben. La publicación de CI usa `CLOUDFLARE_API_TOKEN`; el build
solo recibe las dos variables públicas de InsForge.

---

## Estructura

```
src/
├── app/                    # App Router: páginas exportables como archivos estáticos
├── components/             # UI por dominio + ui/ base
├── contexts/               # AuthContext, ThemeContext
└── lib/
    ├── insforge.ts         # Cliente de navegador (createInsforgeClient)
    ├── auth.ts             # AuthService
    ├── public-env.ts       # Validación de variables públicas
    └── env.ts              # Validación del secreto para utilidades administrativas locales
migrations/                 # Esquema InsForge (fuente de verdad)
```

---

## Testing y calidad

- Jest + React Testing Library; tests en `__tests__/` o `*.test.ts(x)`.
- Configuración: `jest.config.js`, `jest.setup.js`.
- ESLint: `eslint.config.mjs`.
- CI: `.github/workflows/ci.yml` (lint, type-check, tests, export estático, validación y dry-run de Wrangler).

En un PR, `build` valida el export y publica `out/` como artefacto; `worker` descarga ese mismo
artefacto, lo valida y ejecuta `wrangler deploy --dry-run --no-autoconfig`; `e2e` prueba el export
antes del deploy. En pushes a `main`, `deploy` espera a esos tres gates y publica el artefacto con
`wrangler deploy --no-autoconfig`. `e2e-produccion` vuelve a ejecutar las suites después de publicar.
Cloudflare Workers Builds no se usa: GitHub Actions es la única vía de publicación.

---

## Solución de problemas

### Error de instalación de dependencias
```bash
pnpm install --frozen-lockfile
```

### Error de variables de entorno
- Verifica que `.env.local` existe y tiene los valores correctos.
- Reinicia el servidor de desarrollo tras cambiar variables.

### Wrangler no puede servir la vista previa
- Comprueba que `out/` exista y sea reciente: `pnpm run preview` no compila el sitio.
- Ejecuta `pnpm run build` y `pnpm run validate:static-export`, y vuelve a iniciar `pnpm run preview`.
- Para publicar manualmente, autentica Wrangler y ejecuta `pnpm run deploy`.
