'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'
import VerifyEmailStep from './VerifyEmailStep'

const registerSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/\d/, 'Debe contener al menos un número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterForm() {
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
    if (score <= 1) return 'bg-red-500';
    if (score === 2) return 'bg-yellow-500';
    if (score === 3) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const getStrengthText = (score: number) => {
    if (score <= 1) return 'Débil';
    if (score === 2) return 'Regular';
    if (score === 3) return 'Buena';
    return 'Fuerte';
  };

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError('')

    try {
      const { requireEmailVerification } = await signUp(
        data.email,
        data.password,
        data.fullName,
      )

      if (requireEmailVerification) {
        setPendingEmail(data.email)
      } else {
        // El alta ya dejó sesión: no hay nada que confirmar.
        router.replace('/dashboard')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('auth/email-already-in-use')) {
          setError('Este email ya está registrado')
        } else {
          setError(err.message)
        }
      } else {
        setError('Error al crear la cuenta')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (pendingEmail) {
    return <VerifyEmailStep email={pendingEmail} />
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crea tu cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          O{' '}
          <Link
            href="/signin"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            inicia sesión si ya tienes cuenta
          </Link>
        </p>
      </div>
      
      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <input
                {...register('fullName')}
                id="fullName"
                type="text"
                autoComplete="name"
                className={cn(fieldClassName, 'mt-1')}
                placeholder="Tu nombre completo"
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                className={cn(fieldClassName, 'mt-1')}
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
              
              {/* Password strength indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-gray-600">Fortaleza de la contraseña:</div>
                    <div className={`text-xs font-medium ${
                        strengthScore <= 1 ? 'text-red-500' : 
                        strengthScore === 2 ? 'text-yellow-500' : 
                        strengthScore === 3 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                      {getStrengthText(strengthScore)}
                    </div>
                  </div>
                  <div className="flex space-x-1 h-1.5">
                    {[1, 2, 3, 4].map((index) => (
                      <div 
                        key={index}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          index <= strengthScore ? getStrengthColor(strengthScore) : 'bg-gray-200'
                        }`} 
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Usa 8+ caracteres, mayúsculas, minúsculas y números.
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={cn(fieldClassName, 'pr-10')}
                  placeholder="Confirma tu contraseña"
                />
                {isClient && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <Button type="submit" loading={isLoading} className="w-full">
              Crear cuenta
            </Button>
          </div>
        </form>
    </div>
  )
}