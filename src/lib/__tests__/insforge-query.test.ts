import {
  QUERY_TIMEOUT_MS,
  QueryTimeoutError,
  withQueryTimeout,
  assertRowsAffected,
  RowsNotAffectedError,
} from "@/lib/insforge-query";

describe("assertRowsAffected", () => {
  it("acepta una o mas filas afectadas", () => {
    expect(() => assertRowsAffected([{ id: "r1" }], "boom")).not.toThrow();
  });

  it("trata cero filas como fallo tipado", () => {
    expect(() => assertRowsAffected([], "No se pudo")).toThrow(
      RowsNotAffectedError,
    );
  });

  it("trata null y undefined como fallo", () => {
    expect(() => assertRowsAffected(null, "No se pudo")).toThrow(
      RowsNotAffectedError,
    );
    expect(() => assertRowsAffected(undefined, "No se pudo")).toThrow(
      RowsNotAffectedError,
    );
  });

  it("conserva el mensaje y el nombre del error", () => {
    expect.assertions(3);

    try {
      assertRowsAffected([], "No se pudo actualizar");
      throw new Error("no deberia llegar");
    } catch (err) {
      expect(err).toBeInstanceOf(RowsNotAffectedError);
      expect((err as Error).name).toBe("RowsNotAffectedError");
      expect((err as Error).message).toBe("No se pudo actualizar");
    }
  });
});

// El SDK devuelve cadenas que no son `Promise` sino `PromiseLike`: el `then()`
// es lo que dispara el `fetch`. Este doble imita esa forma perezosa para probar
// que el envoltorio no depende de recibir una promesa ya arrancada.
class LazyQuery<T> {
  thenCalls = 0;

  constructor(private readonly produce: () => T | PromiseLike<T>) {}

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.thenCalls += 1;
    return Promise.resolve(this.produce()).then(onfulfilled, onrejected);
  }
}

describe("withQueryTimeout", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("usa quince segundos como techo por defecto", () => {
    expect(QUERY_TIMEOUT_MS).toBe(15000);
  });

  it("lanza QueryTimeoutError cuando la consulta no responde a tiempo", async () => {
    jest.useFakeTimers();

    const pending = withQueryTimeout(new Promise<never>(() => {}), {
      timeoutMs: 20,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(QueryTimeoutError);

    await jest.advanceTimersByTimeAsync(20);
    await assertion;
  });

  it("nombra el error de timeout y etiqueta la consulta", async () => {
    jest.useFakeTimers();

    const pending = withQueryTimeout(new Promise<never>(() => {}), {
      timeoutMs: 20,
      label: "tasks",
    });

    const settled = pending.then(
      () => {
        throw new Error("no deberia resolver");
      },
      (err: unknown) => err,
    );

    await jest.advanceTimersByTimeAsync(20);
    const caught = await settled;

    expect(caught).toBeInstanceOf(QueryTimeoutError);
    expect((caught as Error).name).toBe("QueryTimeoutError");
    expect((caught as Error).message).toContain("tasks");
  });

  it("devuelve el valor cuando la consulta resuelve antes del techo", async () => {
    const result = await withQueryTimeout(
      Promise.resolve({ data: ["a"], error: null }),
      { timeoutMs: 20 },
    );

    expect(result).toEqual({ data: ["a"], error: null });
  });

  it("propaga el error original del sdk en vez de un timeout", async () => {
    const sdkError = { message: "permission denied", code: "42501" };

    await expect(
      withQueryTimeout(Promise.reject(sdkError), { timeoutMs: 20 }),
    ).rejects.toBe(sdkError);
  });

  it("funciona con la cadena perezosa del sdk y arranca su then", async () => {
    const query = new LazyQuery(() => ({ data: ["fila"], error: null }));

    const result = await withQueryTimeout(query, { timeoutMs: 20 });

    expect(result).toEqual({ data: ["fila"], error: null });
    expect(query.thenCalls).toBe(1);
  });

  it("no aborta la cadena perezosa: la arranca aunque gane el timeout", async () => {
    jest.useFakeTimers();

    const query = new LazyQuery<{ data: string[] }>(
      () => new Promise<never>(() => {}),
    );

    const pending = withQueryTimeout(query, { timeoutMs: 20 });
    const assertion = expect(pending).rejects.toBeInstanceOf(QueryTimeoutError);

    await jest.advanceTimersByTimeAsync(20);
    await assertion;

    expect(query.thenCalls).toBe(1);
  });
});
