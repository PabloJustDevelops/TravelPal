# Task 2: SDK de autenticación en navegador

## Estado

Implementación local completada. `AuthService` usa el singleton browser `createClient` de `@insforge/sdk` con URL y clave anónima públicas. Mantiene los resultados de login/registro y los métodos que consumen los formularios; las verificaciones OTP, recuperación, sesión, perfiles, avatar y Google pasan directamente por el SDK. Se conserva la lectura de `profiles` a mejor esfuerzo y la clasificación de errores de login/registro.

`AuthContext` restaura la sesión inicial, escucha cambios del SDK y elimina la suscripción al desmontar. Se preservó el WIP preexistente que omite la consulta de sesión en la landing. Google vuelve por la página cliente estática `/auth/callback`; el SDK instalado detecta/intercambia el código OAuth y limpia los parámetros de la URL. La recuperación continúa con el token de enlace validado recibido en `/reset-password`, que se pasa a `resetPassword` conforme al contrato existente del formulario.

Se retiraron las Server Actions/cliente SSR de auth, las rutas API `/api/auth/callback` y `/api/auth/refresh`, y sus pruebas específicas. No quedan llamadas activas a esos módulos. La allowlist del proxy vigente deja `/auth/callback` fuera del proxy; esa configuración pertenece al WIP ajeno y no se modificó.

## Verificación local

- RED TDD inicial: `pnpm exec jest src/lib/__tests__/auth_sdk.test.ts --runInBand --coverage=false` → código 1. El camino anterior cargaba `auth-actions.ts` y Jest no resolvía su import transitivo `@insforge/shared-schemas` desde el SDK SSR. Después de sustituir esa delegación, la suite nueva pasó.
- Auth y formularios: `pnpm exec jest 'src/lib/__tests__/auth_*.test.ts' src/lib/insforge/__tests__/auth-error-codes.test.ts src/contexts/__tests__/AuthContext.test.tsx src/components/auth/__tests__ src/app/auth/callback/__tests__/page.test.tsx --runInBand --coverage=false` → código 0; 10 suites y 66 pruebas aprobadas. `ForgotPasswordForm.test.tsx` emite un `console.error` esperado al probar el rechazo del servicio.
- Lint: `pnpm exec eslint src/lib/auth.ts src/lib/insforge.ts src/contexts/AuthContext.tsx src/components/auth/GoogleButton.tsx src/app/auth/callback/page.tsx src/lib/__tests__/auth_sdk.test.ts src/lib/__tests__/auth_profile.test.ts src/lib/__tests__/auth_resilience.test.ts src/contexts/__tests__/AuthContext.test.tsx src/components/auth/__tests__/GoogleButton.test.tsx src/components/auth/__tests__/LoginForm.test.tsx src/components/auth/__tests__/RegisterForm.test.tsx src/app/auth/callback/__tests__/page.test.tsx` → código 0, sin salida.
- Tipos: `pnpm exec next typegen` → código 0. `pnpm run type-check` → código 0 después de quitar `.next/dev/types/validator.ts`, generado antes y todavía referenciando las dos rutas API ya eliminadas.
- Build estático: `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=public-test-key pnpm run build` → código 0. Next reportó `/auth/callback` y `/reset-password` como estáticas. El primer `pnpm run build` sin valores de entorno terminó con código 1 porque faltan ambas variables públicas en este worktree.
- Higiene: `git diff --check` y `git diff --cached --check` → código 0.

## Límites y gate externo

No se probó un login real, persistencia, refresh ni callback contra InsForge/Google. Task 1 sigue bloqueada por falta de servidor PostgreSQL, Docker daemon y proyecto InsForge vinculado. La allowlist externa de redirect URIs de Google/InsForge tampoco está comprobada. No se cambió configuración remota ni se desplegó.

La prueba de build usó valores públicos ficticios; valida compilación y prerenderizado local, no conectividad. El callback de Google depende de que el origen publicado esté permitido por la configuración externa.

## Ronda de arreglo 1/5

Se corrigió la sesión obsoleta que podía sobrevivir a un fallo al cargar `profiles`: después de un error o timeout de esa consulta, `AuthService` vuelve a consultar la sesión del SDK y devuelve `null` si el refresh invalidó la sesión o si la identidad cambió. Los fallos inesperados al confirmar la sesión siguen propagándose en vez de devolver el usuario cacheado.

En `ResetPasswordForm`, tras resolver correctamente `resetPassword({ newPassword, otp })`, `window.history.replaceState` quita la query sensible antes de navegar a signin. Si el reset falla, el formulario mantiene el token en la URL para permitir reintentar.

- RED sesión: `pnpm exec jest src/lib/__tests__/auth_resilience.test.ts --runInBand --coverage=false` → código 1; el caso nuevo recibió el usuario cacheado donde esperaba `null`.
- RED URL: `pnpm exec jest src/components/auth/__tests__/ResetPasswordForm.test.tsx --runInBand --coverage=false` → código 1; tras un reset exitoso seguía `?token=secret-reset-token&insforge_status=ready`. El caso de error ya confirmaba que el token se conserva para reintento.
- GREEN: `pnpm exec jest src/lib/__tests__/auth_resilience.test.ts src/components/auth/__tests__/ResetPasswordForm.test.tsx --runInBand --coverage=false` → código 0; 2 suites y 6 pruebas aprobadas.
- ESLint: `pnpm exec eslint src/lib/auth.ts src/lib/__tests__/auth_resilience.test.ts src/components/auth/ResetPasswordForm.tsx src/components/auth/__tests__/ResetPasswordForm.test.tsx` → código 0, sin salida.
- Tipos: `pnpm run type-check` → código 0.

No se realizó login real ni despliegue. La comprobación se limitó a mocks del SDK y al historial del navegador en Jest.
