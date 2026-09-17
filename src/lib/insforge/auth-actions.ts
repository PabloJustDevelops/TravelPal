"use server";

import { cookies } from "next/headers";
import { createClient } from "@insforge/sdk";
import { createAuthActions } from "@insforge/sdk/ssr";
import { publicEnv } from "@/lib/public-env";
import { logger } from "@/lib/logger";
import { createServerInsforgeClient } from "./server";

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

export async function signInAction(input: {
  email: string;
  password: string;
}) {
  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword(input);

  if (error || !data?.user) {
    logger.error("signInAction: fallo de autenticación", {
      error: error?.message,
    });
    throw new Error(error?.message ?? "No se pudo iniciar sesión");
  }

  return { user: { id: data.user.id, email: data.user.email } };
}

export async function signUpAction(input: {
  email: string;
  password: string;
  name: string;
}) {
  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signUp(input);

  if (error) {
    logger.error("signUpAction: fallo de registro", { error: error.message });
    throw new Error(error.message);
  }

  return {
    user: data?.user ?? null,
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
