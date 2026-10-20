import { z } from "zod";

// El export se sirve con CSP sin unsafe-eval. Evita el probe y compilador JIT
// de Zod; la validación usa su intérprete con las mismas reglas.
z.config({ jitless: true });

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

// Variables seguras para el cliente: Next.js sólo expone al bundle del navegador
// las que empiezan por NEXT_PUBLIC_. Este módulo nunca debe leer secretos.

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const optionalNonEmpty = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

export const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url("debe ser una URL válida").optional(),
);

// Un nivel desconocido no es fatal: se ignora y el logger aplica su valor por
// defecto (info en desarrollo, warn en producción).
const optionalLogLevel = z.preprocess(
  (value) =>
    typeof value === "string" &&
    (LOG_LEVELS as readonly string[]).includes(value.toLowerCase())
      ? value.toLowerCase()
      : undefined,
  z.enum(LOG_LEVELS).optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_INSFORGE_URL: z
    .string({ error: "es obligatoria (falta en .env.local)" })
    .url("debe ser una URL válida (ej. https://xxxx.eu-central.insforge.app)"),
  NEXT_PUBLIC_INSFORGE_ANON_KEY: z
    .string({ error: "es obligatoria (falta en .env.local)" })
    .min(1, "no puede estar vacía"),
  NEXT_PUBLIC_LOG_LEVEL: optionalLogLevel,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "(raíz)";
      return `  - ${key}: ${issue.message}`;
    })
    .join("\n");

  return [
    "❌ Configuración de entorno inválida:",
    details,
    "",
    "Copia .env.example a .env.local y completa los valores que faltan.",
  ].join("\n");
}

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }
  return parsed.data;
}

export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  return parseEnv(publicEnvSchema, source);
}

// El bundler sólo sustituye por su valor los accesos estáticos
// (process.env.NEXT_PUBLIC_X). Pasar el objeto process.env entero deja el
// navegador con un objeto vacío y la validación revienta al evaluar el módulo,
// así que cada variable pública se enumera aquí una a una.
const publicEnvSource: Record<string, string | undefined> = {
  NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
  NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
};

export const publicEnv = parsePublicEnv(publicEnvSource);
