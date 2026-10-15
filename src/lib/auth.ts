import { createInsforgeClient } from './insforge'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils'
import {
  classifySignInError,
  classifySignUpError,
  type AuthFailure,
} from './insforge/auth-error-codes'

export interface AuthUser {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  bio?: string
  phone?: string
  location?: string
  website?: string
}

type ProfileFields = {
  full_name?: string
  avatar_url?: string
  bio?: string
  phone?: string
  location?: string
  website?: string
}

export type SignInActionResult =
  | { ok: true; user: { id: string; email: string } }
  | AuthFailure

export type SignUpActionResult =
  | {
      ok: true
      user: { id: string; email: string } | null
      requireEmailVerification: boolean
    }
  | AuthFailure

const PROFILE_FETCH_TIMEOUT_MS = 5000
const UPDATE_PROFILE_TIMEOUT_MS = 20000
const UPLOAD_TIMEOUT_MS = 30000
const SESSION_EXPIRED_STATUS_CODES = new Set([401, 403])

type SdkError = { message: string; statusCode?: number; error?: string }

function throwSdkError(error: SdkError | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback)
}

export class AuthService {
  private insforge = createInsforgeClient()

  async signUp(email: string, password: string, fullName: string): Promise<SignUpActionResult> {
    logger.info('AuthService: Iniciando signUp con email:', email)
    const { data, error } = await this.insforge.auth.signUp({
      email,
      password,
      name: fullName,
    })
    if (error) {
      const failure = classifySignUpError(error)
      logger.warn('AuthService: signUp rechazado', failure)
      return failure
    }

    const user = data?.user
    const result: SignUpActionResult = {
      ok: true,
      user: user ? { id: user.id, email: user.email } : null,
      requireEmailVerification: data?.requireEmailVerification ?? false,
    }
    logger.info('AuthService: signUp completado', {
      requireEmailVerification: result.requireEmailVerification,
    })
    return result
  }

  async verifyEmail(email: string, otp: string) {
    const { data, error } = await this.insforge.auth.verifyEmail({ email, otp })
    throwSdkError(error, 'No se pudo verificar el email')
    if (!data?.user) throw new Error('No se pudo verificar el email')
    return { user: { id: data.user.id, email: data.user.email } }
  }

  async resendVerificationEmail(email: string) {
    const { error } = await this.insforge.auth.resendVerificationEmail({ email })
    throwSdkError(error, 'No se pudo reenviar el código de verificación')
  }

  async signIn(email: string, password: string): Promise<SignInActionResult> {
    logger.info('AuthService: Iniciando signIn con email:', email)
    const { data, error } = await this.insforge.auth.signInWithPassword({ email, password })
    if (error || !data?.user) {
      const failure = classifySignInError(error)
      logger.warn('AuthService: signIn rechazado', failure)
      return failure
    }
    logger.info('AuthService: signIn completado exitosamente')
    return { ok: true, user: { id: data.user.id, email: data.user.email } }
  }

  async signInWithGoogle() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) throw new Error('El acceso con Google requiere un navegador')
    const { error } = await this.insforge.auth.signInWithOAuth('google', {
      redirectTo: `${origin}/auth/callback`,
    })
    throwSdkError(error, 'No se pudo iniciar el acceso con Google')
  }

  async signOut() {
    const { error } = await this.insforge.auth.signOut()
    throwSdkError(error, 'No se pudo cerrar la sesión')
  }

  async resetPassword(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) throw new Error('El formato del email no es válido')
    const normalizedEmail = email.trim().toLowerCase()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    try {
      const { error } = await this.insforge.auth.sendResetPasswordEmail({
        email: normalizedEmail,
        redirectTo: `${origin}/reset-password`,
      })
      throwSdkError(error, 'No se pudo enviar el email de recuperación')
    } catch (err) {
      logger.error('AuthService: Error en resetPassword:', { error: getErrorMessage(err) })
      throw new Error(`Error al enviar email de recuperación: ${getErrorMessage(err)}`)
    }
  }

  async updatePassword(password: string, token: string) {
    const { error } = await this.insforge.auth.resetPassword({ newPassword: password, otp: token })
    throwSdkError(error, 'No se pudo actualizar la contraseña')
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await this.insforge.auth.getCurrentUser()
    if (error) {
      if (SESSION_EXPIRED_STATUS_CODES.has(error.statusCode ?? -1)) return null
      logger.error('AuthService: No se pudo comprobar la sesión', {
        error: error.message,
        statusCode: error.statusCode,
      })
      throw new Error(error.message || 'No se pudo comprobar la sesión')
    }

    const sessionUser = data?.user
    if (!sessionUser?.id) return null

    const profileQuery = this.insforge.database
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle()
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB profile fetch timed out')), PROFILE_FETCH_TIMEOUT_MS),
    )

    let profile: Record<string, unknown> | null = null
    try {
      const { data: profileData, error: profileError } = await Promise.race([profileQuery, timeout])
      if (profileError) logger.warn('AuthService: Error obteniendo datos extra del usuario:', profileError.message)
      else profile = profileData
    } catch (dbError) {
      logger.warn('AuthService: Timeout o error al obtener perfil, continuando con usuario básico:', dbError)
    }

    return {
      id: sessionUser.id,
      email: sessionUser.email,
      full_name: (profile?.full_name as string | undefined) ?? sessionUser.profile?.name,
      avatar_url: (profile?.avatar_url as string | undefined) ?? sessionUser.profile?.avatar_url,
      bio: profile?.bio as string | undefined,
      phone: profile?.phone as string | undefined,
      location: profile?.location as string | undefined,
      website: profile?.website as string | undefined,
    }
  }

  onAuthStateChange(callback: (event: string) => void) {
    return this.insforge.auth.onAuthStateChange(callback)
  }

  async updateProfile(updates: ProfileFields) {
    let user: AuthUser | null
    try {
      user = await this.getCurrentUser()
    } catch (error) {
      logger.error('AuthService: Failed to get user for update', error)
      throw new Error('Could not verify current session')
    }
    if (!user) throw new Error('No user logged in')

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Update profile timed out after 20s')), UPDATE_PROFILE_TIMEOUT_MS),
    )
    try {
      const authProfile = this.insforge.auth.setProfile({
        name: updates.full_name,
        avatar_url: updates.avatar_url,
        ...updates,
      }).then(({ error }) => throwSdkError(error, 'Could not update auth profile'))
      const dbProfile = this.insforge.database.from('profiles').upsert({
        id: user.id,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      const [, result] = await Promise.race([Promise.all([authProfile, dbProfile]), timeout])
      if (result?.error) throw new Error(result.error.message)
    } catch (error) {
      logger.error('AuthService: Profile update exception', error)
      throw error
    }
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('No user logged in')
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`
    const bucket = this.insforge.storage.from('avatars')
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Avatar upload timed out after 30s')), UPLOAD_TIMEOUT_MS),
    )
    const { error } = await Promise.race([bucket.upload(fileName, file), timeout])
    throwSdkError(error, 'No se pudo subir el avatar')
    const { data } = bucket.getPublicUrl(fileName)
    return data?.publicUrl ?? ''
  }
}

export const authService = new AuthService()
