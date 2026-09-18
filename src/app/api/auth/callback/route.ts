import { NextResponse, type NextRequest } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { logger } from "@/lib/logger";
import { OAUTH_CODE_VERIFIER_COOKIE } from "@/lib/insforge/oauth";

// Completa el OAuth que arranca initiateOAuthAction: el backend devuelve al
// usuario aquí con ?insforge_code=<code>. El intercambio se hace en servidor
// para que el refresh token caiga en la cookie httpOnly, nunca en el
// navegador. El usuario llega sin sesión, así que esta ruta no puede estar
// entre las protegidas del proxy.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError || !code) {
    logger.warn("OAuth callback: rechazo del proveedor o código ausente", {
      error: oauthError,
      hasCode: Boolean(code),
    });
    return redirectToSignIn(request, "oauth-failed");
  }

  const codeVerifier = request.cookies.get(OAUTH_CODE_VERIFIER_COOKIE)?.value;
  if (!codeVerifier) {
    // Sin verifier no hay intercambio a ciegas: el PKCE no se puede completar
    // sin el secreto con el que se inició.
    logger.warn("OAuth callback: falta el verifier en la cookie");
    return redirectToSignIn(request, "oauth-expired");
  }

  // La respuesta se construye antes del intercambio para que las cookies de
  // sesión que escriba createAuthActions viajen en este mismo redirect.
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);
  if (error || !data?.user) {
    logger.error("OAuth callback: fallo al intercambiar el código", {
      error: error?.message,
      statusCode: error?.statusCode,
    });
    return redirectToSignIn(request, "oauth-failed");
  }

  // Borrado explícito del verifier (maxAge 0 en vez de delete: misma
  // semántica de caducidad inmediata, y no depende del método delete del
  // almacén de cookies del runtime).
  response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}

// El fallo se comunica con el sistema de mensajes del login (?message=...),
// el mismo que ya usa el reset de contraseña.
function redirectToSignIn(request: NextRequest, message: string) {
  const url = new URL("/signin", request.url);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}
