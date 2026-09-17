import {
  classifySignInError,
  classifySignUpError,
} from "../auth-error-codes";

// Las formas de error son las que devuelve el backend real, capturadas contra
// produccion: el login sin verificar responde 403 FORBIDDEN ("Email
// verification required") y las credenciales malas 401 AUTH_UNAUTHORIZED.
describe("classifySignInError", () => {
  it("marca email_not_verified cuando el backend responde 403", () => {
    expect(
      classifySignInError({ error: "FORBIDDEN", statusCode: 403 }),
    ).toEqual({ ok: false, code: "email_not_verified", statusCode: 403 });
  });

  it("marca invalid_credentials cuando el backend responde 401", () => {
    expect(
      classifySignInError({ error: "AUTH_UNAUTHORIZED", statusCode: 401 }),
    ).toEqual({ ok: false, code: "invalid_credentials", statusCode: 401 });
  });

  it("marca rate_limited cuando el backend responde 429", () => {
    expect(
      classifySignInError({ error: "TOO_MANY_REQUESTS", statusCode: 429 }),
    ).toEqual({ ok: false, code: "rate_limited", statusCode: 429 });
  });

  it("marca rate_limited por el codigo canonico aunque el status no sea 429", () => {
    expect(classifySignInError({ error: "RATE_LIMITED", statusCode: 500 })).toEqual(
      { ok: false, code: "rate_limited", statusCode: 500 },
    );
  });

  it("no disfraza un fallo inesperado de credenciales y conserva el statusCode", () => {
    expect(classifySignInError({ error: "INTERNAL_ERROR", statusCode: 500 })).toEqual(
      { ok: false, code: "unexpected", statusCode: 500 },
    );
  });

  it("cae a unexpected si el SDK no da ni codigo ni status", () => {
    expect(classifySignInError(null)).toEqual({ ok: false, code: "unexpected" });
  });
});

describe("classifySignUpError", () => {
  it("marca email_exists con el codigo propio del backend", () => {
    expect(
      classifySignUpError({ error: "AUTH_EMAIL_EXISTS", statusCode: 409 }),
    ).toEqual({ ok: false, code: "email_exists", statusCode: 409 });
  });

  it("marca rate_limited cuando el envio del correo esta limitado", () => {
    expect(
      classifySignUpError({ error: "TOO_MANY_REQUESTS", statusCode: 429 }),
    ).toEqual({ ok: false, code: "rate_limited", statusCode: 429 });
  });

  it("no expone un alta fallida como existe-el-email", () => {
    expect(
      classifySignUpError({ error: "INVALID_INPUT", statusCode: 400 }),
    ).toEqual({ ok: false, code: "unexpected", statusCode: 400 });
  });

  it("cae a unexpected si el SDK no da ni codigo ni status", () => {
    expect(classifySignUpError(undefined)).toEqual({
      ok: false,
      code: "unexpected",
    });
  });
});
