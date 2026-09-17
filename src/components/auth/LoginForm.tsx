"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import { fieldClassName } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { AuthFailureCode } from "@/lib/insforge/auth-error-codes";

const loginSchema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Mensajes de los códigos que el login sí puede devolver. El de email sin
// verificar no va aquí: lleva su propio aviso con el reenvío del código.
const SIGN_IN_ERROR_MESSAGES: Partial<Record<AuthFailureCode, string>> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  rate_limited: "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
};

const SIGN_IN_FALLBACK_MESSAGE = "No se pudo iniciar sesión. Inténtalo de nuevo.";


export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // Email sin verificar con el que se intentó entrar: mientras esté puesto se
  // muestra el aviso y el botón de reenviar el código.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState("");
  const [isResending, setIsResending] = useState(false);
  const { signIn, resendVerificationEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsClient(true);
  }, []);


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    logger.info("LoginForm: Iniciando onSubmit");
    setIsLoading(true);
    setError("");
    setPendingEmail(null);
    setResendNotice("");

    try {
      logger.debug("LoginForm: Llamando a signIn");

      // Añadir timeout para evitar que se quede colgado
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Timeout: El login tardó demasiado")),
          10000
        );
      });

      const result = await Promise.race([
        signIn(data.email, data.password),
        timeoutPromise,
      ]);

      if (!result.ok) {
        logger.warn("LoginForm: login rechazado", {
          code: result.code,
          statusCode: result.statusCode,
        });

        if (result.code === "email_not_verified") {
          setPendingEmail(data.email);
        } else {
          setError(
            SIGN_IN_ERROR_MESSAGES[result.code] ?? SIGN_IN_FALLBACK_MESSAGE,
          );
        }
        return;
      }

      logger.info("LoginForm: signIn completado exitosamente");

      // Obtener la URL de redirección de los parámetros de búsqueda
      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      logger.debug("LoginForm: Redirigiendo a:", redirectTo);

      router.push(redirectTo);
    } catch (err: unknown) {
      logger.error("LoginForm: Error en onSubmit:", err);

      setError(
        err instanceof Error && err.message
          ? err.message
          : SIGN_IN_FALLBACK_MESSAGE,
      );
    } finally {
      logger.debug("LoginForm: Finalizando onSubmit");
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingEmail) return;

    setError("");
    setResendNotice("");
    setIsResending(true);

    try {
      await resendVerificationEmail(pendingEmail);
      setResendNotice("Te hemos enviado un código nuevo.");
    } catch (err: unknown) {
      // El reenvío sí puede contar lo que diga el backend: no revela si existe
      // otro email, solo si puedes pedir otro código ahora.
      setError(
        err instanceof Error ? err.message : "No se pudo reenviar el código",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Inicia sesión en tu cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          O{" "}
          <Link
            href="/signup"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            crea una nueva cuenta
          </Link>
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {pendingEmail && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Tu email aún no está verificado. Revisa tu bandeja de entrada y
              confirma tu cuenta antes de iniciar sesión.
            </p>
            {resendNotice && (
              <p className="mt-2 text-sm text-green-700">{resendNotice}</p>
            )}
            <Button
              type="button"
              variant="outline"
              loading={isResending}
              onClick={handleResendVerification}
              className="mt-3 w-full"
            >
              Reenviar código de verificación
            </Button>
          </div>
        )}

        <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                {...register("email")}
                id="email"
                type="email"
                autoComplete="email"
                className={cn(fieldClassName, 'mt-1')}
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={cn(fieldClassName, 'pr-10')}
                  placeholder="Tu contraseña"
                />
                {isClient && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div>
            <Button type="submit" loading={isLoading} className="w-full">
              Iniciar sesión
            </Button>
          </div>
        </form>
    </div>
  );
}
