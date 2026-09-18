"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { initiateOAuthAction } from "@/lib/insforge/auth-actions";
import { logger } from "@/lib/logger";

const GOOGLE_START_ERROR =
  "No se pudo conectar con Google. Inténtalo de nuevo.";

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
      logger.error("GoogleButton: fallo al iniciar el OAuth de Google", {
        error: err,
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
