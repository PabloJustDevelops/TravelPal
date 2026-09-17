'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'
import { EnvelopeIcon } from '@heroicons/react/24/outline'

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordForm() {
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
        throw new Error('El formato del email no es válido')
      }

      await resetPassword(data.email)
      setIsSuccess(true)
    } catch (err) {
      // Nada del texto del backend: si el error fuese "no existe ese email", o
      // el aviso de espera entre envíos, mostrar cualquiera de los dos dejaría
      // averiguar desde fuera qué direcciones están registradas.
      console.error('Error al enviar recuperación de contraseña:', err)
      setError(
        'No hemos podido enviar el email de recuperación. Inténtalo de nuevo.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center shadow-sm">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <EnvelopeIcon className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-green-900 mb-2">
          ¡Email enviado!
        </h3>
        <p className="text-sm text-green-700 mb-6">
          Hemos enviado un enlace de recuperación a tu correo electrónico. 
          Por favor, revisa tu bandeja de entrada (y spam) y sigue las instrucciones.
        </p>
        <div className="space-y-3">
          <Button
            onClick={() => window.location.href = '/signin'}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Volver al inicio de sesión
          </Button>
          <button
            type="button"
            onClick={() => setIsSuccess(false)}
            className="text-sm text-green-700 hover:text-green-800 font-medium underline"
          >
            Probar con otro email
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              required
              className={cn(fieldClassName, 'pl-10')}
              placeholder="tu@email.com"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 animate-fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error al enviar
              </h3>
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
          className="w-full"
        >
          Enviar enlace de recuperación
        </Button>
      </div>
    </form>
  )
}