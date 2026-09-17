import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { authService } from '@/lib/auth'
import type { SignUpActionResult } from '@/lib/insforge/auth-actions'

// El setup global sustituye AuthContext por un mock fijo; aqui se ejercita el
// provider real, asi que se pide el modulo autentico.
jest.mock('@/contexts/AuthContext', () => jest.requireActual('@/contexts/AuthContext'))

// El servicio real importa `@insforge/sdk/ssr` (ESM, no cargable bajo Jest) y
// las server actions usan `next/headers`: se mockea el modulo entero.
jest.mock('@/lib/auth', () => ({
  authService: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockedSignUp = authService.signUp as jest.Mock
const mockedSignIn = authService.signIn as jest.Mock
const mockedSignOut = authService.signOut as jest.Mock
const mockedGetCurrentUser = authService.getCurrentUser as jest.Mock

let api: ReturnType<typeof useAuth> | undefined

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function Capture({
  onReady,
}: {
  onReady: (value: ReturnType<typeof useAuth>) => void
}) {
  const value = useAuth()
  useEffect(() => {
    onReady(value)
  }, [value, onReady])
  return null
}

const readApi = () => {
  if (!api) throw new Error('AuthProvider no ha publicado su api')
  return api
}

describe('AuthContext: alta y verificacion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue(null)
  });

  const mount = () =>
    render(
      <AuthProvider>
        <Capture onReady={(value) => { api = value }} />
      </AuthProvider>,
    )

  it('signUp devuelve el flag y no relee una sesion que no existe', async () => {
    mockedSignUp.mockResolvedValue({ ok: true, requireEmailVerification: true })
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    let result: SignUpActionResult | undefined
    await act(async () => {
      result = await readApi().signUp('ana@example.com', 'Password1', 'Ana')
    })

    expect(result).toEqual({ ok: true, requireEmailVerification: true })
    expect(mockedSignUp).toHaveBeenCalledWith(
      'ana@example.com',
      'Password1',
      'Ana',
    )
    // Verificacion pendiente: el alta no abre sesion, no hay nada que releer.
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('refresca la sesion cuando el alta no pide verificacion', async () => {
    mockedSignUp.mockResolvedValue({ ok: true, requireEmailVerification: false })
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    await act(async () => {
      await readApi().signUp('ana@example.com', 'Password1', 'Ana')
    })

    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('no relee la sesion ni la toca cuando el alta falla', async () => {
    mockedSignUp.mockResolvedValue({
      ok: false,
      code: 'email_exists',
      statusCode: 409,
    })
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    await act(async () => {
      await readApi().signUp('ana@example.com', 'Password1', 'Ana')
    })

    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
    expect(readApi().user).toBeNull()
  })

  it('verifyEmail relee el usuario para que la UI lo vea', async () => {
    const user = { id: 'user-123', email: 'ana@example.com' }
    ;(authService.verifyEmail as jest.Mock).mockResolvedValue({
      user: { id: user.id, email: user.email },
    })
    mockedGetCurrentUser.mockResolvedValue(user)

    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    let verified: unknown
    await act(async () => {
      verified = await readApi().verifyEmail('ana@example.com', '123456')
    })

    expect(authService.verifyEmail).toHaveBeenCalledWith(
      'ana@example.com',
      '123456',
    )
    expect(verified).toEqual(user)
  })

  it('resendVerificationEmail delega en el servicio', async () => {
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    await act(async () => {
      await readApi().resendVerificationEmail('ana@example.com')
    })

    expect(authService.resendVerificationEmail).toHaveBeenCalledWith(
      'ana@example.com',
    )
  })

  it('marca sessionError si la comprobacion falla, en vez de dar la sesion por inexistente', async () => {
    mockedGetCurrentUser.mockRejectedValue(new Error('auth unreachable'))

    mount()

    await waitFor(() => expect(readApi().loading).toBe(false))

    expect(readApi().user).toBeNull()
    // Distinto de "no hay sesion": el guardia no debe redirigir en falso.
    expect(readApi().sessionError).toBe(true)
  })

  it('no marca sessionError cuando el servidor confirma que no hay sesion', async () => {
    mount()

    await waitFor(() => expect(readApi().loading).toBe(false))

    expect(readApi().user).toBeNull()
    expect(readApi().sessionError).toBe(false)
  })
})

describe('AuthContext: hidratacion frente a mutacion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue(null)
  });

  const mount = () =>
    render(
      <AuthProvider>
        <Capture onReady={(value) => { api = value }} />
      </AuthProvider>,
    )

  it('un login en curso no devuelve la app al esqueleto de carga', async () => {
    const login = deferred<{ ok: true; user: { id: string; email: string } }>()
    mockedSignIn.mockReturnValue(login.promise)

    mount()
    // La hidratacion ya termino: a partir de aqui `loading` no vuelve a true.
    await waitFor(() => expect(readApi().loading).toBe(false))
    expect(readApi().pending).toBe(false)

    let inFlight: Promise<unknown> | undefined
    await act(async () => {
      inFlight = readApi().signIn('ana@example.com', 'Password1')
    })

    await waitFor(() => expect(readApi().pending).toBe(true))
    expect(readApi().loading).toBe(false)

    const user = { id: 'user-123', email: 'ana@example.com' }
    mockedGetCurrentUser.mockResolvedValue(user)
    await act(async () => {
      login.resolve({ ok: true, user })
      await inFlight
    })

    expect(readApi().pending).toBe(false)
    expect(readApi().loading).toBe(false)
    expect(readApi().user).toEqual(user)
  })

  it('deja el usuario quieto y no relee la sesion si el login falla', async () => {
    mockedSignIn.mockResolvedValue({
      ok: false,
      code: 'invalid_credentials',
      statusCode: 401,
    })

    mount()
    await waitFor(() => expect(readApi().loading).toBe(false))
    const readsAfterHydration = mockedGetCurrentUser.mock.calls.length

    await act(async () => {
      await readApi().signIn('ana@example.com', 'Password1')
    })

    expect(readApi().user).toBeNull()
    expect(readApi().pending).toBe(false)
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(readsAfterHydration)
  })

  it('cerrar sesion va por pending y no por loading', async () => {
    const logout = deferred<void>()
    mockedSignOut.mockReturnValue(logout.promise)

    mount()
    await waitFor(() => expect(readApi().loading).toBe(false))

    let inFlight: Promise<unknown> | undefined
    await act(async () => {
      inFlight = readApi().signOut()
    })

    await waitFor(() => expect(readApi().pending).toBe(true))
    expect(readApi().loading).toBe(false)

    await act(async () => {
      logout.resolve()
      await inFlight
    })

    expect(readApi().pending).toBe(false)
    expect(readApi().loading).toBe(false)
    expect(readApi().user).toBeNull()
  })
})
