'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  redirectTo = '/signin' 
}: ProtectedRouteProps) {
  const { user, loading, sessionError, reloadSession } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Solo se redirige cuando el servidor ha confirmado que no hay sesión. Si la
    // comprobación falló (sessionError) no se toca la URL: el middleware sí ve
    // la cookie y devolvería /signin a /dashboard en bucle.
    if (!loading && !user && !sessionError) {
      // Use replace instead of push to avoid back button issues
      router.replace(redirectTo)
    }
  }, [user, loading, sessionError, router, redirectTo])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    if (sessionError) {
      // Antes de redirigir, ofrecer reintentar: un fallo al comprobar la sesión
      // no es lo mismo que no tenerla.
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <ErrorState
            title="No se pudo comprobar tu sesión"
            message="No hemos podido verificar tu sesión con el servidor. Reintenta; si el problema continúa, cierra sesión y vuelve a entrar."
            onRetry={() => {
              void reloadSession()
            }}
          />
        </div>
      )
    }

    // Sin usuario y sin error: hay redirección en curso (la lanza el efecto).
    // Mostrar un estado vacío o un spinner ligero para evitar el flash de "pantalla blanca" total.
    return null;
  }

  return <>{children}</>
}
