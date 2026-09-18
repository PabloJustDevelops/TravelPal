import { NextRequest } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { GET } from "../route";

jest.mock("@insforge/sdk/ssr", () => ({
  createAuthActions: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

const createAuthActionsMock = createAuthActions as jest.Mock;
const exchangeOAuthCode = jest.fn();

function callbackRequest(search: string, verifier?: string) {
  const request = new NextRequest(
    `http://localhost:3000/api/auth/callback${search}`,
  );
  if (verifier) {
    // Bajo jest (whatwg-fetch) la cabecera `cookie` es prohibida y no llega
    // al Request, así que el almacén se inyecta a mano: leerlo es lo único
    // que hace el route con él.
    Object.defineProperty(request, "cookies", {
      value: {
        get: (name: string) =>
          name === "insforge_code_verifier"
            ? { name, value: verifier }
            : undefined,
      },
    });
  }
  return request;
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAuthActionsMock.mockReturnValue({ exchangeOAuthCode });
  });

  it("sin insforge_code redirige a signin con mensaje de fallo", async () => {
    const res = await GET(callbackRequest(""));

    expect(res.status).toBe(307);
    expect(redirectTarget(res)?.pathname).toBe("/signin");
    expect(redirectTarget(res)?.searchParams.get("message")).toBe(
      "oauth-failed",
    );
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("con error del proveedor redirige a signin con mensaje de fallo", async () => {
    const res = await GET(callbackRequest("?error=access_denied"));

    expect(res.status).toBe(307);
    expect(redirectTarget(res)?.pathname).toBe("/signin");
    expect(redirectTarget(res)?.searchParams.get("message")).toBe(
      "oauth-failed",
    );
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("sin verifier en la cookie redirige a signin sin intentar el intercambio", async () => {
    const res = await GET(callbackRequest("?insforge_code=abc"));

    expect(res.status).toBe(307);
    expect(redirectTarget(res)?.pathname).toBe("/signin");
    expect(redirectTarget(res)?.searchParams.get("message")).toBe(
      "oauth-expired",
    );
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("redirige a signin cuando el intercambio falla", async () => {
    exchangeOAuthCode.mockResolvedValue({
      data: null,
      error: { message: "invalid_grant", statusCode: 400 },
    });

    const res = await GET(callbackRequest("?insforge_code=abc", "verifier-123"));

    expect(exchangeOAuthCode).toHaveBeenCalledWith("abc", "verifier-123");
    expect(res.status).toBe(307);
    expect(redirectTarget(res)?.pathname).toBe("/signin");
    expect(redirectTarget(res)?.searchParams.get("message")).toBe(
      "oauth-failed",
    );
  });

  it("intercambia el código, borra la cookie del verifier y va al dashboard", async () => {
    // El mismo almacén de cookies que el route pasa a createAuthActions es
    // el que usa para caducar el verifier: espiarlo aquí comprueba el
    // cableado (bajo jest las cabeceras set-cookie no se pueden leer de la
    // respuesta).
    let cookiesSet: jest.SpyInstance | undefined;
    createAuthActionsMock.mockImplementation(
      ({
        responseCookies,
      }: {
        responseCookies: {
          set: (
            name: string,
            value: string,
            options?: Record<string, unknown>,
          ) => void;
        };
      }) => {
        cookiesSet = jest.spyOn(responseCookies, "set");
        return { exchangeOAuthCode };
      },
    );
    exchangeOAuthCode.mockResolvedValue({
      data: { user: { id: "user-123", email: "ana@example.com" } },
      error: null,
    });

    const res = await GET(callbackRequest("?insforge_code=abc", "verifier-123"));

    expect(exchangeOAuthCode).toHaveBeenCalledTimes(1);
    expect(exchangeOAuthCode).toHaveBeenCalledWith("abc", "verifier-123");
    expect(res.status).toBe(307);
    expect(redirectTarget(res)?.pathname).toBe("/dashboard");
    expect(cookiesSet).toBeDefined();
    expect(cookiesSet).toHaveBeenCalledWith(
      "insforge_code_verifier",
      "",
      expect.objectContaining({ httpOnly: true, path: "/", maxAge: 0 }),
    );
  });
});
