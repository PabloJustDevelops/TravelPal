import { assertRowsAffected, RowsNotAffectedError } from "@/lib/insforge-query";

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
