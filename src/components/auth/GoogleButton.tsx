"use client";

import Image from "next/image";
import styles from "./authStyles.module.css";
import { cn } from "@/lib/utils";
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
        className={cn("w-full", styles.google)}
      >
        <Image src="/images/atlas/google.svg" width={26} height={26} alt="" aria-hidden="true" />
        Continuar con Google
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
