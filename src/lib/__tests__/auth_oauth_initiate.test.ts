import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthActions } from "@insforge/sdk/ssr";
import { initiateOAuthAction } from "../insforge/auth-actions";

jest.mock("@insforge/sdk", () => ({
  createClient: jest.fn(),
}));

jest.mock("@insforge/sdk/ssr", () => ({
  createAuthActions: jest.fn(),
  createServerClient: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
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
const cookiesMock = cookies as jest.Mock;
const headersMock = headers as jest.Mock;
const redirectMock = redirect as jest.Mock;

const signInWithOAuth = jest.fn();
const cookieStore = { set: jest.fn(), get: jest.fn(), delete: jest.fn() };

const OAUTH_URL = "https://accounts.google.test/o/authorize?client_id=x";

describe("initiateOAuthAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookiesMock.mockResolvedValue(cookieStore);
    headersMock.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    createAuthActionsMock.mockReturnValue({ signInWithOAuth });
    // El redirect real de Next lanza: el mock se comporta igual para que el
    // flujo de la acción sea fiel.
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("llama a signInWithOAuth con google, el redirectTo del host y sin campos del servidor", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_URL, codeVerifier: "verifier-123" },
      error: null,
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow("NEXT_REDIRECT");

    // La igualdad exacta asegura que no se cuela ningún campo prohibido
    // (client_id, scope, redirect_uri, code_challenge, state, response_type).
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith("google", {
      redirectTo: "http://localhost:3000/api/auth/callback",
      skipBrowserRedirect: true,
    });
  });

  it("guarda el codeVerifier en una cookie httpOnly y redirige al proveedor", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_URL, codeVerifier: "verifier-123" },
      error: null,
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow("NEXT_REDIRECT");

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "insforge_code_verifier",
      "verifier-123",
      {
        httpOnly: true,
        // jest.config.js fija NODE_ENV=test: en producción iría a true.
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      },
    );
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(OAUTH_URL);
  });

  it("usa el host y protocolo reenviados detrás del proxy", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: "internal.proxy",
        "x-forwarded-host": "app-viajes.prg-dev.workers.dev",
        "x-forwarded-proto": "https",
      }),
    );
    signInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_URL, codeVerifier: "verifier-123" },
      error: null,
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow("NEXT_REDIRECT");

    expect(signInWithOAuth).toHaveBeenCalledWith("google", {
      redirectTo: "https://app-viajes.prg-dev.workers.dev/api/auth/callback",
      skipBrowserRedirect: true,
    });
  });

  it("cae a NEXT_PUBLIC_APP_URL cuando la request no trae host", async () => {
    headersMock.mockResolvedValue(new Headers());
    process.env.NEXT_PUBLIC_APP_URL = "https://canonico.example";
    signInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_URL, codeVerifier: "verifier-123" },
      error: null,
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow("NEXT_REDIRECT");

    expect(signInWithOAuth).toHaveBeenCalledWith("google", {
      redirectTo: "https://canonico.example/api/auth/callback",
      skipBrowserRedirect: true,
    });
  });

  it("falla con un error claro si no puede resolver el origen", async () => {
    headersMock.mockResolvedValue(new Headers());

    await expect(initiateOAuthAction("google")).rejects.toThrow(/origen/);

    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("no guarda el verifier ni redirige si el backend rechaza el inicio", async () => {
    signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: "OAuth no configurado", statusCode: 400 },
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow(
      "OAuth no configurado",
    );

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("no redirige si la respuesta llega sin url o codeVerifier", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_URL, codeVerifier: undefined },
      error: null,
    });

    await expect(initiateOAuthAction("google")).rejects.toThrow(
      "No se pudo iniciar el acceso con Google",
    );

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
