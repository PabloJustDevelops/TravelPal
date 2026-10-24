import { AuthService } from '../auth'
import { createInsforgeClient } from '../insforge'

jest.mock('../insforge', () => ({ createInsforgeClient: jest.fn() }))
jest.mock('../logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } }))
jest.mock('../utils', () => ({ getErrorMessage: (error: Error) => error.message }))

describe('AuthService con el cliente browser de InsForge', () => {
  const auth = {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    sendResetPasswordEmail: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getCurrentUser: jest.fn(),
    setProfile: jest.fn(),
    signInWithOAuth: jest.fn(),
    onAuthStateChange: jest.fn(),
  }
  const profileQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    upsert: jest.fn(),
  }
  const client = {
    auth,
    database: { from: jest.fn(() => profileQuery) },
    storage: { from: jest.fn() },
  }
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createInsforgeClient as jest.Mock).mockReturnValue(client)
    service = new AuthService()
  })

  it('preserva el resultado de login cuando las credenciales son incorrectas o falta verificar email', async () => {
    auth.signInWithPassword
      .mockResolvedValueOnce({ data: null, error: { error: 'AUTH_UNAUTHORIZED', statusCode: 401 } })
      .mockResolvedValueOnce({ data: null, error: { error: 'FORBIDDEN', statusCode: 403 } })

    await expect(service.signIn('a@b.com', 'bad')).resolves.toEqual({
      ok: false, code: 'invalid_credentials', statusCode: 401,
    })
    await expect(service.signIn('a@b.com', 'bad')).resolves.toEqual({
      ok: false, code: 'email_not_verified', statusCode: 403,
    })
  })

  it.each([true, false])('conserva el estado de verificación del alta (%s)', async (requireEmailVerification) => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' }, requireEmailVerification },
      error: null,
    })
    await expect(service.signUp('a@b.com', 'password', 'Ana')).resolves.toEqual({
      ok: true, user: { id: 'u1', email: 'a@b.com' }, requireEmailVerification,
    })
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password', name: 'Ana' })
  })

  it('verifica y reenvía códigos OTP mediante el SDK', async () => {
    auth.verifyEmail.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    auth.resendVerificationEmail.mockResolvedValue({ data: { success: true }, error: null })
    await expect(service.verifyEmail('a@b.com', '123456')).resolves.toEqual({ user: { id: 'u1', email: 'a@b.com' } })
    await expect(service.resendVerificationEmail('a@b.com')).resolves.toBeUndefined()
    expect(auth.verifyEmail).toHaveBeenCalledWith({ email: 'a@b.com', otp: '123456' })
    expect(auth.resendVerificationEmail).toHaveBeenCalledWith({ email: 'a@b.com' })
  })

  it('envía y consume el token de recuperación usando el SDK', async () => {
    auth.sendResetPasswordEmail.mockResolvedValue({ data: { success: true }, error: null })
    auth.resetPassword.mockResolvedValue({ data: {}, error: null })
    await service.resetPassword('ANA@example.com')
    await service.updatePassword('new-password', 'reset-token')
    expect(auth.sendResetPasswordEmail).toHaveBeenCalledWith({ email: 'ana@example.com', redirectTo: 'http://localhost/es/reset-password' })
    expect(auth.resetPassword).toHaveBeenCalledWith({ newPassword: 'new-password', otp: 'reset-token' })
  })

  it('mantiene el locale inglés en el enlace de recuperación', async () => {
    auth.sendResetPasswordEmail.mockResolvedValue({ data: { success: true }, error: null })
    await service.resetPassword('ana@example.com', 'en')
    expect(auth.sendResetPasswordEmail).toHaveBeenCalledWith({ email: 'ana@example.com', redirectTo: 'http://localhost/en/reset-password' })
  })

  it('cierra sesión y propaga errores del SDK', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'backend unavailable' } })
    await expect(service.signOut()).rejects.toThrow('backend unavailable')
  })

  it('actualiza el perfil de auth y la fila de profiles', async () => {
    auth.getCurrentUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    profileQuery.maybeSingle.mockResolvedValue({ data: { full_name: 'Ana' }, error: null })
    profileQuery.upsert.mockResolvedValue({ error: null })
    auth.setProfile.mockResolvedValue({ data: {}, error: null })
    await service.updateProfile({ full_name: 'Ana nueva' })
    expect(auth.setProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana nueva', full_name: 'Ana nueva' }))
    expect(client.database.from).toHaveBeenCalledWith('profiles')
    expect(profileQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', full_name: 'Ana nueva' }))
  })

  it('devuelve null si el refresh de una sesión expirada responde 401', async () => {
    auth.getCurrentUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthorized', statusCode: 401 } })
    await expect(service.getCurrentUser()).resolves.toBeNull()
  })

  it('inicia OAuth de Google con el callback estático y reporta denegación del SDK', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://accounts.google.test', provider: 'google' }, error: null })
    await service.signInWithGoogle()
    expect(auth.signInWithOAuth).toHaveBeenCalledWith('google', { redirectTo: 'http://localhost/auth/callback' })
    auth.signInWithOAuth.mockResolvedValueOnce({ data: null, error: { message: 'access_denied', statusCode: 400 } })
    await expect(service.signInWithGoogle()).rejects.toThrow('access_denied')
  })

  it('conserva el locale inglés en el callback OAuth', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://accounts.google.test', provider: 'google' }, error: null })
    await service.signInWithGoogle('en')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith('google', { redirectTo: 'http://localhost/auth/callback?locale=en' })
  })
})
