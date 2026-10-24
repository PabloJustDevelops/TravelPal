'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import styles from './authStyles.module.css'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import GoogleButton from '@/components/auth/GoogleButton'
import { fieldClassName } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'
import VerifyEmailStep from './VerifyEmailStep'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

type RegisterFormData = { fullName: string; email: string; password: string; confirmPassword: string }

export default function RegisterForm() {
  const { locale } = useI18n()
  const english = locale === 'en'
  const registerSchema = z.object({
    fullName: z.string().min(2, english ? 'Name must be at least 2 characters' : 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email(english ? 'Enter a valid email address' : 'Ingresa un email válido'),
    password: z.string().min(8, english ? 'Password must be at least 8 characters' : 'La contraseña debe tener al menos 8 caracteres').regex(/[A-Z]/, english ? 'Must include at least one uppercase letter' : 'Debe contener al menos una letra mayúscula').regex(/[a-z]/, english ? 'Must include at least one lowercase letter' : 'Debe contener al menos una letra minúscula').regex(/\d/, english ? 'Must include at least one number' : 'Debe contener al menos un número'),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, { message: english ? 'Passwords do not match' : 'Las contraseñas no coinciden', path: ['confirmPassword'] })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  // Email pendiente de verificar: si el backend pide confirmación, el registro
  // se queda en el paso del código en vez de mandar al dashboard.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const { signUp } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password')

  // Calcular la fortaleza de la contraseña
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    return score;
  };

  const strengthScore = getPasswordStrength(password);

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-danger';
    if (score === 2) return 'bg-warning';
    if (score === 3) return 'bg-warning';
    return 'bg-success';
  };

  const getStrengthText = (score: number) => {
    if (score <= 1) return english ? 'Weak' : 'Débil';
    if (score === 2) return english ? 'Fair' : 'Regular';
    if (score === 3) return english ? 'Good' : 'Buena';
    return english ? 'Strong' : 'Fuerte';
  };

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await signUp(data.email, data.password, data.fullName)

      if (!result.ok) {
        // El backend sí distingue el email repetido (AUTH_EMAIL_EXISTS, 409):
        // la cadena de Firebase que se miraba antes no existe aquí. Cualquier
        // otro fallo se queda en un mensaje genérico, sin el texto del backend.
        setError(
          result.code === 'email_exists'
            ? (english ? 'This email is already registered' : 'Este email ya está registrado')
            : (english ? 'Could not create your account. Please try again.' : 'No se pudo crear la cuenta. Inténtalo de nuevo.'),
        )
        return
      }

      if (result.requireEmailVerification) {
        setPendingEmail(data.email)
      } else {
        // El alta ya dejó sesión: no hay nada que confirmar.
        router.replace('/dashboard')
      }
    } catch {
      // Un fallo de transporte al hablar con el servidor, no un alta rechazada.
      setError(english ? 'Could not create your account. Please try again.' : 'No se pudo crear la cuenta. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  if (pendingEmail) {
    return <VerifyEmailStep email={pendingEmail} />
  }

  return (
    <div className={styles.form}>
      <div>
        <h1>
          {english ? 'Create your account' : 'Crea tu cuenta'}
        </h1>
        <p className={styles.description}>{english ? 'Your space to plan your next trip.' : 'Tu espacio para organizar el próximo viaje.'}</p>
      </div>

      <form noValidate className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div role="alert" className="rounded-md bg-danger/10 p-4">
              <div className="text-sm text-danger">{error}</div>
            </div>
          )}

          <div className={styles.fields}>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-ink">
                {english ? 'Full name' : 'Nombre completo'}
              </label>
              <input
                {...register('fullName')}
                id="fullName"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
                type="text"
                autoComplete="name"
                className={cn(fieldClassName, styles.input, 'mt-1')}
                placeholder={english ? 'Your full name' : 'Tu nombre y apellidos'}
              />
              {errors.fullName && (
                <p id="fullName-error" role="alert" className="mt-1 text-sm text-danger">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email
              </label>
              <input
                {...register('email')}
                id="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                type="email"
                autoComplete="email"
                className={cn(fieldClassName, styles.input, 'mt-1')}
                placeholder={english ? 'you@email.com' : 'tu@email.com'}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="mt-1 text-sm text-danger">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                {english ? 'Password' : 'Contraseña'}
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  id="password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : "password-hint"}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={cn(fieldClassName, styles.input, styles.passwordInput)}
                  placeholder={english ? 'At least 8 characters' : 'Mínimo 8 caracteres'}
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
                <p id="password-error" role="alert" className="mt-1 text-sm text-danger">{errors.password.message}</p>
              )}

              <p id="password-hint" className={styles.hint}>{english ? 'Use 8+ characters, uppercase and lowercase letters, and numbers.' : 'Usa 8+ caracteres, mayúsculas, minúsculas y números.'}</p>
              {/* Password strength indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-muted">{english ? 'Password strength:' : 'Fortaleza de la contraseña:'}</div>
                    <div className={`text-xs font-medium ${
                        strengthScore <= 1 ? 'text-danger' :
                        strengthScore === 2 ? 'text-warning' :
                        strengthScore === 3 ? 'text-warning' : 'text-success'
                      }`}>
                      {getStrengthText(strengthScore)}
                    </div>
                  </div>
                  <div className="flex space-x-1 h-1.5">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          index <= strengthScore ? getStrengthColor(strengthScore) : 'bg-line'
                        }`}
                      />
                    ))}
                  </div>

                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
                {english ? 'Confirm password' : 'Confirmar contraseña'}
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={cn(fieldClassName, styles.input, styles.passwordInput)}
                  placeholder={english ? 'Enter your password again' : 'Repite tu contraseña'}
                />
                {isClient && (
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? (english ? 'Hide password confirmation' : 'Ocultar confirmación de contraseña') : (english ? 'Show password confirmation' : 'Mostrar confirmación de contraseña')}
                    aria-pressed={showConfirmPassword}
                    className={styles.toggle}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-muted" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-muted" />
                    )}
                  </button>
                )}
              </div>
              {errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="mt-1 text-sm text-danger">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <Button type="submit" loading={isLoading} className={cn("w-full", styles.submit)}>
              {english ? 'Create account' : 'Crear cuenta'}
            </Button>
          </div>

          <div>
            <div className={styles.divider} aria-hidden="true">{english ? 'or' : 'o'}</div>
            <GoogleButton />
          </div>
        </form>
        <p className={styles.switchAccount}>{english ? 'Already have an account?' : '¿Ya tienes cuenta?'} <Link href={localePath(locale, '/signin')}>{english ? 'Sign in' : 'Inicia sesión'}</Link></p>
    </div>
  )
}
