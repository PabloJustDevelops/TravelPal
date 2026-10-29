"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./authStyles.module.css";
import Link from "next/link";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import GoogleButton from "@/components/auth/GoogleButton";
import VerifyEmailStep from "@/components/auth/VerifyEmailStep";
import { fieldClassName } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { AuthFailureCode } from "@/lib/insforge/auth-error-codes";
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

type LoginFormData = { email: string; password: string };

// Mensajes de los códigos que el login sí puede devolver. El de email sin
// verificar no va aquí: lleva su propio aviso con el reenvío del código.
// Fallos del OAuth de Google que escribe el callback
// (src/app/api/auth/callback/route.ts) reutilizando este mismo sistema de
// mensajes por URL.
export default function LoginForm() {
  const { locale } = useI18n()
  const english = locale === 'en'
  const loginSchema = z.object({ email: z.string().email(english ? 'Enter a valid email address' : 'Ingresa un email válido'), password: z.string().min(1, english ? 'Password is required' : 'La contraseña es requerida') })
  const errorMessages: Partial<Record<AuthFailureCode, string>> = {
    invalid_credentials: english ? 'Incorrect email or password.' : 'Email o contraseña incorrectos.',
    rate_limited: english ? 'Too many attempts. Wait a moment and try again.' : 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  }
  const fallbackMessage = english ? 'Could not sign in. Please try again.' : 'No se pudo iniciar sesión. Inténtalo de nuevo.'
  const [showPassword, setShowPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Email sin verificar con el que se intentó entrar: mientras esté puesto el
  // paso del código sustituye al formulario. Es la única salida que tiene quien
  // cerró ese paso al registrarse (issue #156): el alta responde «email ya
  // registrado» y antes aquí solo se podía reenviar el código, sin campo donde
  // escribirlo.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Mensajes que llegan por URL (el reset manda `password-updated` y el
  // callback del OAuth los suyos). Solo se enseña el que se conoce y se limpia
  // el parámetro para que recargar no lo repita; uno desconocido se descarta
  // sin romper el formulario.
  useEffect(() => {
    const message = searchParams.get("message");
    if (!message) return;

    if (message === "password-updated") {
      setNotice(english ? 'Your password has been updated. You can sign in now.' : 'Tu contraseña se ha actualizado. Ya puedes iniciar sesión.');
    } else if (message === "oauth-failed") {
      setError(english ? 'Could not sign in with Google. Please try again.' : 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    } else if (message === "oauth-expired") {
      setError(english ? 'Google sign-in expired before it could finish. Please start again.' : 'El acceso con Google caducó antes de completarse. Vuelve a empezar.');
    }

    const localizedSignIn = localePath(locale, '/signin');
    const cleanedSearch = new URLSearchParams(searchParams.toString());
    cleanedSearch.delete('message');
    const remainingQuery = cleanedSearch.toString();
    if (!pathname.startsWith('/es/') && !pathname.startsWith('/en/')) {
      router.replace(`${localizedSignIn}?${searchParams.toString()}`);
    } else {
      router.replace(remainingQuery ? `${localizedSignIn}?${remainingQuery}` : localizedSignIn);
    }
  }, [searchParams, router, pathname, english, locale]);

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
    setNotice("");
    setPendingEmail(null);

    try {
      logger.debug("LoginForm: Llamando a signIn");

      // Añadir timeout para evitar que se quede colgado
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(english ? 'Sign-in timed out' : 'Timeout: El login tardó demasiado')),
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
            errorMessages[result.code] ?? fallbackMessage,
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
        english ? fallbackMessage : (err instanceof Error && err.message ? err.message : fallbackMessage),
      );
    } finally {
      logger.debug("LoginForm: Finalizando onSubmit");
      setIsLoading(false);
    }
  };

  // Sin verificar no hay nada que reintentar en este formulario: el paso del
  // código (con su propio reenvío y su propio contador) ocupa su lugar.
  if (pendingEmail) {
    return (
      <VerifyEmailStep
        email={pendingEmail}
        redirectTo={searchParams.get("redirectTo") || "/dashboard"}
        onBack={() => setPendingEmail(null)}
      />
    );
  }

  return (
    <div className={styles.form}>
      <div>
        <h1>
          {english ? 'Sign in to your account' : 'Inicia sesión en tu cuenta'}
        </h1>
        <p className={styles.description}>{english ? 'Your plans are ready for the journey ahead.' : 'Tus planes, listos para seguir el viaje.'}</p>
      </div>

      <form noValidate className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {notice && (
          <div role="status" className="rounded-md bg-success/10 p-4">
            <div className="text-sm text-success">{notice}</div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md bg-danger/10 p-4">
            <div className="text-sm text-danger">{error}</div>
          </div>
        )}

        <div className={styles.fields}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink"
              >
                Email
              </label>
              <input
                {...register("email")}
                id="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                type="email"
                autoComplete="email"
                className={cn(fieldClassName, styles.input, 'mt-1')}
                placeholder={english ? 'you@email.com' : 'tu@email.com'}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="mt-1 text-sm text-danger">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink"
              >
                {english ? 'Password' : 'Contraseña'}
              </label>
              <div className="mt-1 relative">
                <input
                  {...register("password")}
                  id="password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={cn(fieldClassName, styles.input, styles.passwordInput)}
                  placeholder={english ? 'Your password' : 'Tu contraseña'}
                />
                {isClient && (
                  <button
                    type="button"
                    aria-label={showPassword ? (english ? 'Hide password' : 'Ocultar contraseña') : (english ? 'Show password' : 'Mostrar contraseña')}
                    aria-pressed={showPassword}
                    className={styles.toggle}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-muted" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-muted" />
                    )}
                  </button>
                )}
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="mt-1 text-sm text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href={localePath(locale, '/forgot-password')}
              className="inline-flex min-h-11 items-center text-sm text-accent hover:text-accent-hover"
            >
              {english ? 'Forgot your password?' : '¿Olvidaste tu contraseña?'}
            </Link>
          </div>

          <div>
            <Button type="submit" loading={isLoading} className={cn("w-full", styles.submit)}>
              {english ? 'Sign in' : 'Iniciar sesión'}
            </Button>
          </div>

          <div>
            <div className={styles.divider} aria-hidden="true">{english ? 'or' : 'o'}</div>
            <GoogleButton />
          </div>
        </form>
        <p className={styles.switchAccount}>{english ? 'New to TravelPal?' : '¿Aún no tienes cuenta?'} <Link href={localePath(locale, '/signup')}>{english ? 'Create an account' : 'Crea tu cuenta'}</Link></p>
    </div>
  );
}
