// Códigos con los que la UI decide su mensaje. El backend no siempre distingue
// con un código canónico: el login de una cuenta sin verificar responde un
// `FORBIDDEN` genérico con 403 (verificado contra producción), así que cuando el
// código no distingue manda el `statusCode`. El texto del backend no se usa como
// discriminador porque puede cambiar y porque filtrarlo era el bug original.
export type AuthFailureCode =
  | "email_not_verified"
  | "invalid_credentials"
  | "rate_limited"
  | "email_exists"
  | "unexpected";

export type AuthFailure = {
  ok: false;
  code: AuthFailureCode;
  statusCode?: number;
};

type SdkErrorLike =
  | { error?: string; statusCode?: number }
  | null
  | undefined;

const RATE_LIMIT_CODES = new Set(["RATE_LIMITED", "TOO_MANY_REQUESTS"]);

function isRateLimited(error: SdkErrorLike): boolean {
  return error?.statusCode === 429 || RATE_LIMIT_CODES.has(error?.error ?? "");
}

export function classifySignInError(error: SdkErrorLike): AuthFailure {
  const statusCode = error?.statusCode;

  if (isRateLimited(error)) {
    return { ok: false, code: "rate_limited", statusCode };
  }

  // 403 en el login es "email sin verificar" (el backend no usa
  // AUTH_NEED_VERIFICATION aquí: contesta 403 FORBIDDEN).
  if (statusCode === 403) {
    return { ok: false, code: "email_not_verified", statusCode };
  }

  if (statusCode === 401) {
    return { ok: false, code: "invalid_credentials", statusCode };
  }

  return { ok: false, code: "unexpected", statusCode };
}

export function classifySignUpError(error: SdkErrorLike): AuthFailure {
  const statusCode = error?.statusCode;

  if (isRateLimited(error)) {
    return { ok: false, code: "rate_limited", statusCode };
  }

  if (statusCode === 409 || error?.error === "AUTH_EMAIL_EXISTS") {
    return { ok: false, code: "email_exists", statusCode };
  }

  return { ok: false, code: "unexpected", statusCode };
}
