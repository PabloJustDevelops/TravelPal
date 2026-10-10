# 🛠️ Documentación Técnica

> Guía técnica y configuración de TravelPal (repo `app-viajes`).

Para el contexto de dominio y el modelo de datos, ver [CONTEXT.md](../CONTEXT.md). Para la
arquitectura, [ARCHITECTURE.md](./ARCHITECTURE.md). Para las decisiones, [DECISIONS/](./DECISIONS/).

---

## Requisitos

| Componente | Versión | Descripción |
|------------|---------|-------------|
| Node.js | 22.22.3+ o 24.8+ | CI fija 22.22.3; requerido por Tester Army |
| npm | 10+ | Gestor de paquetes (repo con `package-lock.json`) |
| Proyecto InsForge | - | Postgres + Auth + Storage |

---

## Dependencias principales

- `next` 16.3.8, `react`/`react-dom` 19
- `@insforge/sdk` (datos, auth, storage)
- `@opennextjs/cloudflare` + `wrangler` (dev) para el hosting
- `typescript`, `eslint`, `jest` + Testing Library

Consulta `package.json` para las versiones exactas.

---

## Instalación

```bash
git clone https://github.com/PabloJustDevelops/TravelPal.git
cd TravelPal
npm ci
cp .env.example .env.local   # y rellena los valores
npm run dev
```

La app queda en `http://localhost:3000`.

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test:ci` | Jest (CI) |
| `npm run test:e2e` | Playwright: flujos con datos |
| `npm run test:tester` | Tester Army: acceso público en dos viewports |
| `npm run build` | `next build` |
| `npm run preview` | Build de OpenNext + `wrangler dev` local |
| `npm run deploy` | Build de OpenNext + deploy a Cloudflare |

---

## Variables de entorno

`.env.local` (nunca se versiona):

```bash
# InsForge (obligatorias)
NEXT_PUBLIC_INSFORGE_URL=https://<appkey>.<region>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<anon key>

# Solo servidor: secreto de proyecto (acceso admin)
INSFORGE_API_KEY=<api key>

# Logging (opcional): debug | info | warn | error
NEXT_PUBLIC_LOG_LEVEL=info

```

`NEXT_PUBLIC_*` se inlinean en el bundle del cliente. `INSFORGE_API_KEY` es un secreto de
servidor: en Cloudflare se sube con `wrangler secret put INSFORGE_API_KEY`.

---

## Estructura

```
src/
├── app/                    # App Router: páginas y API routes
├── components/             # UI por dominio + ui/ base
├── contexts/               # AuthContext, ThemeContext
└── lib/
    ├── insforge.ts         # Cliente de navegador (createInsforgeClient)
    ├── insforge/server.ts  # cliente de servidor (createServerInsforgeClient)
    ├── insforge/auth-actions.ts  # Server actions de auth
    ├── auth.ts             # AuthService
    ├── public-env.ts       # Validación de variables públicas
    └── env.ts              # Validación de secretos de servidor
migrations/                 # Esquema InsForge (fuente de verdad)
```

---

## Testing y calidad

- Jest + React Testing Library; tests en `__tests__/` o `*.test.ts(x)`.
- Configuración: `jest.config.js`, `jest.setup.js`.
- ESLint: `eslint.config.mjs`.
- CI: `.github/workflows/ci.yml` (lint, type-check, tests, build y build del Worker).

---

## Solución de problemas

### Error de instalación de dependencias
```bash
npm ci
```

### Error de variables de entorno
- Verifica que `.env.local` existe y tiene los valores correctos.
- Reinicia el servidor de desarrollo tras cambiar variables.

### La app no arranca en Cloudflare
- Recuerda que `INSFORGE_API_KEY` debe existir como secreto de runtime.
- `npm run preview` reproduce el runtime de Workers en local.
