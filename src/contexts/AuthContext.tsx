'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AuthUser, authService as defaultAuthService } from '@/lib/auth'
import { logger as defaultLogger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ requireEmailVerification: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  verifyEmail: (email: string, otp: string) => Promise<AuthUser | null>
  resendVerificationEmail: (email: string) => Promise<void>
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type AuthProviderDeps = {
  authService?: typeof defaultAuthService
  logger?: typeof defaultLogger
}
export function AuthProvider({ children, deps }: { children: React.ReactNode; deps?: AuthProviderDeps }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const authService = deps?.authService ?? defaultAuthService
  const logger = deps?.logger ?? defaultLogger

  useEffect(() => {
    let mounted = true
    logger.debug('AuthContext: Inicializando useEffect')

    const initAuth = async () => {
      try {
        // Timeout de seguridad para evitar carga infinita
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), 8000),
        )

        const userPromise = authService.getCurrentUser()

        // Race entre obtener usuario y timeout
        const user = (await Promise.race([userPromise, timeoutPromise])) as AuthUser | null

        if (mounted) {
          logger.debug('AuthContext: Usuario inicial obtenido:', user)
          setUser(user)
        }
      } catch (error) {
        logger.error('AuthContext: Error o timeout inicializando auth:', { error })
        // En caso de error, asumimos no autenticado para permitir renderizar
        // (y que ProtectedRoute redirija si es necesario)
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    return () => {
      mounted = false
    }
  }, [])

  // Las mutaciones de auth corren en el servidor; tras cada una releemos la
  // sesión para reflejar el nuevo estado en la UI.
  const refreshUser = async () => {
    const current = await authService.getCurrentUser()
    setUser(current)
    return current
  }

  const signIn = async (email: string, password: string) => {
    logger.info('AuthContext: Iniciando signIn')
    setLoading(true)
    try {
      const result = await authService.signIn(email, password)
      logger.info('AuthContext: signIn exitoso', result)
      await refreshUser()
    } catch (err: unknown) {
      const message = getErrorMessage(err)
      logger.error('AuthContext: Error en signIn', { error: message })
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true)
    try {
      const result = await authService.signUp(email, password, fullName)
      // Con verificación pendiente no hay sesión que releer: el alta deja al
      // usuario fuera hasta que confirme el código.
      if (!result.requireEmailVerification) {
        await refreshUser()
      }
      return result
    } finally {
      setLoading(false)
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
    setLoading(true)
    try {
      // Timeout de seguridad para el logout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000),
      )

      await Promise.race([authService.signOut(), timeoutPromise])
    } catch (error) {
      logger.error('AuthContext: Error en signOut', { error })
    } finally {
      // Aseguramos que el estado local se limpie independientemente del resultado
      setUser(null)
      setLoading(false)
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
