"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { logger } from "@/lib/logger";

const GOOGLE_START_ERROR =
  "No se pudo conectar con Google. Inténtalo de nuevo.";

export default function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const handleContinueWithGoogle = async () => {
    setIsStarting(true);
    setError("");

    try {
      await signInWithGoogle();
      setIsStarting(false);
    } catch (err) {
      logger.error("GoogleButton: fallo al iniciar el OAuth de Google", {
        error: err instanceof Error ? err.message : String(err),
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
