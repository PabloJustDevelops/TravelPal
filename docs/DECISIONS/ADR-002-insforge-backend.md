# ADR-002: Backend InsForge en lugar de Supabase

## Contexto

La app se construyó sobre Supabase (Postgres, Auth, Storage). El proyecto de Supabase quedó
retirado y su build fallaba en CI; además, la capa de datos usaba la forma de Supabase
(`client.from(...)`, `auth.getSession()`, `@supabase/ssr`), acoplada a esa plataforma.

## Decisión

Migrar el backend a InsForge (`@insforge/sdk`) conservando Postgres como base de datos:

- Datos: `createClient({ baseUrl, anonKey })` y acceso por `client.database.from(...)`.
- Sesión de servidor: `@insforge/sdk/ssr` con `createServerClient({ cookies })`, `updateSession()`
  en el proxy (`src/proxy.ts`) y ruta `/api/auth/refresh` con `createRefreshAuthRouter()`.
- Auth: mutaciones en servidor con `createAuthActions` (el refresh token es httpOnly).
- Admin: `createAdminClient({ apiKey })` en código de servidor.
- Se eliminan `@supabase/supabase-js`, `@supabase/ssr` y `@supabase/auth-ui-*`.

## Consecuencias

- El SDK no expone `getSession()` ni `updateUser()`: `requireUser()` usa `getCurrentUser()` y el
  reset de contraseña usa el flujo por token de InsForge.
- InsForge no acepta enums de Postgres definidos a mano en el repo: el esquema usa `text + CHECK`.
- Las credenciales viven en `.env.local` (`NEXT_PUBLIC_INSFORGE_URL`,
  `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`); ninguna se versiona.
- El esquema se replica en InsForge con `db migrations` (ver ADR-004).

## Estado

Aprobado
