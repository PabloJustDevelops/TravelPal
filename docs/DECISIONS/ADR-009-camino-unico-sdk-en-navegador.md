# ADR-009: Un único camino de datos, el SDK de InsForge en el navegador

## Contexto

La app leía y escribía los mismos datos por **dos caminos a la vez**: el SDK de InsForge en el
navegador (`createInsforgeClient()`, `src/lib/insforge.ts`) y un BFF de route handlers en
`src/app/api/<dominio>` que las páginas llamaban con `fetch` o con el hook `useApiResource`. El
[#38] lo midió y lo dejó escrito: había páginas que usaban los dos caminos en el mismo fichero
(`notes`, `planning`), un cambio de modelo obligaba a tocar dos sitios y el error se comportaba
distinto según por dónde hubiera pasado la petición.

El BFF no aportaba lógica. Los handlers de lectura eran dos o tres `SELECT` en paralelo devueltos en
crudo (el de `dashboard` eran `trips`, `expenses` y `budgets`, sin agregar nada) y la agregación y el
cálculo vivían en el navegador. Cada petición pagaba además una llamada de red extra:
`requireUser()` (`src/lib/insforge/server.ts`) llama a `client.auth.getCurrentUser()`, que en modo
servidor hace `GET /api/auth/sessions/current` (`node_modules/@insforge/sdk/dist/index.mjs:1332`)
antes de tocar la base de datos. Y cada `route.ts` engordaba el build de servidor y el Worker (el
número concreto está medido en el [#38]).

Entre la etapa 0 y la 3 del [#38] se migraron los dominios uno a uno —`notes`, `tasks`, `trips`,
`expenses`, `budget`, `planning`, `dashboard`— borrando cada endpoint en el mismo PR que migraba sus
llamadas. Con `dashboard` se apaga el último punto del camino BFF y esta decisión ya no se sostiene
en código: este ADR la registra.

## Decisión

1. **Un único camino de datos para los datos de usuario: el SDK de InsForge en el navegador.** Las
   páginas y componentes leen y escriben con `createInsforgeClient().database.from(...)`. Se borra
   `src/app/api/dashboard/route.ts` con sus últimas llamadas y el guardián queda en
   `puntos bff: 0 / 0` y `sin dominio 0 / 0`: no sobrevive ningún endpoint de datos de usuario.
2. **La autorización la decide RLS, no el BFF.** `migrations/20260913181842_create-app-schema.sql`
   habilita RLS en las tablas y crea políticas `auth.uid() = user_id` en las que tienen propietario
   (y `auth.uid() = id` en `users`/`profiles`). El aislamiento por usuario no lo añadía
   `requireUser()`: ya lo impone la base de datos.
3. **El seam es el SDK directo desde la página, sin capa de módulo de datos.** No hay un
   `insforge-functions.ts` ni un módulo por dominio: las páginas llaman al SDK. El disparador para
   extraer uno es el **tercer uso del mismo `select` o del mismo mapeo**: dos copias se toleran, la
   tercera se extrae a un módulo.
4. **El guardián deja de congelar y pasa a ser valla.** `scripts/check-data-paths.mjs` con
   `scripts/data-paths-baseline.json` ya no mide deuda pendiente (todo a cero): ahora **prohíbe**
   volver al BFF. Cualquier `fetch('/api/<dominio>')` o `useApiResource('/api/<dominio>')` nuevo,
   con literal o con la url en variable, rompe el build.
5. **Solo sobrevive en el servidor lo que no puede bajar al cliente.**

## Endpoints que sobreviven

| Endpoint | Por qué no puede bajar al cliente |
|---|---|
| `src/app/api/auth/refresh/route.ts` | El refresh token es httpOnly. Lo sirve `createRefreshAuthRouter()` (`@insforge/sdk/ssr`), que rota el refresh token y publica el nuevo access token en cookie. |

`chat` y `flights/search` también fueron BFF, pero ya se retiraron en tareas anteriores (el asistente
en el [ADR-008](ADR-008-retirada-del-asistente.md) y el proxy de Amadeus en el
[ADR-006](ADR-006-vuelos-de-amadeus-a-entrada-manual.md)). No queda ningún otro `route.ts` bajo
`src/app/api`.

## Consecuencias

- **Se pierde el 401 explícito.** Con RLS, un usuario sin sesión que consulte una tabla recibe
  `200 []` en vez de `401`, y el 500 «Error de autenticación» de una verificación fallida
  desaparece. Es un cambio de semántica de error, no de acceso: el middleware redirige a `/signin`
  en las rutas protegidas cuando no hay sesión (`src/middleware.ts`) y `ProtectedRoute` lo repite en
  cliente.
- **Se pierde el ocultamiento de la forma de las consultas.** El cliente pasa a saber qué columnas y
  qué filtros usa la app. Con RLS no es un problema de seguridad, pero es información que antes no
  salía del servidor.
- **Se pierde el `logger.error` por consulta del handler y el timeout.** El hook `useApiResource`
  tenía un timeout de 15 s que el SDK no tiene; queda anotado en el [#56].
- **Sin el BFF no hay 400 ni 500 propios.** Lo que el handler validara (el de `dashboard` no
  validaba nada: no tenía 400) se va con él; los errores del SDK se muestran tal cual.
- **`requireUser()`, `ensureUserExists()` y `useApiResource` quedan sin llamadores** (solo sus
  tests). `createServerInsforgeClient()` sí sigue vivo porque lo usa `auth-actions.ts`. Retirar el
  código muerto es limpieza de la etapa 4.
- **Una llamada de red menos por petición**: desaparece el `GET /api/auth/sessions/current` que
  `requireUser()` pagaba en cada handler.
- **Menos código de servidor**: los `route.ts` de datos de usuario, con sus métodos y sus tests de
  endpoint, ya no existen.

## Pérdidas que se corrigen aparte (etapa 4)

- [#53]: el `update`/`delete` de una fila ajena no debe reportar éxito en la UI.
- [#56]: las consultas del SDK no tienen timeout desde que se retiró el BFF.

## Por qué es difícil de revertir

Volver al BFF no es deshacer un commit: exige reescribir un handler por dominio, volver a cablear las
páginas con `fetch`/`useApiResource`, adaptar sus tests y **volver a pagar la llamada extra de auth
por petición**. El guardián lo prohíbe por defecto, así que reintroducir el BFF es una decisión
explícita con su propio cambio, no un accidente. Y la migración está repartida en los PRs de la
etapa 3, uno por dominio: revertirla es revertir toda la etapa.

## Alternativas consideradas

- **Mantener el BFF y migrar sólo algunos dominios.** Descartada: es el doble camino que el [#38]
  describe como deuda; la mitad migrada y la mitad no es la peor combinación.
- **Un módulo de datos por dominio (`insforge-functions.ts`) entre la página y el SDK.** Descartada
  por ahora: añade una capa que hoy no se necesita. Queda como disparador el tercer uso del mismo
  `select`/mapeo (punto 3).
- **Agregar en el servidor** (mover la agregación del navegador al handler). Descartada: hoy no hay
  ninguna agregación en servidor y meterla reintroduce el endpoint y la llamada extra de auth. Si
  algún día hace falta, se reabre con un ADR nuevo.

## Estado

Aprobado

[#38]: https://github.com/PabloJustDevelops/TravelPal/issues/38
[#53]: https://github.com/PabloJustDevelops/TravelPal/issues/53
[#56]: https://github.com/PabloJustDevelops/TravelPal/issues/56
