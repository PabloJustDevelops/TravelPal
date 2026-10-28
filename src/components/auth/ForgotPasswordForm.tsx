'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { useI18n } from '@/lib/i18n/LocaleProvider'

type ForgotPasswordFormData = { email: string }

export default function ForgotPasswordForm() {
  const { locale } = useI18n()
  const english = locale === 'en'
  const forgotPasswordSchema = z.object({ email: z.string().email(english ? 'Enter a valid email address' : 'Ingresa un email válido') })
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resetPassword } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Validar formato de email antes de enviar
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email)) {
        throw new Error(english ? 'The email address is invalid' : 'El formato del email no es válido')
      }

      await resetPassword(data.email, locale)
      setIsSuccess(true)
    } catch (err) {
      // Nada del texto del backend: si el error fuese "no existe ese email", o
      // el aviso de espera entre envíos, mostrar cualquiera de los dos dejaría
      // averiguar desde fuera qué direcciones están registradas.
      console.error('Error al enviar recuperación de contraseña:', err)
      setError(
        english ? 'We could not send the password reset email. Please try again.' : 'No hemos podido enviar el email de recuperación. Inténtalo de nuevo.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div role="status" className="mt-8 rounded-xl border border-success/25 bg-success/10 p-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-success/15 mb-4">
          <EnvelopeIcon className="h-6 w-6 text-success" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium text-ink mb-2">
          {english ? 'Email sent' : 'Email enviado'}
        </h3>
        <p className="text-sm text-muted mb-4">
          {english ? 'We sent a reset link to your email address. Check your inbox (and spam folder) and follow the instructions.' : 'Hemos enviado un enlace de recuperación a tu correo electrónico. Por favor, revisa tu bandeja de entrada (y spam) y sigue las instrucciones.'}
        </p>
        <button
          type="button"
          onClick={() => setIsSuccess(false)}
          className="text-sm text-accent hover:text-accent-hover font-medium underline"
        >
          {english ? 'Try another email' : 'Probar con otro correo'}
        </button>
      </div>
    )
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
            {english ? 'Email address' : 'Correo electrónico'}
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <EnvelopeIcon className="h-5 w-5 text-muted" aria-hidden="true" />
            </div>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              required
              className={cn(fieldClassName, 'pl-10')}
              placeholder={english ? 'you@email.com' : 'tu@email.com'}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-danger">{errors.email.message}</p>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-danger/10 border border-danger/25 rounded-md p-4 animate-fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-danger">
                {english ? 'Could not send' : 'Error al enviar'}
              </h3>
              <div className="mt-1 text-sm text-ink">
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
          className="w-full"
        >
          {english ? 'Send password reset link' : 'Enviar enlace de recuperación'}
        </Button>
      </div>
    </form>
  )
}
