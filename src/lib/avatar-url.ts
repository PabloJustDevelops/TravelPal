import { optionalUrl, publicEnv } from "@/lib/public-env";
import { z } from "zod";

export const AVATAR_URL_ERROR =
  "Usa una URL HTTPS de esta app o del almacenamiento de InsForge, de hasta 2048 caracteres, sin credenciales ni fragmentos.";

// Reutiliza el parser URL y la normalización del campo opcional del repo.
export const avatarUrlSchema = z.unknown().refine((value) =>
  typeof value === "string" && value.length <= 2048 &&
  (value.trim() === "" || !/[\s\u0000-\u001f\u007f#]/.test(value)),
  AVATAR_URL_ERROR,
).pipe(optionalUrl).refine((value) => {
  if (value === undefined) return true;
  try {
    const url = new URL(value);
    const origins = [
      new URL(publicEnv.NEXT_PUBLIC_INSFORGE_URL).origin,
      "https://insforge-storage.s3.us-east-2.amazonaws.com",
    ];
    if (typeof window !== "undefined") origins.push(window.location.origin);
    return url.protocol === "https:" && !url.username && !url.password &&
      !/^https:\/\/[^/?#]*@/i.test(value) && origins.includes(url.origin);
  } catch {
    return false;
  }
}, AVATAR_URL_ERROR);
