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
