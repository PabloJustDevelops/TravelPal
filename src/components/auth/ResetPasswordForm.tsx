"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/lib/auth";
import Button from "@/components/ui/Button";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { fieldClassName } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/utils";
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

type ResetPasswordFormData = { password: string; confirmPassword: string }

export default function ResetPasswordForm() {
  const { locale } = useI18n()
  const english = locale === 'en'
  const resetPasswordSchema = z.object({ password: z.string().min(6, english ? 'Password must be at least 6 characters' : 'La contraseña debe tener al menos 6 caracteres'), confirmPassword: z.string() }).refine(data => data.password === data.confirmPassword, { message: english ? 'Passwords do not match' : 'Las contraseñas no coinciden', path: ['confirmPassword'] })
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    const handleResetLink = async () => {
      const token = searchParams.get("token");
      const status = searchParams.get("insforge_status");
      const flowError = searchParams.get("insforge_error");

      // InsForge redirige aquí con ?token=...&insforge_status=ready tras
      // validar el enlace de recuperación, o con insforge_status=error.
      if (status === "error") {
        setError(english ? 'The password reset link is invalid or has expired.' : (flowError || 'El enlace de recuperación es inválido o ha expirado.'));
        return;
      }

      if (token && status === "ready") {
        setResetToken(token);
        setIsSessionReady(true);
        return;
      }

      // Sin token no hay forma de autorizar el cambio de contraseña.
      setError(english ? 'The password reset link is invalid or incomplete.' : 'Enlace de recuperación inválido o incompleto.');
    };

    handleResetLink();
  }, [searchParams, english]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!isSessionReady || !resetToken) {
      setError(
        english ? 'We could not verify your identity. Please request a new link.' : 'No se ha podido verificar tu identidad. Por favor, solicita un nuevo enlace.',
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await authService.updatePassword(data.password, resetToken);

      // El token deja de ser necesario tras el éxito: retirarlo antes de
      // navegar evita que quede en la URL si la transición del router tarda.
      window.history.replaceState(window.history.state, "", window.location.pathname);

      // Redirigir al login con mensaje de éxito
      router.replace(`${localePath(locale, '/signin')}?message=password-updated`);
    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      setError(
        english ? 'Could not update your password. Please try again.' : (err instanceof Error ? err.message : 'Error al actualizar la contraseña. Inténtalo de nuevo.'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
            {english ? 'New password' : 'Nueva contraseña'}
          </label>
          <div className="relative">
            <input
              id="password"
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              className={cn(fieldClassName, 'pr-10')}
              placeholder={english ? 'New password' : 'Nueva contraseña'}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label={showPassword ? (english ? 'Hide password' : 'Ocultar contraseña') : (english ? 'Show password' : 'Mostrar contraseña')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-muted" />
              ) : (
                <EyeIcon className="h-5 w-5 text-muted" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-ink">
            {english ? 'Confirm password' : 'Confirmar contraseña'}
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              {...register("confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              className={cn(fieldClassName, 'pr-10')}
              placeholder={english ? 'Confirm password' : 'Confirmar contraseña'}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label={showConfirmPassword ? (english ? 'Hide password confirmation' : 'Ocultar confirmación de contraseña') : (english ? 'Show password confirmation' : 'Mostrar confirmación de contraseña')}
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <svg
                  className="h-5 w-5 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 animate-fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h2 className="text-sm font-medium text-red-800">{english ? 'Error' : 'Error'}</h2>
              <div className="mt-1 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <Button
          type="submit"
          loading={isLoading}
          disabled={!isSessionReady && !error} // Deshabilitar mientras se verifica la sesión
          className="w-full"
        >
          {isSessionReady ? (english ? 'Update password' : 'Actualizar contraseña') : (english ? 'Verifying link...' : 'Verificando enlace...')}
        </Button>
      </div>

      <div className="text-center">
        <Link
          href={localePath(locale, '/signin')}
          className="font-medium text-accent hover:text-accent-hover"
        >
          {english ? 'Back to sign in' : 'Volver al inicio de sesión'}
        </Link>
      </div>
    </form>
  );
}
