'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AuthUser, authService as defaultAuthService } from '@/lib/auth'
import { logger as defaultLogger } from '@/lib/logger'
import type {
  SignInActionResult,
  SignUpActionResult,
} from '@/lib/insforge/auth-actions'

interface AuthContextType {
  user: AuthUser | null
  // true solo mientras se hidrata la sesión inicial (o se reintenta): es el
  // estado que usan las pantallas para no decidir "no hay sesión" antes de
  // tiempo. Una mutación no lo toca, para no devolver la app al esqueleto.
  loading: boolean
  // true mientras hay una mutación de auth en curso (login, alta, logout).
  pending: boolean
  // true cuando la sesión no se pudo comprobar (timeout o fallo del servidor),
  // que es distinto de "no hay sesión". Sin esta distinción el guardia no puede
  // saber si redirigir o reintentar.
  sessionError: boolean
  reloadSession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<SignInActionResult>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<SignUpActionResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  verifyEmail: (email: string, otp: string) => Promise<AuthUser | null>
  resendVerificationEmail: (email: string) => Promise<void>
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_TIMEOUT_MS = 8000

type AuthProviderDeps = {
  authService?: typeof defaultAuthService
  logger?: typeof defaultLogger
}
export function AuthProvider({ children, deps }: { children: React.ReactNode; deps?: AuthProviderDeps }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const authService = deps?.authService ?? defaultAuthService
  const logger = deps?.logger ?? defaultLogger
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadSession = useCallback(async () => {
    logger.debug('AuthContext: Inicializando useEffect')
    setLoading(true)
    setSessionError(false)

    try {
      // Timeout de seguridad para evitar carga infinita
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), SESSION_TIMEOUT_MS),
      )

      // Race entre obtener usuario y timeout
      const current = (await Promise.race([
        authService.getCurrentUser(),
        timeoutPromise,
      ])) as AuthUser | null

      if (!mountedRef.current) return
      logger.debug('AuthContext: Usuario inicial obtenido:', current)
      setUser(current)
    } catch (error) {
      logger.error('AuthContext: Error o timeout inicializando auth:', { error })
      if (!mountedRef.current) return
      // No se pudo comprobar la sesión: no la damos por inexistente. Si el
      // cliente se declarase sin usuario, ProtectedRoute mandaría a /signin
      // mientras el middleware (que sí ve la cookie) devolvería a /dashboard:
      // el rebote que dejaba la pantalla en blanco.
      setSessionError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [authService, logger])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  // Las mutaciones de auth corren en el servidor; tras cada una releemos la
  // sesión para reflejar el nuevo estado en la UI.
  const refreshUser = async () => {
    const current = await authService.getCurrentUser()
    setUser(current)
    setSessionError(false)
    return current
  }

  const signIn = async (
    email: string,
    password: string,
  ): Promise<SignInActionResult> => {
    logger.info('AuthContext: Iniciando signIn')
    setPending(true)
    try {
      const result = await authService.signIn(email, password)

      if (!result.ok) {
        logger.warn('AuthContext: signIn rechazado', {
          code: result.code,
          statusCode: result.statusCode,
        })
        // No hay sesión que releer y el usuario se queda como estaba: el
        // formulario decide el mensaje con el código.
        return result
      }

      logger.info('AuthContext: signIn exitoso')
      // El login acaba de dejar la sesión en cookies y su respuesta ya trae el
      // usuario: fijarlo evita una ventana sin usuario entre el login y la
      // relectura en la que el guardia podría redirigir.
      const current = await authService.getCurrentUser()
      setUser(current ?? result.user)
      setSessionError(false)
      return result
    } catch (err: unknown) {
      logger.error('AuthContext: Error en signIn', { error: err })
      throw err
    } finally {
      setPending(false)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<SignUpActionResult> => {
    setPending(true)
    try {
      const result = await authService.signUp(email, password, fullName)

      if (!result.ok) {
        return result
      }

      // Con verificación pendiente no hay sesión que releer: el alta deja al
      // usuario fuera hasta que confirme el código.
      if (!result.requireEmailVerification) {
        await refreshUser()
      }
      return result
    } finally {
      setPending(false)
    }
  }

  const verifyEmail = async (email: string, otp: string) => {
    logger.info('AuthContext: Verificando el email')
    await authService.verifyEmail(email, otp)
    // El código correcto ya dejó la sesión escrita en cookies: releemos para que
    // la UI (y ProtectedRoute) vean al usuario antes de navegar.
    return refreshUser()
  }

  const resendVerificationEmail = async (email: string) => {
    await authService.resendVerificationEmail(email)
  }

  const signOut = async () => {
    // El logout no hidrata nada: va por pending para que las pantallas que ya
    // tienen sesión no se vacíen al esqueleto mientras se cierra.
    setPending(true)
    try {
      // Timeout de seguridad para el logout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000),
      )

      await Promise.race([authService.signOut(), timeoutPromise])
    } catch (error) {
      logger.error('AuthContext: Error en signOut', { error })
    } finally {
      // Aseguramos que el estado local se limpie independientemente del resultado
      setUser(null)
      setPending(false)
    }
  }

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email)
  }

  const updateProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
    await authService.updateProfile(updates)
    await refreshUser()
  }

  const uploadAvatar = async (file: File) => {
    return authService.uploadAvatar(file)
  }

  const value = {
    user,
    loading,
    pending,
    sessionError,
    reloadSession: loadSession,
    signIn,
    signUp,
    signOut,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    updateProfile,
    uploadAvatar,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
