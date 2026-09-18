// Piezas compartidas entre la Server Action que inicia el OAuth
// (insforge/auth-actions.ts) y el Route Handler que completa el intercambio
// (src/app/api/auth/callback/route.ts).

// PKCE: el verifier viaja en una cookie httpOnly que sólo tiene que sobrevivir
// al ida y vuelta con el proveedor; 10 minutos de margen.
export const OAUTH_CODE_VERIFIER_COOKIE = "insforge_code_verifier";
export const OAUTH_CODE_VERIFIER_MAX_AGE_SECONDS = 600;
