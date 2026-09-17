# Auditoría: dependencia del servidor de Next.js y decisión sobre migrar a SPA

> Fecha: 2026-09-15. Alcance: `src/app`, `src/lib`, `src/contexts`, `src/components`, `src/proxy.ts`.
> Issue: #36.
> Método: conteo sobre el árbol (grep/glob), medición de artefactos de build y prueba en navegador real
> (Edge headless por CDP) contra producción y contra versiones de preview.

## Pregunta

Cuánto de esta app depende **realmente** del servidor de Next.js, medido — no opinado.

## Inventario y clasificación

### Rutas de página (22 `page.tsx` + 1 redirección legacy)

| Clase | Nº | Detalle |
|---|---|---|
| Client components (`"use client"`) | **16** | dashboard, trips, trips/new, trips/[id], planning, tasks, notes, notes/[id], expenses, expenses/new, expenses/[id]/edit, budget, analytics, alerts, settings, profile |
| Server components, sólo cáscara estática | **6** | `/` (landing), `/signin`, `/signup`, `/login`, `/reset-password`, `/forgot-password` |
| **Server components con datos por petición** | **0** | ninguno hace `fetch` ni usa `await` de datos en servidor |

Los 6 server components existen únicamente para `export const metadata` (SEO), `next/image` y `Suspense`.
El landing (`src/app/page.tsx`) es estático puro: compone componentes de `src/components/landing/` sin datos.

### APIs de servidor

| Construcción | Nº | Notas |
|---|---|---|
| Route handlers (`route.ts`) | **14 ficheros / 25 métodos** | analytics, trips(2), tasks(2), tasks/[id](2), planning(3), notes(2), expenses(2), expenses/[id](3), budget(2), budget/[id](2), dashboard, chat, flights/search, auth/refresh |
| Handlers con `requireUser()` | **13 ficheros** | sesión de servidor; `auth/refresh` lo da el SDK |
| Server actions (`"use server"`) | **1 fichero / 6 acciones** | `src/lib/insforge/auth-actions.ts`: signIn, signUp, signOut, sendResetPasswordEmail, resetPassword, updateProfile |
| `proxy.ts` | **1** | `updateSession()` (refresco de cookies) + redirecciones |
| `cookies()` | **4** | sólo servidor (`auth-actions` ×3, `server.ts` ×1) |
| `headers()` | **0** | — |
| `redirect()` | **3** | middleware ×2, `app/login/page.tsx` ×1 |
| `notFound()` | **0** | — |
| `export const dynamic` | **0** | — |
| `export const revalidate` | **0** | — |
| `generateMetadata` / `generateStaticParams` | **0** | — |

### Lógica que NO puede vivir en el navegador

| Caso | Fichero | Por qué |
|---|---|---|
| Proxy LLM | `src/app/api/chat/route.ts` | usa `OPENROUTER_API_KEY` (secreto de servidor) |
| Proxy vuelos | `src/app/api/flights/search/route.ts` | usa credenciales de Amadeus (secreto) |
| Sesión httpOnly | `auth-actions.ts`, `server.ts`, `api/auth/refresh` | el refresh token vive en cookie httpOnly |

Todo lo demás de la capa de datos es un BFF que **duplica** lo que `@insforge/sdk` ya hace desde el
navegador: los propios client pages llaman a InsForge directamente (`createInsforgeClient()`).

### Acceso a datos: navegador vs servidor

| Camino | Puntos de llamada |
|---|---|
| Navegador → InsForge directo (`createInsforgeClient()`) | **37** en 9 ficheros (incl. `insforge-functions.ts` ×21) |
| Navegador → `/api/*` (BFF de Next) | **~33** `fetch` en 11 páginas + 3 componentes |
| Servidor → InsForge (`requireUser` + SDK) | **13 handlers** + 6 server actions |

Conviven los dos caminos para los mismos dominios (p. ej. `notes` escribe por el SDK y por `/api/notes`),
lo que es deuda arquitectónica independiente de la decisión de framework.

### Pesos (build de OpenNext, `npx opennextjs-cloudflare build`)

| Artefacto | Tamaño |
|---|---|
| Cliente (`.next/static`) | **3.925 KB** |
| Assets desplegados (`.open-next/assets`) | **3.928 KB** |
| Build de servidor sin comprimir (`.next/server`) | **37.805 KB** |
| **Subida del Worker (wrangler)** | **15.069 KiB / 3.101 KiB gzip** |

Un Worker de ~15 MB (3,1 MB gzip) para una app que no renderiza datos en servidor.

## Qué se rompería como SPA estática (Vite + React en Cloudflare, InsForge de backend)

1. **SEO y HTML inicial**: se pierden `metadata` y el HTML server-rendered de las 6 páginas públicas.
   El landing SSR entrega hoy ~2.280 caracteres de texto. Google ejecuta JS, pero OG/Twitter cards y
   crawlers sin JS pierden contenido. Mitigable con prerender estático del landing.
2. **Sesión/cookies**: el refresh token httpOnly (escrito en server actions, middleware y
   `/api/auth/refresh`) no existe en una SPA. Habría que mover tokens a `localStorage` (riesgo XSS) o
   añadir una edge function de InsForge que haga de intercambio de tokens.
3. **Redirecciones y protección de rutas**: el middleware protege 8 prefijos (`/dashboard`, `/trips`,
   `/expenses`, `/budget`, `/notes`, `/planning`, `/analytics`, `/alerts`) y redirige 4 rutas de auth;
   `next.config.js` redirige 5 rutas legacy (`/auth/login`→`/signin`, `/login`→`/signin`, …). Todo eso
   pasa a guards de cliente + reglas de redirección del host.
4. **Endpoints con secretos**: `/api/chat` y `/api/flights/search` deben convertirse en edge functions.
5. **Optimización de imágenes**: `next/image` + binding `IMAGES` de Cloudflare habría que sustituirlo.
6. **Validación estricta de entorno**: `serverEnv` (build/arranque con fallo temprano) desaparece.

## Criterio GO/NO-GO (fijado antes del veredicto)

Se migra a SPA estática **si y sólo si** se cumplen las seis condiciones:

| # | Condición medible | Umbral | Medido | ¿Cumple? |
|---|---|---|---|---|
| C1 | Rutas con datos renderizados en servidor | = 0 | 0/22 | ✅ |
| C2 | Endpoints con lógica irreducible a cliente/edge function | = 0 | 2 (`chat`, `flights/search`) | ❌ |
| C3 | Sesión sostenible sin cookie httpOnly, o downgrade aceptado por el propietario | decisión explícita | refresh token httpOnly | ❌ |
| C4 | Páginas públicas prerenderizables de forma estática (SEO preservado) | 6/6 | 6/6 estáticas | ✅ |
| C5 | Paridad 1:1 en 22 rutas + 25 endpoints sin tocar el backend | sin cambios de backend | requiere 2 edge functions nuevas | ❌ |
| C6 | Existe una métrica de producto hoy en rojo **por culpa de Next** que la SPA mejore | ≥1 métrica | ninguna | ❌ |

## Veredicto

**NO-GO.** Se cumplen 2 de 6 condiciones (C1, C4); fallan C2, C3, C5 y C6.

La app casi no depende del servidor **para renderizar** (0 rutas con datos en servidor), pero sí depende
de él para cuatro cosas que no son gratis de sustituir: sesión httpOnly, SEO de las páginas públicas,
redirecciones y dos proxies con secretos. Y no hay ninguna métrica hoy en rojo atribuible a Next: el
último fallo de producción (la web no cargaba) era un bug de código —variables `NEXT_PUBLIC_*` no
inlineadas, ver ADR-005— no del framework.

Migrar exigiría reescribir 22 rutas + 25 endpoints, crear 2 edge functions de InsForge, reimplementar
redirecciones y sesión, y asumir un downgrade de seguridad en la gestión de tokens. Riesgo alto, coste
alto, beneficio no medido. **No se arranca la migración.**

### Coste y riesgos (en unidades concretas, no en tiempo)

Trabajo de una migración completa:

| Partida | Volumen |
|---|---|
| Rutas a reescribir | 22 (16 cliente + 6 cáscaras de SEO) |
| Endpoints a reescribir | 25 métodos en 14 ficheros |
| Edge functions nuevas (InsForge, fuera del alcance de esta tarea) | 2 (`chat`, `flights/search`) |
| Redirecciones a reimplementar en el host | 5 legacy + 8 prefijos protegidos + 4 rutas de auth |
| Infra a sustituir | `next/image` + binding `IMAGES`, validación `serverEnv`, middleware de sesión |
| Modelo de sesión | rediseño de tokens (httpOnly → cliente o edge function) |

Riesgos, por orden de gravedad:

1. **Seguridad de la sesión**: mover el refresh token a un sitio accesible por JS degrada la postura
   actual; es la razón de C3 y requiere decisión del propietario.
2. **Pérdida de SEO/HTML inicial** en las 6 páginas públicas mientras no exista prerender.
3. **Ruptura silenciosa de redirecciones**: las 5 legacy y la protección de rutas dependen hoy del
   middleware; sin él, URLs antiguas dejan de resolver.
4. **Backend**: las 2 edge functions son cambios de backend (RLS/secretos/despliegue) que esta tarea
   tiene prohibido tocar y que habría que verificar aparte.
5. **Regresión funcional**: conviven dos caminos de datos; al reescribir es fácil dejar uno a medias.

### Condiciones que invertirían el veredicto

- Que C6 pase: p. ej. el coste/tiempo de despliegue de OpenNext o el TTFB se vuelven un problema medido.
- Que C3 se resuelva: el propietario acepta el modelo de sesión de una SPA (o se diseña una edge function
  de intercambio de tokens verificada).
- Que C2/C5 se resuelvan: las edge functions de chat y vuelos existen y están verificadas.

### Alternativa recomendada (más barata, sin cambiar de framework)

Atacar la deuda que sí detecta la auditoría, manteniendo Next:

1. **Borrar el BFF duplicado**: 13 route handlers que sólo envuelven `requireUser()` + `client.database`
   repiten lo que el navegador ya hace con el SDK. Eliminarlos reduce ~37 MB de build de servidor y
   quita el doble camino cliente/BFF. Sólo se conservan `chat`, `flights/search` y `auth/refresh`.
2. **Un solo camino de datos**: elegir SDK-en-navegador o BFF, no ambos, por dominio.
3. **Revisar la sesión**: valorar si `requireUser()` en cada handler es necesario con RLS por `auth.uid()`.

## Fuera de alcance

- Migración a Vite + React (descartada por el criterio).
- Cambios de backend (RLS, migraciones, secretos) y del workflow de CI.
- Seguridad de las rutas no protegidas por el middleware (`/tasks`, `/settings`, `/profile` no están en
  `protectedRoutes`): hallazgo aparte, no evaluado aquí.

## Actualización (posterior a la auditoría)

- El endpoint `flights/search` deja de contar: se **eliminó** junto con su cliente. Además de ser un
  proxy sin sesión (lo que ya señalaba esta auditoría), su proveedor (Amadeus self-service) fue
  retirado, así que no había nada que conservar. Ver
  [ADR-006](../DECISIONS/ADR-006-vuelos-de-amadeus-a-entrada-manual.md). Las referencias a
  `flights/search` de las tablas C2/C5 y del coste se leen como historia; el único endpoint con
  secreto que sobrevive es `chat`.
- La protección de `/tasks`, `/settings` y `/profile` (último punto del alcance) ya está hecha.
