import { createInsforgeClient } from './insforge'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils'
import {
  resetPasswordAction,
  resendVerificationEmailAction,
  sendResetPasswordEmailAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateProfileAction,
  verifyEmailAction,
} from './insforge/auth-actions'

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

const PROFILE_FETCH_TIMEOUT_MS = 5000
const UPDATE_PROFILE_TIMEOUT_MS = 20000
const UPLOAD_TIMEOUT_MS = 30000

export class AuthService {
  private insforge = createInsforgeClient()

  async signUp(email: string, password: string, fullName: string) {
    logger.info('AuthService: Iniciando signUp con email:', email)
    const result = await signUpAction({ email, password, name: fullName })
    // El flag viaja hasta el formulario: con verificación por código el alta no
    // abre sesión, así que la UI tiene que decidir a dónde ir.
    logger.info('AuthService: signUp completado', {
      requireEmailVerification: result.requireEmailVerification,
    })
    return result
  }

  async verifyEmail(email: string, otp: string) {
    logger.info('AuthService: Verificando el email')
    return verifyEmailAction({ email, otp })
  }

  async resendVerificationEmail(email: string) {
    logger.info('AuthService: Reenviando el código de verificación')
    await resendVerificationEmailAction({ email })
  }

  async signIn(email: string, password: string) {
    logger.info('AuthService: Iniciando signIn con email:', email)

    try {
      const result = await signInAction({ email, password })

      if (!result?.user) {
        logger.error('AuthService: No se obtuvo usuario después del signIn')
        throw new Error('No se pudo autenticar el usuario')
      }

      logger.info('AuthService: signIn completado exitosamente')
      return result
    } catch (err: unknown) {
      logger.error('AuthService: Excepción en signIn:', { error: getErrorMessage(err) })
      throw err
    }
  }

  async signOut() {
    await signOutAction()
  }

  async resetPassword(email: string) {
    // Validar formato de email antes de enviar la solicitud
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('El formato del email no es válido')
    }

    // Normalizar el email (trim y lowercase)
    const normalizedEmail = email.trim().toLowerCase()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    try {
      await sendResetPasswordEmailAction({
        email: normalizedEmail,
        redirectTo: `${origin}/reset-password`,
      })
    } catch (err) {
      logger.error('AuthService: Error en resetPassword:', { error: getErrorMessage(err) })
      throw new Error(`Error al enviar email de recuperación: ${getErrorMessage(err)}`)
    }
  }

  async updatePassword(password: string, token: string) {
    await resetPasswordAction({ newPassword: password, otp: token })
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      logger.debug('AuthService: Getting current user...')

      const { data, error } = await this.insforge.auth.getCurrentUser()

      if (error || !data?.user) {
        if (error) logger.debug('AuthService: Error obteniendo usuario:', error.message)
        return null
      }

      const user = data.user

      // Datos adicionales del perfil en nuestra tabla `profiles`.
      // Timeout específico solo para la base de datos, no para toda la auth.
      const dbTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('DB profile fetch timed out')),
          PROFILE_FETCH_TIMEOUT_MS,
        ),
      )

      let profile: Record<string, unknown> | null = null
      try {
        const { data: profileData, error: dbError } = (await Promise.race([
          this.insforge.database
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),
          dbTimeoutPromise,
        ])) as {
          data: Record<string, unknown> | null
          error: { message: string } | null
        }

        if (dbError) {
          logger.warn('AuthService: Error obteniendo datos extra del usuario:', dbError.message)
        } else {
          profile = profileData
        }
      } catch (dbErr) {
        logger.warn(
          'AuthService: Timeout o error al obtener perfil, continuando con usuario básico:',
          dbErr,
        )
      }

      logger.debug('AuthService: User retrieved successfully', { id: user.id })
      return {
        id: user.id,
        email: user.email,
        full_name:
          (profile?.full_name as string | undefined) ?? user.profile?.name ?? undefined,
        avatar_url:
          (profile?.avatar_url as string | undefined) ??
          user.profile?.avatar_url ??
          undefined,
        bio: profile?.bio as string | undefined,
        phone: profile?.phone as string | undefined,
        location: profile?.location as string | undefined,
        website: profile?.website as string | undefined,
      }
    } catch (err) {
      logger.error('AuthService: Excepción inesperada en getCurrentUser:', err)
      return null
    }
  }

  async updateProfile(updates: ProfileFields) {
    logger.info('AuthService: Updating profile...', updates)

    let user
    try {
      user = await this.getCurrentUser()
    } catch (e) {
      logger.error('AuthService: Failed to get user for update', e)
      throw new Error('Could not verify current session')
    }

    if (!user) {
      logger.error('AuthService: Update failed - No user logged in')
      throw new Error('No user logged in')
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Update profile timed out after 20s')),
        UPDATE_PROFILE_TIMEOUT_MS,
      ),
    )

    try {
      // 1. Actualizar el perfil de auth (setProfile en servidor)
      const updateAuthPromise = updateProfileAction({
        name: updates.full_name,
        avatar_url: updates.avatar_url,
        ...updates,
      })

      // 2. Actualizar la tabla profiles
      const updateDbPromise = this.insforge.database.from('profiles').upsert({
        id: user.id,
        updated_at: new Date().toISOString(),
        ...updates,
      })

      const [, dbResult] = (await Promise.race([
        Promise.all([updateAuthPromise, updateDbPromise]),
        timeoutPromise,
      ])) as [unknown, { error: { message: string } | null }]

      if (dbResult?.error) {
        logger.error('AuthService: Profile DB update failed', dbResult.error)
        throw dbResult.error
      }

      logger.info('AuthService: Profile updated successfully')
    } catch (error) {
      logger.error('AuthService: Profile update exception', error)
      throw error
    }
  }

  async uploadAvatar(file: File): Promise<string> {
    logger.info('AuthService: Uploading avatar...', { fileName: file.name, size: file.size })
    const user = await this.getCurrentUser()
    if (!user) throw new Error('No user logged in')

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Avatar upload timed out after 30s')),
        UPLOAD_TIMEOUT_MS,
      ),
    )

    try {
      const bucket = this.insforge.storage.from('avatars')

      const { error: uploadError } = (await Promise.race([
        bucket.upload(fileName, file),
        timeoutPromise,
      ])) as { error: { message: string } | null }

      if (uploadError) {
        logger.error('AuthService: Error uploading avatar:', uploadError)
        throw uploadError
      }

      const { data } = bucket.getPublicUrl(fileName)

      logger.info('AuthService: Avatar uploaded successfully', { publicUrl: data?.publicUrl })
      return data?.publicUrl ?? ''
    } catch (error) {
      logger.error('AuthService: Avatar upload exception', error)
      throw error
    }
  }
}

export const authService = new AuthService()
