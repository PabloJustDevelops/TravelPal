"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { initiateOAuthAction } from "@/lib/insforge/auth-actions";
import { logger } from "@/lib/logger";

const GOOGLE_START_ERROR =
  "No se pudo conectar con Google. Inténtalo de nuevo.";

// redirect() de Next no devuelve: lanza un error de control de flujo cuyo
// digest empieza por "NEXT_REDIRECT". Se comprueba el digest a mano en lugar
// de importar isRedirectError desde "next/dist" (ruta interna no documentada
// que puede moverse entre versiones); el prefijo del digest es el contrato
// que el propio Next usa para reconocer estos errores.
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// El objeto Error crudo se pinta como "[object Error]" en el overlay de Next;
// para el log interesa su mensaje y el digest si lo trae.
function getErrorDigest(err: unknown): unknown {
  if (typeof err === "object" && err !== null && "digest" in err) {
    return (err as { digest?: unknown }).digest;
  }
  return undefined;
}

// Arranca el OAuth de Google en servidor (Server Action): la redirección al
// proveedor la hace la acción, aquí sólo queda el estado de carga mientras
// navega y el aviso si el inicio falla.
export default function GoogleButton() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const handleContinueWithGoogle = async () => {
    setIsStarting(true);
    setError("");

    try {
      await initiateOAuthAction("google");
      // La redirección desmonta la pantalla; si la acción volviera sin
      // redirigir, el botón vuelve a estar usable.
      setIsStarting(false);
    } catch (err) {
      // initiateOAuthAction termina en redirect(): Next lanza un error de
      // control de flujo mientras el router completa la navegación al
      // proveedor. No es un fallo y no debe registrarse ni mostrarse como
      // error; sólo se restaura el botón por si la redirección no llega.
      if (isNextRedirectError(err)) {
        setIsStarting(false);
        return;
      }

      logger.error("GoogleButton: fallo al iniciar el OAuth de Google", {
        error: err instanceof Error ? err.message : String(err),
        digest: getErrorDigest(err),
      });
      setError(GOOGLE_START_ERROR);
      setIsStarting(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        loading={isStarting}
        onClick={handleContinueWithGoogle}
        className="w-full"
      >
        Continuar con Google
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
