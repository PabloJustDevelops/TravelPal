"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@insforge/sdk";
import { createAuthActions } from "@insforge/sdk/ssr";
import { publicEnv } from "@/lib/public-env";
import { logger } from "@/lib/logger";
import { createServerInsforgeClient } from "./server";
import {
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_CODE_VERIFIER_MAX_AGE_SECONDS,
} from "./oauth";
import {
  classifySignInError,
  classifySignUpError,
  type AuthFailure,
} from "./auth-error-codes";

// Las mutaciones de auth van en servidor: el refresh token es httpOnly y sólo
// aquí se pueden escribir las cookies de sesión.
function publicClient() {
  return createClient({
    baseUrl: publicEnv.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: publicEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  });
}

// El SDK devuelve `InsForgeError` con statusCode; conservarlo deja a la UI
// distinguir un código caducado de un reenvío prematuro sin leer el texto del
// backend (que además puede cambiar).
type AuthActionError = Error & { statusCode?: number };

function toAuthActionError(
  error: { message: string; statusCode: number } | null,
  fallback: string,
): AuthActionError {
  const wrapped = new Error(error?.message || fallback) as AuthActionError;
  if (error) wrapped.statusCode = error.statusCode;
  return wrapped;
}

// El login no lanza un mensaje crudo del backend: devuelve un resultado con el
// código que la UI traduce. Así ni se filtra el texto del servidor ni se pierde
// el statusCode, que es lo único que distingue un email sin verificar.
export type SignInActionResult =
  | { ok: true; user: { id: string; email: string } }
  | AuthFailure;

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<SignInActionResult> {
  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword(input);

  if (error || !data?.user) {
    const failure = classifySignInError(error);
    logger.error("signInAction: fallo de autenticación", {
      code: failure.code,
      statusCode: failure.statusCode,
      error: error?.message,
    });
    return failure;
  }

  return { ok: true, user: { id: data.user.id, email: data.user.email } };
}

export type SessionUser = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
};

// El cliente de navegador del SDK no resuelve la sesión a partir de las cookies:
// busca un usuario en memoria que el login por Server Action nunca le deja y, al
// no encontrarlo, refresca contra el backend desde el navegador (petición
// cross-origin que no lleva ni el refresh token httpOnly ni el token CSRF y que
// responde 401). Con lo cual `user` acababa siendo null teniendo una sesión
// válida. Aquí la identidad se lee en el servidor, donde el access token de la
// cookie sí viaja como credencial de la petición.
export async function getCurrentUserAction(): Promise<SessionUser | null> {
  const client = await createServerInsforgeClient();
  const { data, error } = await client.auth.getCurrentUser();

  if (error) {
    const status = error.statusCode;
    const authServerFailed =
      status === 0 || (typeof status === "number" && status >= 500);

    if (authServerFailed) {
      logger.error("getCurrentUserAction: fallo del servidor de auth", {
        error: error.message,
        statusCode: status,
      });
      throw new Error(error.message);
    }

    // 401/403: la cookie no autoriza (no hay sesión o ya no vale).
    return null;
  }

  const user = data?.user;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.profile?.name,
    avatar_url: user.profile?.avatar_url,
  };
}

// El alta del backend distingue el email repetido con AUTH_EMAIL_EXISTS (409):
// ese código viaja a la UI en vez de la cadena de Firebase que nunca disparaba.
export type SignUpActionResult =
  | {
      ok: true;
      user: { id: string; email: string } | null;
      requireEmailVerification: boolean;
    }
  | AuthFailure;

export async function signUpAction(input: {
  email: string;
  password: string;
  name: string;
}): Promise<SignUpActionResult> {
  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signUp(input);

  if (error) {
    const failure = classifySignUpError(error);
    logger.error("signUpAction: fallo de registro", {
      code: failure.code,
      statusCode: failure.statusCode,
      error: error.message,
    });
    return failure;
  }

  return {
    ok: true,
    user: data?.user
      ? { id: data.user.id, email: data.user.email }
      : null,
    requireEmailVerification: data?.requireEmailVerification ?? false,
  };
}

export async function verifyEmailAction(input: { email: string; otp: string }) {
  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.verifyEmail(input);

  if (error || !data?.user) {
    logger.error("verifyEmailAction: fallo al verificar el email", {
      error: error?.message,
      statusCode: error?.statusCode,
    });
    throw toAuthActionError(error, "No se pudo verificar el email");
  }

  // El código correcto deja la sesión hecha: `createAuthActions` ya escribió las
  // cookies httpOnly antes de devolver.
  return { user: { id: data.user.id, email: data.user.email } };
}

export async function resendVerificationEmailAction(input: { email: string }) {
  // Las auth actions no exponen el reenvío, así que va con el cliente público
  // (mismo patrón que el reset). No toca cookies: reenviar no crea sesión.
  const { error } = await publicClient().auth.resendVerificationEmail(input);

  if (error) {
    logger.error("resendVerificationEmailAction: fallo", {
      error: error.message,
      statusCode: error.statusCode,
    });
    throw toAuthActionError(error, "No se pudo reenviar el código de verificación");
  }
}

export async function signOutAction() {
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signOut();

  if (error) {
    logger.error("signOutAction: fallo al cerrar sesión", {
      error: error.message,
    });
    throw new Error(error.message);
  }
}

export async function sendResetPasswordEmailAction(input: {
  email: string;
  redirectTo: string;
}) {
  const { error } = await publicClient().auth.sendResetPasswordEmail(input);

  if (error) {
    logger.error("sendResetPasswordEmailAction: fallo", {
      error: error.message,
    });
    throw new Error(error.message);
  }
}

export async function resetPasswordAction(input: {
  newPassword: string;
  otp: string;
}) {
  const { error } = await publicClient().auth.resetPassword(input);

  if (error) {
    logger.error("resetPasswordAction: fallo", { error: error.message });
    throw new Error(error.message);
  }
}

export async function updateProfileAction(profile: Record<string, unknown>) {
  const client = await createServerInsforgeClient();
  const { data, error } = await client.auth.setProfile(profile);

  if (error) {
    logger.error("updateProfileAction: fallo", { error: error.message });
    throw new Error(error.message);
  }

  return data;
}

// La app sólo ofrece Google: el tipo literal cierra la puerta a providers que
// el backend tenga habilitados pero la UI no ofrece (p. ej. github).
export type OAuthProvider = "google";

// El repo no define NEXT_PUBLIC_APP_URL: el origen se deriva de las cabeceras
// de la propia request (host + protocolo reenviado), que es lo único que casa
// en local (http://localhost:3000) y en el worker de Cloudflare
// (https://app-viajes.prg-dev.workers.dev) sin mantener configuración extra.
// NEXT_PUBLIC_APP_URL queda como fallback si algún día se define un origen
// canónico distinto del que sirve cada despliegue.
async function resolveAppOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (host) {
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  throw new Error(
    "No se pudo determinar el origen de la app para el redirect de OAuth",
  );
}

// Inicia el OAuth en servidor (PKCE): el verifier baja en una cookie httpOnly y
// el navegador sólo ve la redirección a Google. El intercambio del código lo
// completa src/app/api/auth/callback/route.ts.
export async function initiateOAuthAction(provider: OAuthProvider) {
  const origin = await resolveAppOrigin();
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });

  // Sólo redirectTo y skipBrowserRedirect: client_id, scope, redirect_uri,
  // code_challenge, state y response_type los fija el backend (e ignora
  // cualquier valor que mande el cliente).
  const { data, error } = await auth.signInWithOAuth(provider, {
    redirectTo: `${origin}/api/auth/callback`,
    skipBrowserRedirect: true,
  });

  if (error || !data?.url || !data?.codeVerifier) {
    logger.error("initiateOAuthAction: fallo al iniciar el OAuth", {
      provider,
      error: error?.message,
      statusCode: error?.statusCode,
    });
    throw toAuthActionError(error, "No se pudo iniciar el acceso con Google");
  }

  cookieStore.set(OAUTH_CODE_VERIFIER_COOKIE, data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_CODE_VERIFIER_MAX_AGE_SECONDS,
  });

  redirect(data.url);
}
