# Auditoría de seguridad — TravelPal, 20 de octubre de 2026

Revisión del estado real del repositorio `PabloJustDevelops/TravelPal` en `main` `9f1abff`.
No es un test de intrusión: es una revisión de diseño y configuración con evidencia reproducible.
Lo que no se ha podido comprobar aparece marcado como **no verificado**.

## 1. Superficie y límites de confianza

| Componente | Qué es | Confianza |
|---|---|---|
| Worker de Cloudflare | Export estático de Next (`out/`) servido como **assets-only**; sin runtime de aplicación | Público. Cualquiera puede leer todo lo que hay aquí: no debe contener datos ni secretos |
| InsForge (Postgres + Auth + Storage + Functions) | Único backend: datos, sesión, fotos, función de inspiración | Frontera real. La autorización vive aquí, no en la UI |
| Google OAuth | Identidad externa (PKCE) | Tercero |
| GitHub Actions | Build y despliegue; `CLOUDFLARE_API_TOKEN` | CI/CD |

Consecuencia de diseño que hay que tener presente: **no hay servidor propio**. `src/middleware.ts` y `src/proxy.ts` no existen; la redirección de rutas privadas a `/signin` la hace el cliente. Eso significa que **la UI no es un control de seguridad**: lo único que separa a un usuario de los datos de otro es RLS en Postgres. Está comprobado que la redirección funciona (`GET /dashboard` sin sesión → `/signin?redirectTo=%2Fdashboard`), pero no se debe contar con ella como defensa.

## 2. Autenticación y sesión

Verificado leyendo `node_modules/@insforge/sdk/dist/index.js` (bundle de navegador) y `src/lib/insforge/oauth.ts`:

- **Token de acceso en memoria** (`this.userToken`), no se persiste en `localStorage` (0 apariciones en el bundle) ni en `sessionStorage`. El SDK lo adjunta como `Authorization: Bearer`.
- **Refresh** por cookie `httpOnly` del backend: el JavaScript de la página no puede leerla.
- **Verificador PKCE en `sessionStorage`** (`PKCE_VERIFIER_KEY`), se borra al usarlo.
- **Token CSRF en cookie legible por JS** (`insforge_csrf_token`) — es el patrón double-submit, así que es intencionado.

Lectura: un XSS **no** permite robar un token duradero desde el almacenamiento del navegador; permite actuar como el usuario mientras la pestaña viva y leer lo que la app pinte. Sigue siendo grave, y por eso la CSP pendiente importa.

## 3. Autorización: RLS

- **13 tablas con `row level security` activado**: `alerts`, `bookings`, `budgets`, `expenses`, `itinerary_activities`, `journal_entries`, `journal_photos`, `notes`, `profiles`, `tasks`, `trips`, `users` (retirada después en `20260918210000_drop-public-users.sql`) y `storage.objects`.
- **43 políticas** declaradas de forma estática, más las generadas por bucle en `migrations/20260913181842_create-app-schema.sql:266-293` (`<tabla>_select_own`, `_insert_own`, `_update_own`, `_delete_own`) con `auth.uid() = user_id` (o `= id` en tablas cuyo id es el usuario).
- **Ninguna política permisiva**: cero `using (true)` en `migrations/`.
- `20261002220747_rewrite-rls-policies-with-subquery.sql` reescribe las políticas a `(select auth.uid())`, que es la forma que el planner cachea por sentencia (rendimiento, no seguridad, pero importa con volumen).
- `20261015120000_enforce-trip-owner-rls.sql` cierra el agujero de **mezclar filas propias con viajes ajenos**: en `insert`/`update` de `expenses`, `notes`, `bookings`, `itinerary_activities`, `alerts` y `budgets`, si `trip_id` no es nulo el viaje referenciado tiene que ser del mismo usuario. En las dos tablas del diario el viaje es obligatorio.
- `20260917120000_storage-objects-owner-only.sql`: `storage.objects` con 4 políticas de propietario.
- **La autorización se prueba en CI**: `pnpm run test:trip-owner-rls` (`scripts/test-trip-owner-rls.mjs`) corre en cada build (`.github/workflows/ci.yml:45`), con 19 casos.

Riesgo residual conocido: RLS protege filas, no *invariantes de negocio* (por ejemplo, que un presupuesto no apunte a una categoría inexistente). Eso vive en la aplicación.

## 4. Secretos

Inventario de `.env.example` y de lo que consume el build:

| Variable | Naturaleza | Dónde vive |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | pública | build |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | pública por diseño (solo puede hacer lo que RLS permita) | build |
| `INSFORGE_API_KEY` | **secreta** | no debe llegar al Worker estático; solo scripts/CI que la necesiten |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | pública | build (hoy vacía) |
| `CLOUDFLARE_API_TOKEN` | **secreta** | secreto de GitHub Actions |

El Worker desplegado no recibe secretos de runtime: su configuración es solo `assets`. Correcto para la arquitectura.

## 5. Cabeceras HTTP

Verificado con `curl -sSI https://app-viajes.prg-dev.workers.dev/` el 2026-10-20. Salen de `public/_headers`:

```
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
cross-origin-opener-policy: same-origin-allow-popups
```

**Falta `Content-Security-Policy` y falta `Strict-Transport-Security`.** En curso en la rama `chore/seguridad-csp`, con CSP primero en `Report-Only` para medir violaciones antes de fijarla.

## 6. Hallazgos

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| F1 | Media | Sin CSP: cualquier XSS ejecuta con los permisos de la app. Mitigado en parte porque el token durable vive en cookie `httpOnly`, no en almacenamiento legible | En curso |
| F2 | Media | Sin HSTS: una primera petición por HTTP podría interceptarse antes de la redirección | En curso |
| F3 | Media | El avatar del perfil se pinta desde una URL arbitraria (`src/app/profile/page.tsx`: `avatar_url` se guarda tal cual). La CSP tendrá que decidir si permite `img-src https:` o solo el host de storage; permitir cualquier `https:` convierte la página en un canal de fuga hacia un tercero (píxel de seguimiento con `Referer` limitado por `strict-origin-when-cross-origin`) | Decisión abierta |
| F4 | Baja | No hay límite de intentos propio en el cliente de auth; se depende del rate limiting de InsForge | Aceptado (documentar) |
| F5 | Baja | La protección de rutas es solo de cliente: no es defensa, es UX. Ya es así por arquitectura; queda escrito para que nadie lo confunda | Aceptado por diseño |
| F6 | Info | `/travel-inspiration` responde **502**: la función no está desplegada. Superficie inactiva; al desplegarla hay que revisar CORS, tamaño de cuerpo y timeout, que ya están implementados en `insforge/functions/travel-inspiration/index.ts` | Bloqueado por cuenta del proveedor |
| F7 | Info | Dependencias sin auditar: `pnpm audit` no se ha podido ejecutar en el entorno de esta revisión (sin red hacia el registro) | **No verificado** |

## 7. Qué falta para cerrar esto

1. CSP fijada y verificada sin violaciones legítimas, más `check:headers` en CI (rama en curso).
2. HSTS con `max-age=31536000; includeSubDomains` (sin `preload` hasta decidir dominio propio).
3. Decidir F3: restringir `img-src` al host de storage y validar la URL de avatar en `profile`.
4. `pnpm audit --prod` en CI, con informe de vulnerabilidades.
5. Cuando se despliegue la función de inspiración: probar que rechaza sin token, que no filtra la clave del proveedor en logs y que respeta el límite de cuerpo.

## 8. Evidencia reproducible

```bash
curl -sSI https://app-viajes.prg-dev.workers.dev/ | grep -iE "content-security|strict-transport|nosniff|frame-options"
grep -rhoE "alter table [a-z_.]+ enable row level security" migrations/ | wc -l   # 13
grep -rhcE "create policy" migrations/*.sql | paste -sd+ | bc                      # 43
grep -rn "using (true)" migrations/                                                # sin resultados
grep -n "test:trip-owner-rls" .github/workflows/ci.yml                             # CI lo ejecuta
```
