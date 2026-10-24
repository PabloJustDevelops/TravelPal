<div align="center">

<img src="src/app/icon.svg" alt="TravelPal" width="112" />

# TravelPal

**Planifica el viaje entero en un solo sitio**: itinerario, tareas, reservas, notas, gastos y presupuesto.

[![CI](https://github.com/PabloJustDevelops/TravelPal/actions/workflows/ci.yml/badge.svg)](https://github.com/PabloJustDevelops/TravelPal/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![InsForge](https://img.shields.io/badge/InsForge-Backend-4B5563)](https://insforge.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

[**Demo**](https://travelpal.prg-dev.workers.dev) · [Documentación](#documentación) · [Reportar un problema](https://github.com/PabloJustDevelops/TravelPal/issues)

</div>

## Qué es

TravelPal es una app de viajes donde cada persona
organiza sus viajes de principio a fin — itinerario por días, tareas antes de salir, reservas,
notas con fotos, gastos por categoría y presupuesto — con autenticación real, datos aislados por
usuario mediante RLS y una interfaz accesible, en claro y oscuro, de móvil a escritorio.

La app publicada es la demo: <https://travelpal.prg-dev.workers.dev>

## Cómo funciona

```text
Navegador (export estático de Next.js)
   │  @insforge/sdk  ← sesión + consultas con RLS
   ▼
InsForge (Postgres + Auth + Storage, eu-central)
   ▲
   │  función de InsForge `travel-inspiration` (token del proveedor como secreto)
   └─ Travelpayouts / Aviasales Data API
```

- **Producción no ejecuta un servidor Next.js.** `next build` genera un export estático (`out/`) y
  un Worker de Cloudflare sirve solo esos assets. No hay route handlers ni claves privadas en el
  Worker; lo verifica `pnpm run validate:static-export` antes de publicar.
- **El navegador es el único camino de datos.** Las páginas leen y escriben con el SDK de InsForge y
  las políticas RLS deciden qué ve cada usuario (ADR-009).
- **Las integraciones externas viven en funciones de InsForge.** El token de Travelpayouts nunca
  llega al cliente: se guarda como secreto de la función `travel-inspiration` y esta valida la
  sesión antes de consultar al proveedor (ADR-015).

## Estado

| Área | Estado |
| --- | --- |
| Viajes, itinerario, reservas, diario y fotos | Funcionando |
| Tareas, notas, gastos y presupuesto | Funcionando |
| Autenticación (contraseña, verificación por correo, Google) | Funcionando |
| Dashboard, accesibilidad y temas claro/oscuro | Funcionando |
| Inspiración de vuelos (Travelpayouts) | Operativa: función desplegada en InsForge, token del proveedor como secreto y verificada con respuestas reales de la API ([detalles](docs/TRAVEL_INSPIRATION.md)) |
| Push de navegador | Cliente y función `send-push` desplegados; falta verificar la entrega en un dispositivo real ([ADR-013](docs/DECISIONS/ADR-013-push-de-navegador-solo-cliente.md)) |
| App móvil nativa | No empezada |

## Características

- **Viajes**: alta guiada, fechas, destino, viajeros, presupuesto inicial y portada.
- **Itinerario**: actividades por día con categorías, coste y reordenado accesible.
- **Tareas**: lista por estado y tablero, con persistencia real.
- **Notas**: dos paneles, favoritos y protección de borradores sin guardar.
- **Gastos y presupuesto**: varias monedas sin mezclar totales, categorías, filtros y recibos.
- **Reservas**: vuelos, alojamiento y transporte junto a las fechas del viaje.
- **Inspiración de vuelos**: ideas de precio desde caché de Aviasales, con enlace al buscador y
  handoff a la creación del viaje.
- **Accesibilidad**: contraste, foco visible, controles de 44 px, `prefers-reduced-motion` y axe en
  los flujos principales.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 16 (App Router, export estático), React 19, TypeScript 5 |
| Estilos | Tailwind CSS 4, Headless UI, Heroicons |
| Backend | InsForge: Postgres, Auth, Storage y Edge Functions (Deno) |
| Hosting | Cloudflare Workers (assets) + Wrangler |
| Datos y gráficas | `@insforge/sdk`, Recharts, `react-calendar`, `dnd-kit` |
| Tests | Jest + Testing Library, Playwright, axe, Deno test (funciones) |
| CI/CD | GitHub Actions: puertas en PR; deploy y E2E en producción al mergear a `main` |

## Puesta en marcha

Requisitos: **Node 22.22.3+**, **pnpm 12.3.4** (fijado en `package.json`) y un proyecto de InsForge.

```bash
git clone https://github.com/PabloJustDevelops/TravelPal.git
cd TravelPal
pnpm install --frozen-lockfile
cp .env.example .env.local   # y rellena las claves
pnpm run dev                 # http://localhost:3000
```

Variables de `.env.local` (nunca se versionan):

```bash
NEXT_PUBLIC_INSFORGE_URL=https://<clave>.<región>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<clave anónima pública>
INSFORGE_API_KEY=<clave de proyecto, solo servidor>
```

`INSFORGE_API_KEY` solo la usa el hook de instrumentación en desarrollo; el export estático y el
Worker de producción no la reciben.

### Scripts

| Comando | Para qué |
| --- | --- |
| `pnpm run dev` | Desarrollo con Turbopack |
| `pnpm run lint` · `pnpm run type-check` | ESLint y TypeScript |
| `pnpm run test` · `pnpm run test:ci` | Jest completo (con cobertura) |
| `pnpm run test:e2e` | Playwright (ver [docs/TESTING.md](docs/TESTING.md)) |
| `pnpm run test:tester` | Tester Army: acceso público, escritorio y viewport estrecho |
| `pnpm run storybook` · `pnpm run test:storybook` | Catálogo de componentes y sus interacciones con axe |
| `pnpm run build` | Export estático en `out/` |
| `pnpm run validate:static-export` | Valida rutas críticas, redirecciones y ausencia de claves |
| `pnpm run preview` · `pnpm run deploy` | Servir el export en local · publicar con Wrangler |

### Despliegue

`pnpm run deploy` recompila, valida `out/` y publica con Wrangler (requiere `wrangler login`, o
`CLOUDFLARE_API_TOKEN` en CI). El despliegue automático es el trabajo `deploy` de
`.github/workflows/ci.yml`: solo en push a `main`, después de que pasen `build`, `worker-build` y `e2e`.

## Estructura

```text
TravelPal/
├── src/
│   ├── app/                # Rutas del App Router (todas exportables)
│   ├── components/         # UI y componentes por dominio
│   ├── contexts/ hooks/    # Sesión, tema, notificaciones, hooks compartidos
│   └── lib/                # SDK de InsForge, consultas, logger, utilidades
├── insforge/functions/     # Edge functions (inspiración de vuelos)
├── migrations/             # Esquema SQL: la fuente de verdad del backend
├── e2e/ · tests/           # Playwright y suites complementarias
├── scripts/                # Validación del export estático
├── docs/                   # Arquitectura, ADRs, testing y procesos
├── wrangler.jsonc          # Worker de assets
└── CONTEXT.md · DESIGN.md · AGENTS.md · STATUS.md
```

## Documentación

- [CONTEXT.md](CONTEXT.md): contexto de dominio, modelo de datos y glosario.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitectura y flujo de datos.
- [docs/DECISIONS/](docs/DECISIONS/): ADRs (InsForge, hospedaje estático, caminos de datos, push).
- [docs/TECHNICAL.md](docs/TECHNICAL.md): guía técnica y configuración.
- [docs/TESTING.md](docs/TESTING.md) · [docs/TESTER-ARMY.md](docs/TESTER-ARMY.md): cómo se prueba.
- [docs/TRAVEL_INSPIRATION.md](docs/TRAVEL_INSPIRATION.md): alta y operación de la inspiración de vuelos.
- [docs/DESIGN-DIRECTIONS.md](docs/DESIGN-DIRECTIONS.md) · [DESIGN.md](DESIGN.md): dirección visual.
- [docs/design/logo/proposals/](docs/design/logo/proposals/): las seis propuestas de marca; la ligadura TP es la elegida.
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) · [docs/COMMITS.md](docs/COMMITS.md) · [docs/PR_PROCESS.md](docs/PR_PROCESS.md): cómo contribuir.

## Roadmap

- Internacionalización (i18n) y detección de idioma en el export estático.
- Colaboración en un mismo viaje (invitaciones y permisos).
- Más fuentes de precios y transporte (tren, bus) sobre el patrón de funciones de InsForge.
- App móvil nativa.

## Contribuir

1. Crea una rama desde `main`.
2. Commits con Conventional Commits ([docs/COMMITS.md](docs/COMMITS.md)); el asunto debe ir en
   minúsculas (lo exige `commitlint`).
3. Abre un Pull Request ([docs/PR_PROCESS.md](docs/PR_PROCESS.md)); la CI exige lint, tipos, tests,
   export válido y E2E antes de permitir el deploy.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Autor

**Pablo Rodríguez Garijo** ([@PabloJustDevelops](https://github.com/PabloJustDevelops)) — desarrollador de software.
