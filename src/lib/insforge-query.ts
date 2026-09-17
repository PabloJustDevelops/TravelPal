/**
 * Guardia para las mutaciones del SDK de InsForge.
 *
 * Con RLS de propietario (`auth.uid() = user_id`), un `update` o un `delete`
 * sobre una fila ajena o inexistente no devuelve error: la fila no matchea,
 * PostgREST responde `200` con `data: []` (o `null` si la consulta no encadeno
 * `.select()`) y el SDK no marca `error`. Sin comprobarlo, la UI cantaria un
 * exito que no ha ocurrido.
 *
 * Encadenar `.select()` en la mutacion hace que el SDK pida al backend
 * `Prefer: return=representation` (ver
 * `@supabase/postgrest-js/.../PostgrestTransformBuilder.ts`) y devuelva en
 * `data` las filas afectadas. Si son cero, la operacion no ha ocurrido: este
 * helper convierte esas cero filas en un fallo tipado para que el `catch` de la
 * pagina muestre el error (y revierta el estado optimista donde lo haya).
 */

export class RowsNotAffectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RowsNotAffectedError";
  }
}

export function assertRowsAffected(
  rows: readonly unknown[] | null | undefined,
  message: string,
): void {
  if (!rows || rows.length === 0) {
    throw new RowsNotAffectedError(message);
  }
}

/**
 * Envoltorio con techo de espera para las consultas del SDK.
 *
 * Desde que se retiro el BFF, las consultas del SDK corren en el navegador sin
 * timeout: si la red o el backend se cuelgan, el spinner se queda indefinido y
 * el usuario no recibe ni error ni mensaje. El hook del BFF cortaba a los 15 s;
 * este envoltorio devuelve ese techo al cliente.
 *
 * El timeout es de la espera del cliente, no de la peticion: `fetch` no expone
 * un senal de corte que el SDK respete, asi que la consulta de abajo sigue su
 * curso y solo se descarta su resultado. Lo que se cancela es la espera.
 *
 * Distingue los dos desenlaces que la UI necesita separar: si el SDK responde
 * mal (o rechaza), el error original se propaga tal cual; si no responde a
 * tiempo, lanza `QueryTimeoutError`. Las paginas traducen esa distincion con
 * `getLoadErrorMessage`, que ya mapea `timeout` y `request` a textos distintos.
 */

export const QUERY_TIMEOUT_MS = 15000;

export class QueryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryTimeoutError";
  }
}

export function withQueryTimeout<T>(
  query: PromiseLike<T>,
  options: { timeoutMs?: number; label?: string } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? QUERY_TIMEOUT_MS;
  const label = options.label ? `: ${options.label}` : "";

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new QueryTimeoutError(
          `La consulta ha superado los ${timeoutMs} ms${label}`,
        ),
      );
    }, timeoutMs);

    Promise.resolve(query).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
